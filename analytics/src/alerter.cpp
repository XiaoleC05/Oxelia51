#include "alerter.h"

#include <cerrno>
#include <chrono>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <curl/curl.h>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <string>

namespace oxelia51 {

// ---- 工具函数 ----

static std::string timestamp() {
    auto now = std::chrono::system_clock::now();
    auto t = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
    gmtime_r(&t, &tm);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &tm);
    return buf;
}

static void logMsg(const std::string& msg) {
    std::fprintf(stderr, "[%s] %s\n", timestamp().c_str(), msg.c_str());
}

// SMTP 配置（从 Nodemailer 格式 URL 解析）
struct SmtpConfig {
    std::string scheme;    // "smtp" | "smtps"
    std::string host;
    int port = 587;
    std::string user;
    std::string password;
    bool useSsl = false;
    bool valid = false;
};

// 简单 URL 百分号解码（%40 → @ 等）
static std::string urldecode(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    auto hex = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        return c - 'A' + 10;
    };
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '%' && i + 2 < s.size() &&
            std::isxdigit(static_cast<unsigned char>(s[i + 1])) &&
            std::isxdigit(static_cast<unsigned char>(s[i + 2]))) {
            out += static_cast<char>(hex(s[i + 1]) * 16 + hex(s[i + 2]));
            i += 2;
        } else {
            out += s[i];
        }
    }
    return out;
}

static SmtpConfig parseSmtpUrl(const std::string& url) {
    SmtpConfig cfg;
    if (url.empty()) return cfg;

    // 去掉查询参数 (?pool=true 等)
    std::string u = url.substr(0, url.find('?'));

    // 提取 scheme
    size_t schemeEnd = u.find("://");
    if (schemeEnd == std::string::npos) return cfg;
    cfg.scheme = u.substr(0, schemeEnd);
    cfg.useSsl = (cfg.scheme == "smtps");

    // host:port[:userinfo] 部分
    std::string rest = u.substr(schemeEnd + 3);

    // 提取认证信息 (user:password@)：用最后一个 @ 分割，
    // 兼容邮箱地址本身含 @ 的情况（如 714085964@qq.com:auth@smtp.qq.com:465）
    size_t atPos = rest.rfind('@');
    if (atPos != std::string::npos) {
        std::string creds = rest.substr(0, atPos);
        rest = rest.substr(atPos + 1);
        size_t colonPos = creds.find(':');
        if (colonPos != std::string::npos) {
            cfg.user = urldecode(creds.substr(0, colonPos));
            cfg.password = urldecode(creds.substr(colonPos + 1));
        } else {
            cfg.user = urldecode(creds);
        }
    }

    // 提取 host 和 port
    size_t colonPos = rest.rfind(':');
    if (colonPos != std::string::npos) {
        cfg.host = urldecode(rest.substr(0, colonPos));
        try {
            cfg.port = std::stoi(rest.substr(colonPos + 1));
        } catch (...) {
            cfg.port = cfg.useSsl ? 465 : 587;
        }
    } else {
        cfg.host = urldecode(rest);
        cfg.port = cfg.useSsl ? 465 : 587;
    }

    if (cfg.host.empty()) return cfg;
    cfg.valid = true;
    return cfg;
}

// libcurl 写回调（丢弃响应体）
static size_t discardCallback(void*, size_t size, size_t nmemb, void*) {
    return size * nmemb;
}

// SMTP 邮件体上传回调
struct EmailPayload {
    std::string data;
    size_t pos = 0;
};

static size_t readCallback(char* buffer, size_t size, size_t nitems, void* userdata) {
    auto* payload = static_cast<EmailPayload*>(userdata);
    size_t maxBytes = size * nitems;
    size_t remaining = payload->data.size() - payload->pos;
    if (remaining == 0) return 0;
    size_t toCopy = (maxBytes < remaining) ? maxBytes : remaining;
    std::memcpy(buffer, payload->data.data() + payload->pos, toCopy);
    payload->pos += toCopy;
    return toCopy;
}

// ---- Alerter 实现 ----

Alerter::Alerter(PostgresClient& pg,
                 const std::string& smtpUrl,
                 const std::string& emailFrom)
    : pg_(pg), smtpUrl_(smtpUrl), emailFrom_(emailFrom) {}

std::string Alerter::jsonEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out.push_back(c);
                }
        }
    }
    return out;
}

