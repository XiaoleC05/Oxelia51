#pragma once

#include <chrono>
#include <cstdio>
#include <ctime>
#include <string>

namespace oxelia51 {

// 统一日志输出（写 stderr，供 systemd journal 捕获）：
// 格式 "[YYYY-MM-DD HH:MM:SS] msg"（UTC），带 fflush 保证 journal 及时可见。
// 原 aggregator.cpp / alerter.cpp 各有一份静态副本，2026-08-18 收口至此。
inline std::string timestamp() {
    auto now = std::chrono::system_clock::now();
    auto t = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
    gmtime_r(&t, &tm);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &tm);
    return buf;
}

inline void logMsg(const std::string& msg) {
    std::fprintf(stderr, "[%s] %s\n", timestamp().c_str(), msg.c_str());
    std::fflush(stderr);
}

} // namespace oxelia51
