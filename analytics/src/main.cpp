// Oxelia51 Token Analytics Engine
// 离线批处理：ClickHouse 聚合 → 成本计算 → 异常检测 → 预算检查 → 告警分发
// 由 systemd timer 每 5 分钟触发

#include "aggregator.h"
#include "alerter.h"
#include "db/clickhouse.h"
#include "db/postgres.h"
#include "detector.h"
#include "pricing.h"

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

// 带时间戳的日志输出（写入 stderr，供 systemd journal 捕获）
void log(const std::string& msg) {
    auto now = std::chrono::system_clock::now();
    auto t = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
    gmtime_r(&t, &tm);
    char ts[32];
    std::strftime(ts, sizeof(ts), "%Y-%m-%d %H:%M:%S", &tm);
    std::fprintf(stderr, "[%s] %s\n", ts, msg.c_str());
    std::fflush(stderr);
}

// getenv 带回退：primary 优先，否则用 fallback
std::string envOr(const char* primary, const char* fallback) {
    const char* v = std::getenv(primary);
    if (v && *v) return v;
    v = std::getenv(fallback);
    return v ? v : "";
}

std::string envOr(const char* primary, const char* fallback, const char* defaultValue) {
    std::string v = envOr(primary, fallback);
    return v.empty() ? defaultValue : v;
}

// 格式化浮点数
std::string fmtDouble(double v, int precision) {
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%.*f", precision, v);
    return buf;
}

} // namespace

