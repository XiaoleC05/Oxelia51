#pragma once

#include <cstdint>
#include <map>
#include <string>

namespace oxelia51 {

class PostgresClient;

// 定价信息（每 1M tokens 的 USD 价格）
struct PricingInfo {
    std::string model;
    std::string provider;
    double prompt_price_usd = 0.0;
    double completion_price_usd = 0.0;
};

// 成本计算器：DB 定价表优先，内置默认值兜底
class Pricing {
public:
    explicit Pricing(PostgresClient& pg);

    // 计算单条事件的 USD 成本
    // prompt/completion: token 数量
    // 未知模型返回 0.0
    double calculate(const std::string& model,
                     uint64_t prompt, uint64_t completion) const;

private:
    std::map<std::string, PricingInfo> pricing_;

    void loadFromDB(PostgresClient& pg);
    void loadBuiltinFallback();
};

} // namespace oxelia51