std::string Alerter::buildAlertJson(const Alert& alert) const {
    std::ostringstream oss;
    oss << "{";
    oss << "\"project_id\":\"" << jsonEscape(alert.project_id) << "\",";
    oss << "\"alert_type\":\"" << jsonEscape(alert.alert_type) << "\",";
    oss << "\"severity\":\"" << jsonEscape(alert.severity) << "\",";
    oss << "\"message\":\"" << jsonEscape(alert.message) << "\",";
    oss << "\"created_at\":\"" << jsonEscape(alert.created_at) << "\"";
    oss << "}";
    return oss.str();
}

bool Alerter::sendEmail(const std::string& to,
                        const std::string& subject,
                        const std::string& body) {
    if (smtpUrl_.empty() || emailFrom_.empty()) {
        return false;
    }

    SmtpConfig cfg = parseSmtpUrl(smtpUrl_);
    if (!cfg.valid) {
        logMsg("[WARN] SMTP URL invalid, skipping email: " + smtpUrl_);
        return false;
    }

    // 构建邮件体（RFC 5322 格式）
    std::string emailBody =
        "From: " + emailFrom_ + "\r\n"
        "To: " + to + "\r\n"
        "Subject: " + subject + "\r\n"
        "Content-Type: text/plain; charset=utf-8\r\n"
        "Content-Transfer-Encoding: 8bit\r\n"
        "\r\n" +
        body + "\r\n";

    EmailPayload payload{emailBody, 0};

    std::string smtpUrl = cfg.scheme + "://" + cfg.host + ":" + std::to_string(cfg.port);

    CURL* curl = curl_easy_init();
    if (!curl) return false;

    struct curl_slist* rcpts = nullptr;
    rcpts = curl_slist_append(rcpts, to.c_str());

    curl_easy_setopt(curl, CURLOPT_URL, smtpUrl.c_str());
    curl_easy_setopt(curl, CURLOPT_MAIL_FROM, emailFrom_.c_str());
    curl_easy_setopt(curl, CURLOPT_MAIL_RCPT, rcpts);
    curl_easy_setopt(curl, CURLOPT_UPLOAD, 1L);
    curl_easy_setopt(curl, CURLOPT_READFUNCTION, readCallback);
    curl_easy_setopt(curl, CURLOPT_READDATA, &payload);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, discardCallback);
    curl_easy_setopt(curl, CURLOPT_USE_SSL,
                     cfg.useSsl ? (long)CURLUSESSL_ALL : (long)CURLUSESSL_TRY);
    if (!cfg.user.empty()) {
        curl_easy_setopt(curl, CURLOPT_USERNAME, cfg.user.c_str());
        curl_easy_setopt(curl, CURLOPT_PASSWORD, cfg.password.c_str());
    }
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);

    CURLcode res = curl_easy_perform(curl);
    long httpCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);

    curl_slist_free_all(rcpts);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        logMsg("[WARN] SMTP send failed: " + std::string(curl_easy_strerror(res)));
        return false;
    }
    return true;
}

bool Alerter::sendWebhook(const std::string& url, const std::string& jsonPayload) {
    CURL* curl = curl_easy_init();
    if (!curl) return false;

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonPayload.c_str());
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(jsonPayload.size()));
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, discardCallback);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);

    CURLcode res = curl_easy_perform(curl);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        logMsg("[WARN] Webhook send failed: " + std::string(curl_easy_strerror(res)));
        return false;
    }
    return true;
}

void Alerter::sendPendingAlerts() {
    auto alerts = pg_.getUnsentAlerts();
    if (alerts.empty()) {
        return;
    }

    logMsg("Processing " + std::to_string(alerts.size()) + " pending alert(s)");

    int sent = 0;
    for (const auto& alert : alerts) {
        std::string subject = "[Oxelia51 Alert] " + alert.alert_type + ": " + alert.project_id;
        std::string body = alert.message + "\n\nProject: " + alert.project_id +
                           "\nType: " + alert.alert_type +
                           "\nSeverity: " + alert.severity +
                           "\nTime: " + alert.created_at;

        auto channels = pg_.getAlertChannels(alert.project_id);
        bool delivered = false;

        for (const auto& ch : channels) {
            if (ch.type == "email" && ch.verified) {
                if (sendEmail(ch.address, subject, body)) {
                    delivered = true;
                }
            } else if (ch.type == "webhook") {
                std::string json = buildAlertJson(alert);
                if (sendWebhook(ch.address, json)) {
                    delivered = true;
                }
            }
        }

        // 无论是否外发成功都标记为 sent（站内通知已写入）
        // 避免重复处理；外发失败仅记录日志
        pg_.markAlertSent(alert.id);
        ++sent;
    }

    logMsg("Alert dispatch complete: " + std::to_string(sent) + " sent");
}

} // namespace oxelia51
