#include "detector.h"

namespace oxelia51 {

// 无历史数据时的绝对阈值（有意硬编码的兜底默认值：
// 仅在昨日基线为 0 时生效；有基线时走 spike_ratio 相对检测）
static constexpr uint64_t ABSOLUTE_THRESHOLD = 10'000;

bool Detector::isAnomalous(uint64_t current, uint64_t baseline,
                           const AnomalyConfig& config) const {
    if (!config.enabled) return false;
    if (baseline == 0) {
        return current > ABSOLUTE_THRESHOLD;
    }
    return static_cast<double>(current) > static_cast<double>(baseline) * config.spike_ratio;
}

} // namespace oxelia51
