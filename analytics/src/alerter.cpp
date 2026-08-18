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

// 邮件头字段净化：剔除 \r \n，防止 CRLF 头注入
static std::string sanitizeHeader(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        if (c != '\r' && c != '\n') out.push_back(c);
    }
    return out;
}

// 从 URL 中提取 host:port（不含 user:pass 凭据），用于日志脱敏
static std::string extractHostPort(const std::string& url) {
    std::string u = url;
    // 去 scheme
    size_t schemeEnd = u.find("://");
    if (schemeEnd != std::string::npos) {
        u = u.substr(schemeEnd + 3);
    }
    // 去路径与查询参数
    size_t end = u.find_first_of("/?");
    if (end != std::string::npos) {
        u = u.substr(0, end);
    }
    // 去 userinfo：取最后一个 @ 之后，兼容凭据本身含 @ 的情况
    size_t atPos = u.rfind('@');
    if (atPos != std::string::npos) {
        u = u.substr(atPos + 1);
    }
    return u;
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
// 深色头带 + logo + 品牌名，浅色正文白卡片结构化字段表，品牌页脚）。
// 全内联样式 + 表格布局，兼容主流邮件客户端。
std::string Alerter::buildAlertHtml(const Alert& alert) const {
    // 中文标签与 web 端告警设置页（AlertsSettings.tsx）保持一致；未知值回退原始字符串
    auto typeLabel = [](const std::string& t) -> std::string {
        if (t == "budget") return "预算";
        if (t == "anomaly") return "异常";
        return t;
    };
    auto severityLabel = [](const std::string& s) -> std::string {
        if (s == "warning") return "警告";
        if (s == "critical") return "严重";
        if (s == "info") return "提示";
        return s;
    };
    // 字段表行：label 列固定宽，行间细分隔线；value 一律 HTML 转义防注入
    auto fieldRow = [](const char* label, const std::string& value) {
        return std::string(
                   "<tr><td style=\"padding:10px 0;border-bottom:1px solid #F0F0F0;"
                   "font-size:13px;color:#999999;width:80px;vertical-align:top;\">") +
               label +
               "</td><td style=\"padding:10px 0;border-bottom:1px solid #F0F0F0;"
               "font-size:14px;color:#0A0A0A;vertical-align:top;\">" +
               htmlEscape(value) + "</td></tr>";
    };

    std::string html;
    html += R"(<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;"><tr><td>)";
    // 深色头部带：横版 logo（深底白字版）+ 品牌名
    html += R"(<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;"><tr><td style="padding:16px 40px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="https://oxelia51.com/icon-64-dark.png" alt="Oxelia51" width="128" height="48" style="display:block;border:0;"/></td><td style="padding-left:12px;color:#FAFAFA;font-size:18px;font-weight:600;">Oxelia51</td></tr></table></td></tr></table>)";
    // 浅色正文白卡片：标题 + 结构化字段表 + 告警详情
    // （当前值/阈值由检测器写入 message，无独立字段，归入「告警详情」）
    html += R"(<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAEAEA;border-radius:8px;"><tr><td style="padding:28px 32px;"><h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:#0A0A0A;">)";
    html += htmlEscape(typeLabel(alert.alert_type)) + "告警";
    html += R"(</h1><table role="presentation" width="100%" cellpadding="0" cellspacing="0">)";
    html += fieldRow("项目", alert.project_id);
    html += fieldRow("告警类型", typeLabel(alert.alert_type));
    html += fieldRow("严重级别", severityLabel(alert.severity));
    html += fieldRow("触发时间", alert.created_at);
    html += R"(</table><div style="margin-top:16px;font-size:13px;color:#999999;">告警详情</div><div style="margin-top:4px;padding:12px 16px;background:#FAFAFA;border:1px solid #EAEAEA;border-radius:6px;font-size:14px;line-height:1.7;color:#333333;white-space:pre-wrap;">)";
    html += htmlEscape(alert.message);
    html += R"(</div></td></tr></table></td></tr></table>)";
    // 品牌页脚：目的声明 + 官网 + 反馈邮箱 + 备案
    html += R"(<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px 40px 32px;font-size:12px;line-height:1.6;color:#999999;">这封邮件由 Oxelia51——Token 消耗统计平台发出。<br/>官网：<a href="https://oxelia51.com" style="color:#0A0A0A;">oxelia51.com</a> · 反馈邮箱：<a href="mailto:receive@oxelia51.com" style="color:#0A0A0A;">receive@oxelia51.com</a><br/>鲁ICP备2026038838号-1 · 鲁公网安备37028202001309号</td></tr></table>)";
    html += "</td></tr></table></body></html>";
    return html;
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
                        const std::string& textBody,
                        const std::string& htmlBody) {
    if (smtpUrl_.empty() || emailFrom_.empty()) {
        return false;
    }

    SmtpConfig cfg = parseSmtpUrl(smtpUrl_);
    if (!cfg.valid) {
        // 日志脱敏：只记录 host:port，不写入含凭据的完整 URL
        std::string hostPort = extractHostPort(smtpUrl_);
        if (!hostPort.empty()) {
            logMsg("[WARN] SMTP URL invalid, skipping email (host: " + hostPort + ")");
        } else {
            logMsg("[WARN] SMTP URL invalid, skipping email");
        }
        return false;
    }

    // 构建邮件体（RFC 5322）：multipart/alternative = 纯文本兜底 + 品牌 HTML。
    // 当前用 CURLOPT_UPLOAD 上传整封报文（非 libcurl MIME API），直接拼 boundary 即可。
    const std::string boundary = "oxelia51-alert-alt";
    std::string emailBody;
    emailBody += "From: " + sanitizeHeader(emailFrom_) + "\r\n";
    emailBody += "To: " + sanitizeHeader(to) + "\r\n";
    emailBody += "Subject: " + sanitizeHeader(subject) + "\r\n";
    emailBody += "MIME-Version: 1.0\r\n";
    emailBody += "Content-Type: multipart/alternative; boundary=\"" + boundary + "\"\r\n";
    emailBody += "\r\n";
    emailBody += "--" + boundary + "\r\n";
    emailBody += "Content-Type: text/plain; charset=utf-8\r\n";
    emailBody += "Content-Transfer-Encoding: 8bit\r\n";
    emailBody += "\r\n";
    emailBody += textBody + "\r\n";
    emailBody += "--" + boundary + "\r\n";
    emailBody += "Content-Type: text/html; charset=utf-8\r\n";
    emailBody += "Content-Transfer-Encoding: 8bit\r\n";
    emailBody += "\r\n";
    emailBody += htmlBody + "\r\n";
    emailBody += "--" + boundary + "--\r\n";

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
        std::string textBody = alert.message + "\n\n项目: " + alert.project_id +
                               "\n类型: " + alert.alert_type +
                               "\n级别: " + alert.severity +
                               "\n时间: " + alert.created_at;
        std::string htmlBody = buildAlertHtml(alert);

        auto channels = pg_.getAlertChannels(alert.project_id);

        for (const auto& ch : channels) {
            if (ch.type == "email" && ch.verified) {
                sendEmail(ch.address, subject, textBody, htmlBody);
            } else if (ch.type == "webhook") {
                std::string json = buildAlertJson(alert);
                sendWebhook(ch.address, json);
            }
        }

        // 无论是否外发成功都标记为 sent（站内通知已写入）
        // 避免重复处理；外发失败仅在 sendEmail/sendWebhook 内记录日志
        pg_.markAlertSent(alert.id);
        ++sent;
    }

    logMsg("Alert dispatch complete: " + std::to_string(sent) + " sent");
}

} // namespace oxelia51
