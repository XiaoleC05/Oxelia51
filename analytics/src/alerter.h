#pragma once

#include <string>

#include "db/postgres.h"

namespace oxelia51 {

// 告警分发器：读取 pending 告警，通过邮件 + Webhook 外发，标记 sent
class Alerter {
public:
    // smtpUrl: SMTP_CONNECTION_URL（如 smtps://user:pass@smtp.example.com:465），空则跳过邮件
    // emailFrom: 发件人地址（如 EMAIL_FROM_ADDRESS），空则跳过邮件
    Alerter(PostgresClient& pg,
            const std::string& smtpUrl,
            const std::string& emailFrom);

    // 分发所有 pending 告警：站内已写，这里只做邮件 + Webhook 外发
    void sendPendingAlerts();

private:
    PostgresClient& pg_;
    std::string smtpUrl_;
    std::string emailFrom_;

    bool sendEmail(const std::string& to,
                   const std::string& subject,
                   const std::string& body);
    bool sendWebhook(const std::string& url, const std::string& jsonPayload);
    std::string buildAlertHtml(const std::string& subject,
                               const std::string& content) const;
    std::string buildAlertJson(const Alert& alert) const;

    static std::string jsonEscape(const std::string& s);
};

} // namespace oxelia51
