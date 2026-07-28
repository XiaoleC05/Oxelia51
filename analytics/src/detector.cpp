#include "detector.h"

namespace oxelia51 {

// 无历史数据时的绝对阈值
static constexpr uint64_t ABSOLUTE_THRESHOLD = 10'000;

// 同比异常倍数
static constexpr double ANOMALY_MULTIPLIER = 3.0;

bool Detector::isAnomalous(uint64_t current, uint64_t baseline) const {
    if (baseline == 0) {
        return current > ABSOLUTE_THRESHOLD;
    }
    return static_cast<double>(current) > static_cast<double>(baseline) * ANOMALY_MULTIPLIER;
}

} // namespace oxelia51
