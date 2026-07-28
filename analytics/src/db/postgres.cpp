#include "db/postgres.h"

#include <cstdlib>
#include <stdexcept>
#include <string>

namespace oxelia51 {

PostgresClient::PostgresClient(const std::string& connstr)
    : conn_(PQconnectdb(connstr.c_str())) {
    if (!conn_) {
        throw std::runtime_error("PQconnectdb returned null (out of memory?)");
    }
    // 连接状态非 OK 时不抛异常，允许 main 通过 ok()/lastError() 检查后决定退出
}

PostgresClient::~PostgresClient() {
    if (conn_) {
        PQfinish(conn_);
    }
}

bool PostgresClient::ok() const {
    return conn_ && PQstatus(conn_) == CONNECTION_OK;
}

std::string PostgresClient::lastError() const {
    return conn_ ? PQerrorMessage(conn_) : "no connection";
}

PGresult* PostgresClient::exec(const std::string& sql) {
    PGresult* res = PQexec(conn_, sql.c_str());
    checkResult(res, sql);
    return res;
}

PGresult* PostgresClient::execParams(const std::string& sql,
                                     const std::vector<std::string>& params) {
    std::vector<const char*> vals;
    vals.reserve(params.size());
    for (const auto& p : params) {
        vals.push_back(p.c_str());
    }
    PGresult* res = PQexecParams(conn_, sql.c_str(),
                                 static_cast<int>(vals.size()),
                                 nullptr,  // paramTypes: 让 PG 推断
                                 vals.data(),
                                 nullptr, nullptr,  // paramLengths, paramFormats
                                 0);  // resultFormat: text
    checkResult(res, sql);
    return res;
}

void PostgresClient::checkResult(PGresult* res, const std::string& context) {
    if (!res) {
        throw std::runtime_error("PostgreSQL query failed (null result): " +
                                 std::string(PQerrorMessage(conn_)) + " | SQL: " + context);
    }
    ExecStatusType status = PQresultStatus(res);
    if (status != PGRES_COMMAND_OK && status != PGRES_TUPLES_OK) {
        std::string err = PQresultErrorMessage(res);
        PQclear(res);
        throw std::runtime_error("PostgreSQL query failed: " + err + " | SQL: " + context);
    }
}

void PostgresClient::upsertDailyStats(const std::vector<DailyEvent>& events) {
    if (events.empty()) return;

    // 使用事务批量写入
    PGresult* begin = PQexec(conn_, "BEGIN");
    if (PQresultStatus(begin) != PGRES_COMMAND_OK) {
        PQclear(begin);
        throw std::runtime_error("BEGIN failed: " + std::string(PQerrorMessage(conn_)));
    }
    PQclear(begin);

    const char* sql =
        "INSERT INTO oxelia51.daily_stats "
        "(project_id, model, date, prompt_tokens, completion_tokens, "
        " total_tokens, cost_usd, request_count) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) "
        "ON CONFLICT (project_id, model, date) DO UPDATE SET "
        "  prompt_tokens = daily_stats.prompt_tokens + EXCLUDED.prompt_tokens, "
        "  completion_tokens = daily_stats.completion_tokens + EXCLUDED.completion_tokens, "
        "  total_tokens = daily_stats.total_tokens + EXCLUDED.total_tokens, "
        "  cost_usd = daily_stats.cost_usd + EXCLUDED.cost_usd, "
        "  request_count = daily_stats.request_count + EXCLUDED.request_count, "
        "  updated_at = now()";

    try {
        for (const auto& e : events) {
            std::vector<std::string> params = {
                e.project_id, e.model, e.date,
                std::to_string(e.prompt_tokens),
                std::to_string(e.completion_tokens),
                std::to_string(e.total_tokens),
                std::to_string(e.cost_usd),
                std::to_string(e.request_count)
            };
            PGresult* res = execParams(sql, params);
            PQclear(res);
        }
    } catch (...) {
        PGresult* rollback = PQexec(conn_, "ROLLBACK");
        PQclear(rollback);
        throw;
    }

    PGresult* commit = PQexec(conn_, "COMMIT");
    if (PQresultStatus(commit) != PGRES_COMMAND_OK) {
        PQclear(commit);
        PGresult* rollback = PQexec(conn_, "ROLLBACK");
        PQclear(rollback);
        throw std::runtime_error("COMMIT failed: " + std::string(PQerrorMessage(conn_)));
    }
    PQclear(commit);
}

void PostgresClient::insertAlert(const std::string& projectId, AlertType type,
                                 const std::string& severity, const std::string& message) {
    const char* sql =
        "INSERT INTO oxelia51.alert_logs (project_id, alert_type, severity, message) "
        "VALUES ($1, $2, $3, $4)";
    std::vector<std::string> params = {
        projectId, alertTypeStr(type), severity, message
    };
    PGresult* res = execParams(sql, params);
    PQclear(res);
}

std::vector<Alert> PostgresClient::getUnsentAlerts() {
    const char* sql =
        "SELECT id, project_id, alert_type, severity, message, status, created_at "
        "FROM oxelia51.alert_logs WHERE status = 'pending' ORDER BY id";
    PGresult* res = exec(sql);
    std::vector<Alert> alerts;
    int n = PQntuples(res);
    alerts.reserve(n);
    for (int i = 0; i < n; ++i) {
        Alert a;
        a.id = std::stoll(PQgetvalue(res, i, 0));
        a.project_id = PQgetvalue(res, i, 1);
        a.alert_type = PQgetvalue(res, i, 2);
        a.severity = PQgetvalue(res, i, 3);
        a.message = PQgetvalue(res, i, 4) ? PQgetvalue(res, i, 4) : "";
        a.status = PQgetvalue(res, i, 5);
        a.created_at = PQgetvalue(res, i, 6);
        alerts.push_back(std::move(a));
    }
    PQclear(res);
    return alerts;
}

std::vector<AlertChannel> PostgresClient::getAlertChannels(const std::string& projectId) {
    const char* sql =
        "SELECT id, project_id, type, address, verified "
        "FROM oxelia51.alert_channels WHERE project_id = $1";
    PGresult* res = execParams(sql, {projectId});
    std::vector<AlertChannel> channels;
    int n = PQntuples(res);
    channels.reserve(n);
    for (int i = 0; i < n; ++i) {
        AlertChannel ch;
        ch.id = std::stoll(PQgetvalue(res, i, 0));
        ch.project_id = PQgetvalue(res, i, 1);
        ch.type = PQgetvalue(res, i, 2);
        ch.address = PQgetvalue(res, i, 3);
        ch.verified = (PQgetvalue(res, i, 4)[0] == 't');
        channels.push_back(std::move(ch));
    }
    PQclear(res);
    return channels;
}

void PostgresClient::markAlertSent(int64_t alertId) {
    const char* sql = "UPDATE oxelia51.alert_logs SET status = 'sent' WHERE id = $1";
    PGresult* res = execParams(sql, {std::to_string(alertId)});
    PQclear(res);
}

std::vector<BudgetConfig> PostgresClient::getBudgetConfigs() {
    const char* sql =
        "SELECT project_id, budget_usd, threshold, enabled "
        "FROM oxelia51.budget_configs WHERE enabled = true";
    PGresult* res = exec(sql);
    std::vector<BudgetConfig> configs;
    int n = PQntuples(res);
    configs.reserve(n);
    for (int i = 0; i < n; ++i) {
        BudgetConfig c;
        c.project_id = PQgetvalue(res, i, 0);
        c.budget_usd = std::stod(PQgetvalue(res, i, 1));
        c.threshold = std::stod(PQgetvalue(res, i, 2));
        c.enabled = (PQgetvalue(res, i, 3)[0] == 't');
        configs.push_back(std::move(c));
    }
    PQclear(res);
    return configs;
}

double PostgresClient::getMonthCost(const std::string& projectId) {
    const char* sql =
        "SELECT COALESCE(sum(cost_usd), 0.0) FROM oxelia51.daily_stats "
        "WHERE project_id = $1 AND date >= date_trunc('month', now())::date";
    PGresult* res = execParams(sql, {projectId});
    double cost = 0.0;
    if (PQntuples(res) > 0 && PQgetvalue(res, 0, 0)) {
        cost = std::stod(PQgetvalue(res, 0, 0));
    }
    PQclear(res);
    return cost;
}

std::string PostgresClient::getEngineState(const std::string& key) {
    const char* sql = "SELECT value FROM oxelia51.engine_state WHERE key = $1";
    PGresult* res = execParams(sql, {key});
    std::string value;
    if (PQntuples(res) > 0) {
        const char* v = PQgetvalue(res, 0, 0);
        if (v) value = v;
    }
    PQclear(res);
    return value;
}

void PostgresClient::setEngineState(const std::string& key, const std::string& value) {
    const char* sql =
        "INSERT INTO oxelia51.engine_state (key, value, updated_at) "
        "VALUES ($1, $2, now()) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()";
    PGresult* res = execParams(sql, {key, value});
    PQclear(res);
}

void PostgresClient::ensureTodayExchangeRate() {
    const char* sql =
        "INSERT INTO oxelia51.exchange_rates (date, rate_cny_per_usd) "
        "VALUES (CURRENT_DATE, 7.20) ON CONFLICT DO NOTHING";
    PGresult* res = exec(sql);
    PQclear(res);
}

} // namespace oxelia51
