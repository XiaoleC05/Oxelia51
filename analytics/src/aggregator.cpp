#include "aggregator.h"

#include "db/clickhouse.h"

#include <sstream>
#include <stdexcept>
#include <string>

namespace oxelia51 {

// SQL 字符串转义：单引号 → ''，反斜杠 → \\
static std::string escapeSql(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '\'': out += "''";   break;
            case '\\': out += "\\\\"; break;
            default:   out.push_back(c);
        }
    }
    return out;
}

// 按 \n 分割，返回非空行
static std::vector<std::string> splitLines(const std::string& text) {
    std::vector<std::string> lines;
    std::istringstream iss(text);
    std::string line;
    while (std::getline(iss, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        lines.push_back(line);
    }
    return lines;
}

// 按 \t 分割一行
static std::vector<std::string> splitTabs(const std::string& line) {
    std::vector<std::string> fields;
    std::string field;
    for (char c : line) {
        if (c == '\t') {
            fields.push_back(std::move(field));
            field.clear();
        } else {
            field.push_back(c);
        }
    }
    fields.push_back(std::move(field));
    return fields;
}

std::vector<DailyEvent> Aggregator::aggregate(ClickHouseClient& ch,
                                               const std::string& lastProcessed,
                                               int intervalMinutes,
                                               std::string& outMaxTimestamp) {
    outMaxTimestamp.clear();

    // 确定查询起点
    std::string startTs;
    if (!lastProcessed.empty()) {
        startTs = "parseDateTimeBestEffort('" + escapeSql(lastProcessed) + "')";
    } else {
        startTs = "now() - INTERVAL " + std::to_string(intervalMinutes) + " MINUTE";
    }

    // 1. 查询本批次最大 timestamp（用于更新 engine_state）
    std::string maxSql =
        "SELECT toString(max(timestamp)) "
        "FROM oxelia51.token_events "
        "WHERE timestamp > " + startTs + " "
        "FORMAT TabSeparated";
    std::string maxResp = ch.query(maxSql);
    auto maxLines = splitLines(maxResp);
    if (!maxLines.empty() && !maxLines[0].empty() && maxLines[0] != "\\N") {
        outMaxTimestamp = maxLines[0];
    }

    // 2. 聚合查询（按 project_id + model + date 分组）
    std::string aggSql =
        "SELECT project_id, model, toString(toDate(timestamp)) AS date, "
        "       sum(prompt_tokens) AS prompt, "
        "       sum(completion_tokens) AS completion, "
        "       sum(total_tokens) AS total, "
        "       sum(duration_ms) AS dur, "
        "       count() AS requests "
        "FROM oxelia51.token_events "
        "WHERE timestamp > " + startTs + " "
        "GROUP BY project_id, model, date "
        "FORMAT TabSeparatedWithNames";

    std::string resp = ch.query(aggSql);
    auto lines = splitLines(resp);
    if (lines.empty()) {
        return {};
    }

    // 第一行是表头，跳过
    std::vector<DailyEvent> events;
    for (size_t i = 1; i < lines.size(); ++i) {
        if (lines[i].empty()) continue;
        auto fields = splitTabs(lines[i]);
        if (fields.size() < 8) continue;

        DailyEvent e;
        e.project_id = fields[0];
        e.model = fields[1];
        e.date = fields[2];
        e.prompt_tokens = std::stoull(fields[3]);
        e.completion_tokens = std::stoull(fields[4]);
        e.total_tokens = std::stoull(fields[5]);
        e.duration_ms = std::stoull(fields[6]);
        e.request_count = std::stoull(fields[7]);
        events.push_back(std::move(e));
    }

    return events;
}

} // namespace oxelia51
