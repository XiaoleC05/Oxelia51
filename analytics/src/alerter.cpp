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

// HTML 转义（告警邮件内容防注入）
static std::string htmlEscape(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '&': out += "&amp;"; break;
            case '<': out += "&lt;"; break;
            case '>': out += "&gt;"; break;
            case '"': out += "&quot;"; break;
            case '\'': out += "&#39;"; break;
            default: out.push_back(c);
        }
    }
    return out;
}

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

// 告警邮件品牌 HTML（与 web 端 OxeliaEmailLayout 风格一致：
// 深色头带 + 白字 logo + 浅色正文 + 备案页脚）
std::string Alerter::buildAlertHtml(const std::string& subject,
                                    const std::string& content) const {
    const char* head = R"(<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;"><tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:20px 40px;"><tr><td><img src="https://oxelia51.com/icon-64-dark.png" alt="Oxelia51" width="128" height="48" style="display:block;border:0;"/></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 40px 8px;"><tr><td style="background:#FFFFFF;border-radius:8px;padding:28px 32px;"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;color:#0A0A0A;">)";
    const char* bodyStart = R"(</h1><div style="font-size:14px;line-height:1.7;color:#333333;white-space:pre-wrap;">)";
    const char* bodyEnd = R"(</div></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 40px 32px;"><tr><td style="font-size:12px;line-height:1.6;color:#999999;">这封邮件由 Oxelia51 —— Token 消耗统计平台发出。<br/>官网：<a href="https://oxelia51.com" style="color:#E5484D;">oxelia51.com</a> · 反馈：receive@oxelia51.com<br/>鲁ICP备2026038838号-1 · 鲁公网安备37028202001309号</td></tr></table></td></tr></table></body></html>)";
    return std::string(head) + htmlEscape(subject) + bodyStart +
           htmlEscape(content) + bodyEnd;
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

    // 构建邮件体（RFC 5322 格式）：品牌 HTML 模板
    std::string emailBody =
        "From: " + emailFrom_ + "\r\n"
        "To: " + to + "\r\n"
        "Subject: " + subject + "\r\n"
        "Content-Type: text/html; charset=utf-8\r\n"
        "Content-Transfer-Encoding: 8bit\r\n"
        "\r\n" +
        buildAlertHtml(subject, body) + "\r\n";

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
        // 一次性发送 AUTH 凭据（initial response）。QQ 邮箱 SMTP 对 libcurl
        // 默认的分步 PLAIN 认证返回 334 后拒绝（Login denied）；SASL_IR 成功。
        curl_easy_setopt(curl, CURLOPT_SASL_IR, 1L);
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
        std::string subject = "[Oxelia51 告警] " + alert.alert_type + " · " + alert.project_id;
        std::string body = alert.message + "\n\n项目: " + alert.project_id +
                           "\n类型: " + alert.alert_type +
                           "\n级别: " + alert.severity +
                           "\n时间: " + alert.created_at;

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
