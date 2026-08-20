"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type EChartProps = {
  option: echarts.EChartsOption;
  height?: number;
  className?: string;
};

/** 轻量 ECharts React 封装：初始化、option 更新、容器自适应、卸载销毁。 */
export function EChart({ option, height = 320, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height }}
    />
  );
}
