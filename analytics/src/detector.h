#pragma once

#include <cstdint>

namespace oxelia51 {

// 异常检测配置（来自 projects.metadata.oxelia51.anomaly）
struct AnomalyConfig {
    bool enabled = true;
    double spike_ratio = 3.0;   // 同比倍数阈值
};

// 异常检测器：基于同比基线的简单阈值算法
class Detector {
public:
    // 判断当前 token 用量是否异常
    // config.enabled == false：跳过检测
    // baseline == 0（无历史数据）：绝对阈值 10000
    // baseline > 0：当前值 > 基线 * config.spike_ratio 即异常
    bool isAnomalous(uint64_t current, uint64_t baseline,
                     const AnomalyConfig& config) const;
};

} // namespace oxelia51
