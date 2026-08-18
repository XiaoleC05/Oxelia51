#include "db/clickhouse.h"

#include <curl/curl.h>

#include <cstdlib>
#include <stdexcept>
#include <string>

namespace oxelia51 {

// libcurl 写回调：将响应追加到 std::string
static size_t writeCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    auto* out = static_cast<std::string*>(userp);
    out->append(static_cast<char*>(contents), size * nmemb);
    return size * nmemb;
}

// Base64 编码（用于 HTTP Basic Auth）
static std::string base64Encode(const std::string& input) {
    static const char table[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string b64;
    int val = 0, valb = -6;
    for (unsigned char c : input) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            b64.push_back(table[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) {
        b64.push_back(table[((val << 8) >> (valb + 8)) & 0x3F]);
    }
    while (b64.size() % 4) {
        b64.push_back('=');
    }
    return b64;
}

// SQL 字符串转义：单引号 → ''，反斜杠 → 双反斜杠
// 用于 ClickHouse HTTP 接口的内联 SQL（不支持参数化绑定）
// 声明见 clickhouse.h，供 aggregator 等模块复用
std::string escapeSql(const std::string& s) {
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

ClickHouseClient::ClickHouseClient(const std::string& addr,
                                   const std::string& user,
                                   const std::string& password)
    : base_url_(addr) {
    // 确保 base_url 不以 / 结尾
    if (!base_url_.empty() && base_url_.back() == '/') {
        base_url_.pop_back();
    }
    // 构建 Basic Auth header
    if (!user.empty()) {
        auth_header_ = "Authorization: Basic " + base64Encode(user + ":" + password);
    }
}

ClickHouseClient::~ClickHouseClient() = default;

std::string ClickHouseClient::query(const std::string& sql) {
    CURL* curl = curl_easy_init();
    if (!curl) {
        throw std::runtime_error("curl_easy_init failed");
    }

    std::string response;
    struct curl_slist* headers = nullptr;
    if (!auth_header_.empty()) {
        headers = curl_slist_append(headers, auth_header_.c_str());
    }

    // ClickHouse HTTP 接口：POST 请求体 = SQL
    curl_easy_setopt(curl, CURLOPT_URL, base_url_.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, sql.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(sql.size()));
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);

    CURLcode res = curl_easy_perform(curl);
    long httpCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        throw std::runtime_error("ClickHouse HTTP request failed: " +
                                 std::string(curl_easy_strerror(res)));
    }
    if (httpCode != 200) {
        throw std::runtime_error("ClickHouse returned HTTP " +
                                 std::to_string(httpCode) + ": " + response);
    }
    return response;
}

uint64_t ClickHouseClient::getYesterdayUsage(const std::string& projectId,
                                             const std::string& model,
                                             const std::string& date) {
    // 查询昨日同 project+model 的 total_tokens 总量
    std::string sql =
        "SELECT sum(total_tokens) "
        "FROM oxelia51.token_events "
        "WHERE project_id = '" + escapeSql(projectId) + "' "
        "AND model = '" + escapeSql(model) + "' "
        "AND toDate(timestamp) = toDate(parseDateTimeBestEffort('" + escapeSql(date) + "')) - 1 "
        "FORMAT TabSeparated";

    std::string resp = query(sql);
    if (resp.empty() || resp == "\\N\n" || resp == "\\N") {
        return 0;
    }
    return std::stoull(resp);
}

} // namespace oxelia51