int main(int argc, char* argv[]) {
    // ---- 命令行参数 ----
    bool dryRun = false;
    int intervalMinutes = 5;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--dry-run") {
            dryRun = true;
        } else if (arg == "--interval" && i + 1 < argc) {
            try {
                intervalMinutes = std::stoi(argv[++i]);
            } catch (...) {
                log("Error: invalid --interval value");
                return 1;
            }
        } else if (arg == "--help" || arg == "-h") {
            std::fprintf(stderr, "Usage: token-analytics [--dry-run] [--interval N]\n");
            return 0;
        } else {
            log("Error: unknown argument: " + arg);
            return 1;
        }
    }

    log(std::string("Token Analytics Engine starting") +
        (dryRun ? " (DRY-RUN)" : "") +
        " interval=" + std::to_string(intervalMinutes) + "min");

    // ---- 环境变量 ----
    // ClickHouse: CH_ADDR 优先，默认 http://127.0.0.1:8123
    //             CH_USER/CH_PASS 回退到 CLICKHOUSE_USER/CLICKHOUSE_PASSWORD
    std::string chAddr = envOr("CH_ADDR", "", "http://127.0.0.1:8123");
    std::string chUser = envOr("CH_USER", "CLICKHOUSE_USER");
    std::string chPass = envOr("CH_PASS", "CLICKHOUSE_PASSWORD");

    // PostgreSQL: PG_CONNSTR 优先，否则从 POSTGRES_* 构建
    std::string pgConnstr = envOr("PG_CONNSTR", "");
    if (pgConnstr.empty()) {
        pgConnstr = "host=127.0.0.1 port=5434 dbname=" +
                    envOr("POSTGRES_DB", "", "postgres") +
                    " user=" + envOr("POSTGRES_USER", "", "postgres") +
                    " password=" + envOr("POSTGRES_PASSWORD", "", "");
    }

    // SMTP（可选）
    std::string smtpUrl = envOr("SMTP_CONNECTION_URL", "", "");
    std::string emailFrom = envOr("EMAIL_FROM_ADDRESS", "", "");

    // ---- 连接数据库 ----
    oxelia51::ClickHouseClient ch(chAddr, chUser, chPass);
    try {
        ch.query("SELECT 1 FORMAT TabSeparated");
        log("ClickHouse: connected (" + chAddr + ")");
    } catch (const std::exception& e) {
        log("ClickHouse connection failed: " + std::string(e.what()));
        return 1;
    }

    oxelia51::PostgresClient pg(pgConnstr);
    if (!pg.ok()) {
        log("PostgreSQL connection failed: " + pg.lastError());
        return 1;
    }
    log("PostgreSQL: connected");

    // ---- Step 1+3: 聚合（24h 分块追平积压，逐块 UPSERT + 推进游标） ----
    // 单块失败只损失该块进度（游标停在上一成功块），下个 timer 周期自动重试，
    // 避免「积压越长单次查询越重 → 失败 → 游标不动 → 积压滚雪球」
    std::vector<oxelia51::DailyEvent> events;
    std::string maxTimestamp;
    bool upsertOk = true;
    const int kChunkHours = 24;
    const int kMaxChunksPerRun = 40;  // 单次运行最多追 40 天积压，剩余留给下个周期
    try {
        std::string lastProcessed = pg.getEngineState("last_processed");
        if (!lastProcessed.empty()) {
            log("Last processed: " + lastProcessed);
        }
        oxelia51::Aggregator aggregator;
        std::string cursor = lastProcessed;
        for (int i = 0; i < kMaxChunksPerRun; ++i) {
            std::string chunkMax;
            auto chunk = aggregator.aggregate(ch, cursor, intervalMinutes, chunkMax, kChunkHours);
            if (chunk.empty()) break;
            if (chunkMax <= cursor && !cursor.empty()) {
                // 护栏：游标未前进（理论上不可能，防解析精度类回归导致死循环重复计数）
                log("Step 1 FAILED: chunk cursor did not advance beyond " + cursor + ", aborting catch-up");
                break;
            }
            if (chunkMax > maxTimestamp) maxTimestamp = chunkMax;
            log("Step 1: chunk #" + std::to_string(i + 1) + " aggregated " +
                std::to_string(chunk.size()) + " event group(s) up to " + chunkMax);
            events.insert(events.end(), chunk.begin(), chunk.end());
            if (!dryRun) {
                try {
                    pg.upsertDailyStats(chunk);
                    pg.setEngineState("last_processed", chunkMax);
                    cursor = chunkMax;
                    log("Step 3: chunk #" + std::to_string(i + 1) +
                        " upserted, cursor advanced to " + chunkMax);
                } catch (const std::exception& e) {
                    log("Step 3 FAILED (upsert): " + std::string(e.what()) +
                        " — cursor NOT advanced, retry next run");
                    upsertOk = false;
                    break;
                }
            } else {
                cursor = chunkMax;  // dry-run：内存推进，不写库
            }
        }
        log("Step 1: Aggregated " + std::to_string(events.size()) + " event group(s) in total");
    } catch (const std::exception& e) {
        log("Step 1 FAILED (aggregate): " + std::string(e.what()));
        return 1;  // 无事件数据，无法继续
    }

    // ---- Step 2: 计算成本 ----
    try {
        oxelia51::Pricing pricing(pg);
        double totalCost = 0.0;
        for (auto& e : events) {
            e.cost_usd = pricing.calculate(e.model, e.prompt_tokens, e.completion_tokens);
            totalCost += e.cost_usd;
        }
        log("Step 2: Cost calculated, total $" + fmtDouble(totalCost, 4));
    } catch (const std::exception& e) {
        log("Step 2 FAILED (pricing): " + std::string(e.what()) + " — costs set to 0");
        // 继续执行，cost_usd 保持 0
    }

    // （Step 3 已并入 Step 1 分块循环：逐块 UPSERT + 游标推进）

    // ---- Step 4: 异常检测（按 project 读取配置） ----
    int anomalyCount = 0;
    try {
        // 加载所有 project 的异常检测配置
        std::unordered_map<std::string, oxelia51::AnomalyConfig> configMap;
        auto anomalyConfigs = pg.getAnomalyConfigs();
        for (auto& [pid, cfg] : anomalyConfigs) {
            configMap[pid] = cfg;
        }
        log("Step 4: Loaded " + std::to_string(configMap.size()) + " anomaly config(s)");

        oxelia51::Detector detector;
        const oxelia51::AnomalyConfig DEFAULT_CONFIG;  // enabled=true, spike_ratio=3.0

        for (const auto& e : events) {
            // 查找配置，无则使用默认值
            auto it = configMap.find(e.project_id);
            const oxelia51::AnomalyConfig& cfg =
                (it != configMap.end()) ? it->second : DEFAULT_CONFIG;

            if (!cfg.enabled) continue;  // 禁用异常检测的 project 跳过

            uint64_t baseline = ch.getYesterdayUsage(e.project_id, e.model, e.date);
            if (detector.isAnomalous(e.total_tokens, baseline, cfg)) {
                double ratio = (baseline > 0)
                    ? static_cast<double>(e.total_tokens) / static_cast<double>(baseline)
                    : static_cast<double>(e.total_tokens);
                std::string msg = e.model + " spike " + fmtDouble(ratio, 1) +
                                  "x vs yesterday (current=" + std::to_string(e.total_tokens) +
                                  ", baseline=" + std::to_string(baseline) +
                                  ", threshold=" + fmtDouble(cfg.spike_ratio, 1) + "x)";
                log("Step 4: Anomaly [" + e.project_id + "] " + msg);
                if (!dryRun) {
                    pg.insertAlert(e.project_id, oxelia51::AlertType::ANOMALY,
                                   "warning", msg);
                }
                ++anomalyCount;
            }
        }
        log("Step 4: Anomaly detection done, " + std::to_string(anomalyCount) + " alert(s)");
    } catch (const std::exception& e) {
        log("Step 4 FAILED (anomaly): " + std::string(e.what()));
    }

    // ---- Step 5: 预算检查 ----
    try {
        if (!dryRun) {
            auto configs = pg.getBudgetConfigs();
            int budgetAlerts = 0;
            for (const auto& cfg : configs) {
                // 修正：预算按 USD 成本检查（从 daily_stats 汇总），而非 ClickHouse token 数
                double monthCost = pg.getMonthCost(cfg.project_id);
                if (monthCost >= cfg.budget_usd * cfg.threshold) {
                    double pct = (cfg.budget_usd > 0)
                        ? (monthCost / cfg.budget_usd * 100.0) : 0.0;
                    std::string msg = "Budget " + fmtDouble(pct, 0) +
                                      "% reached ($" + fmtDouble(monthCost, 2) +
                                      "/$" + fmtDouble(cfg.budget_usd, 2) + ")";
                    log("Step 5: Budget alert [" + cfg.project_id + "] " + msg);
                    pg.insertAlert(cfg.project_id, oxelia51::AlertType::BUDGET,
                                   "warning", msg);
                    ++budgetAlerts;
                }
            }
            log("Step 5: Budget check done, " + std::to_string(budgetAlerts) +
                " alert(s) across " + std::to_string(configs.size()) + " config(s)");
        } else {
            log("Step 5: Skipped (dry-run)");
        }
    } catch (const std::exception& e) {
        log("Step 5 FAILED (budget): " + std::string(e.what()));
    }

    // ---- Step 6: 游标状态汇总（逐块已推进，此处仅汇总日志） ----
    if (!dryRun && !maxTimestamp.empty() && upsertOk) {
        log("Step 6: last_processed = " + maxTimestamp + " (advanced per chunk)");
    } else if (dryRun) {
        log("Step 6: Skipped (dry-run)");
    } else if (!upsertOk) {
        log("Step 6: some chunk failed, last_processed advanced only up to last successful chunk");
    } else {
        log("Step 6: No new events, last_processed unchanged");
    }

    // ---- Step 7: 确保今日汇率 ----
    if (!dryRun) {
        try {
            pg.ensureTodayExchangeRate();
        } catch (const std::exception& e) {
            log("Step 7 FAILED (exchange_rate): " + std::string(e.what()));
        }
    }

    // ---- Step 8: 分发告警通知（邮件 + Webhook） ----
    if (!dryRun) {
        try {
            oxelia51::Alerter alerter(pg, smtpUrl, emailFrom);
            alerter.sendPendingAlerts();
        } catch (const std::exception& e) {
            log("Step 8 FAILED (alerter): " + std::string(e.what()));
        }
    } else {
        log("Step 8: Skipped (dry-run)");
    }

    // ---- 总结 ----
    log("Done: " + std::to_string(events.size()) + " events, " +
        std::to_string(anomalyCount) + " anomalies" +
        (dryRun ? " (dry-run, no writes)" : ""));

    return 0;
}
