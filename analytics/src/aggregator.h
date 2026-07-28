#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace oxelia51 {

// 前向声明，避免头文件循环依赖
class ClickHouseClient;

// 聚合后的日统计事件（按 project_id + model + date 分组）
struct DailyEvent {
    std::string project_id;
    std::string model;
    std::string date;             // "YYYY-MM-DD"
    uint64_t prompt_tokens = 0;
    uint64_t completion_tokens = 0;
    uint64_t total_tokens = 0;
    uint64_t duration_ms = 0;
    uint64_t request_count = 0;
    double cost_usd = 0.0;        // 由 Pricing 填充
};

// 聚合器：从 ClickHouse 拉取新事件并按日聚合
class Aggregator {
public:
    // 聚合 lastProcessed 之后的新事件
    // lastProcessed: ISO8601 时间戳，空字符串则默认取最近 intervalMinutes 分钟
    // outMaxTimestamp: 接收本批次最大 timestamp（无事件时为空）
    std::vector<DailyEvent> aggregate(ClickHouseClient& ch,
                                     const std::string& lastProcessed,
                                     int intervalMinutes,
                                     std::string& outMaxTimestamp);
};

} // namespace oxelia51
