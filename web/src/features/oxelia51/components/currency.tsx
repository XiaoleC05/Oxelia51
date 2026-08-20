"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/src/utils/api";

/**
 * Oxelia51 币种上下文：CNY / USD 全局切换。
 * 汇率取自 oxelia51.exchange_rates 最新一条（CNY per USD），
 * 数据库存储基准为 USD，显示时按需换算。
 */

export type Currency = "CNY" | "USD";

const CURRENCY_STORAGE_KEY = "oxelia51-currency";

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** 1 USD = rate CNY */
  rate: number;
  isLoading: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "CNY",
  setCurrency: () => undefined,
  rate: 7.2,
  isLoading: true,
});

export function CurrencyProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [currency, setCurrencyState] = useState<Currency>("CNY");
  const exchangeRate = api.oxelia51.exchangeRate.useQuery({ projectId });

  useEffect(() => {
    const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored === "USD" || stored === "CNY") setCurrencyState(stored);
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, c);
  };

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      rate: exchangeRate.data?.rateCnyPerUsd ?? 7.2,
      isLoading: exchangeRate.isLoading,
    }),
    [currency, exchangeRate.data?.rateCnyPerUsd, exchangeRate.isLoading],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

/** USD 金额按当前币种格式化：CNY → ¥x.xx，USD → $x.xx */
export function formatCost(
  costUsd: number,
  currency: Currency,
  rate: number,
): string {
  if (currency === "CNY") {
    return `¥${(costUsd * rate).toFixed(2)}`;
  }
  return `$${costUsd.toFixed(2)}`;
}

/** 另一种币种的等值金额（用于括号内灰色小字） */
export function altCost(costUsd: number, currency: Currency, rate: number) {
  return currency === "CNY"
    ? `$${costUsd.toFixed(2)} USD`
    : `¥${(costUsd * rate).toFixed(2)} CNY`;
}

/** Token 数量千分位格式化 */
export function formatTokens(tokens: number): string {
  return Math.round(tokens).toLocaleString("en-US");
}
