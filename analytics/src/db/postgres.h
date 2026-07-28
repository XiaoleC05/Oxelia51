#pragma once

#include <libpq-fe.h>

#include <cstdint>
#include <string>
#include <vector>

#include "aggregator.h"  // DailyEvent

namespace oxelia51 {

// 告警类型
enum class AlertType { ANOMALY, BUDGET };

inline const char* alertTypeStr(AlertType t) {
    switch (t) {
        case AlertType::ANOMALY: return "anomaly";
        case AlertType::BUDGET:  return "budget";
    }
    return "unknown";
}

// 告警记录（对应 alert_logs 表）
struct Alert {
    int64_t id;
    std::string project_id;
    std::string alert_type;   // 'anomaly' | 'budget'
    std::string severity;     // 'warning'
    std::string message;
    std::string status;       // 'pending' | 'sent'
    std::string created_at;   // ISO8601
};

// 告警通道（对应 alert_channels 表）
struct AlertChannel {
    int64_t id;
    std::string project_id;
    std::string type;      // 'email' | 'webhook'
    std::string address;   // 邮箱地址或 Webhook URL
    bool verified;
};

// 预算配置（对应 budget_configs 表）
struct BudgetConfig {
    std::string project_id;
    double budget_usd;
    double threshold;
    bool enabled;
};

// PostgreSQL 客户端（libpq 封装）
class PostgresClient {
public:
    // connstr: "host=127.0.0.1 port=5434 dbname=postgres user=postgres password=xxx"
    explicit PostgresClient(const std::string& connstr);
    ~PostgresClient();

    PostgresClient(const PostgresClient&) = delete;
    PostgresClient& operator=(const PostgresClient&) = delete;

    // 检查连接是否成功
    bool ok() const;
    std::string lastError() const;

    // 低层接口：执行 SQL，返回 PGresult*（调用方负责 PQclear）
    PGresult* exec(const std::string& sql);
    PGresult* execParams(const std::string& sql,
                         const std::vector<std::string>& params);

    // ---- 日统计 ----
    // 批量 UPSERT：累加模式（ON CONFLICT DO UPDATE SET col = col + EXCLUDED.col）
    void upsertDailyStats(const std::vector<DailyEvent>& events);

    // ---- 告警 ----
    // 插入 pending 告警
    void insertAlert(const std::string& projectId, AlertType type,
                     const std::string& severity, const std::string& message);
    // 获取未发送的告警（status = 'pending'）
    std::vector<Alert> getUnsentAlerts();
    // 获取该项目的通知通道
    std::vector<AlertChannel> getAlertChannels(const std::string& projectId);
    // 标记告警已发送
    void markAlertSent(int64_t alertId);

    // ---- 预算 ----
    std::vector<BudgetConfig> getBudgetConfigs();
    // 获取某项目本月成本（从 daily_stats 汇总）
    double getMonthCost(const std::string& projectId);

    // ---- 引擎状态 ----
    std::string getEngineState(const std::string& key);
    void setEngineState(const std::string& key, const std::string& value);

    // ---- 汇率 ----
    // 如果今天没有汇率记录，写入默认值 7.20
    void ensureTodayExchangeRate();

private:
    PGconn* conn_;

    // 检查 PGresult 状态，失败抛异常
    void checkResult(PGresult* res, const std::string& context);
};

} // namespace oxelia51
