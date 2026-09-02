import { env } from "@/src/env.mjs";

/**
 * 当前部署的 Langfuse Cloud 区域（纯环境变量判定，与组织/项目无关）。
 * 自托管（未配置 NEXT_PUBLIC_LANGFUSE_CLOUD_REGION）时 isLangfuseCloud=false。
 */
export const useLangfuseCloudRegion = () => {
  const region = env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION ?? undefined;

  if (!region) {
    return {
      isLangfuseCloud: false,
      region: undefined,
    } as const;
  }

  return {
    isLangfuseCloud: true,
    region,
  } as const;
};
