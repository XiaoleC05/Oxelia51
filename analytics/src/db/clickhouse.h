#pragma once

#include <cstdint>
#include <string>

namespace oxelia51 {

// SQL 字符串转义：单引号 → ''，反斜杠 → 双反斜杠
// 用于 ClickHouse HTTP 接口的内联 SQL（不支持参数化绑定）
std::string escapeSql(const std::string& s);

// ClickHouse HTTP 客户端（libcurl，端口 8123）
// 不使用 clickhouse-cpp 原生协议，避免依赖复杂性
class ClickHouseClient {
public:
    // addr: HTTP 基地址，如 "http://127.0.0.1:8123"
    // user/password: ClickHouse 认证凭据
    ClickHouseClient(const std::string& addr,
                     const std::string& user,
                     const std::string& password);
    ~ClickHouseClient();

    ClickHouseClient(const ClickHouseClient&) = delete;
    ClickHouseClient& operator=(const ClickHouseClient&) = delete;

    // 执行查询，返回原始响应体（调用方在 SQL 中指定 FORMAT）
    // 失败时抛出 std::runtime_error
    std::string query(const std::string& sql);

    // 执行 DDL/DML，忽略响应体
    void execute(const std::string& sql);

    // 获取昨日某 project+model 的 total_tokens 总量（用于异常检测基线）
    // date 格式 "YYYY-MM-DD"；返回 0 表示无数据
    uint64_t getYesterdayUsage(const std::string& projectId,
                               const std::string& model,
                               const std::string& date);

private:
    std::string base_url_;
    std::string auth_header_;  // "Authorization: Basic base64(user:pass)"
};

} // namespace oxelia51
