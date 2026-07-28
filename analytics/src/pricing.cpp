#include "pricing.h"

#include "db/postgres.h"

#include <cstdlib>
#include <libpq-fe.h>

namespace oxelia51 {

Pricing::Pricing(PostgresClient& pg) {
    loadBuiltinFallback();
    try {
        loadFromDB(pg);
    } catch (...) {
        // DB 读取失败时使用内置兜底定价
    }
}

void Pricing::loadBuiltinFallback() {
    // 与 migration 002 中的初始数据保持一致
    pricing_["claude-sonnet-5"] = {"claude-sonnet-5", "anthropic", 3.00, 15.00};
    pricing_["gpt-4o"]          = {"gpt-4o",          "openai",    2.50, 10.00};
    pricing_["deepseek-chat"]   = {"deepseek-chat",   "deepseek",   0.14,  0.28};
}

void Pricing::loadFromDB(PostgresClient& pg) {
    const char* sql =
        "SELECT model, provider, prompt_price_usd, completion_price_usd "
        "FROM oxelia51.model_pricing";
    PGresult* res = pg.exec(sql);
    int n = PQntuples(res);
    for (int i = 0; i < n; ++i) {
        PricingInfo info;
        info.model = PQgetvalue(res, i, 0);
        info.provider = PQgetvalue(res, i, 1) ? PQgetvalue(res, i, 1) : "";
        info.prompt_price_usd = std::stod(PQgetvalue(res, i, 2));
        info.completion_price_usd = std::stod(PQgetvalue(res, i, 3));
        pricing_[info.model] = std::move(info);
    }
    PQclear(res);
}

double Pricing::calculate(const std::string& model,
                          uint64_t prompt, uint64_t completion) const {
    auto it = pricing_.find(model);
    if (it == pricing_.end()) {
        return 0.0;
    }
    const auto& p = it->second;
    return (prompt / 1'000'000.0) * p.prompt_price_usd
         + (completion / 1'000'000.0) * p.completion_price_usd;
}

} // namespace oxelia51
