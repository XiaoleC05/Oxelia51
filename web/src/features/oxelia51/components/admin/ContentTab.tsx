"use client";

import { useState } from "react";
import { api } from "@/src/utils/api";
import {
  AdminCard,
  errMsg,
  useIsSuperAdmin,
} from "@/src/features/oxelia51/components/admin/shared";
import {
  SITE_CONTENT_DEFAULTS,
  SITE_CONTENT_META,
} from "@/src/features/oxelia51/content/defaults";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Textarea } from "@/src/components/ui/textarea";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

const KEYS = Object.keys(SITE_CONTENT_META);

/**
 * 管理台「内容编辑」：编辑站点可配置内容（更新日志 / 首页 Hero / 首页 FAQ）。
 * 内容存 oxelia51.site_content（JSONB，siteContentRouter），保存后页面即时读取生效
 * （缺省回退 content/defaults.ts 的硬编码默认值）。仅超级管理员可保存。
 */
export function ContentTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  // 每张卡片独立的保存错误（展示在对应卡片内）
  const [errors, setErrors] = useState<Record<string, string>>({});

  const utils = api.useUtils();
  const getQ = api.useQueries((t) =>
    KEYS.map((key) => t.siteContent.get({ key })),
  );

  const update = api.siteContent.update.useMutation();

  const currentValue = (key: string): string => {
    if (drafts[key] !== undefined) return drafts[key];
    const idx = KEYS.indexOf(key);
    const data = getQ[idx]?.data;
    return JSON.stringify(data ?? SITE_CONTENT_DEFAULTS[key], null, 2);
  };

  /** 草稿与已保存内容不一致即视为有未保存的更改（含「载入默认」后未保存） */
  const isDirty = (key: string): boolean => {
    if (drafts[key] === undefined) return false;
    const idx = KEYS.indexOf(key);
    const data = getQ[idx]?.data;
    return (
      drafts[key] !==
      JSON.stringify(data ?? SITE_CONTENT_DEFAULTS[key], null, 2)
    );
  };

  const loadDefault = (key: string) => {
    setDrafts((d) => ({
      ...d,
      [key]: JSON.stringify(SITE_CONTENT_DEFAULTS[key], null, 2),
    }));
  };

  const handleSave = async (key: string) => {
    setErrors((e) => ({ ...e, [key]: "" }));
    setSaving(key);
    try {
      const content = JSON.parse(drafts[key] ?? currentValue(key));
      await update.mutateAsync({ key, content });
      setDrafts((d) => ({ ...d, [key]: JSON.stringify(content, null, 2) }));
      // 让服务端值与草稿同步，isDirty 随即清零
      await utils.siteContent.get.invalidate({ key });
      showSuccessToast({ title: "已保存", description: "页面即时生效" });
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [key]: errMsg(e as { message?: string }) || "JSON 解析失败或保存出错",
      }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {KEYS.map((key) => {
        const meta = SITE_CONTENT_META[key];
        return (
          <AdminCard
            key={key}
            title={
              <span className="flex items-center gap-2">
                {meta.label}
                {isDirty(key) && (
                  <Badge variant="secondary">未保存的更改</Badge>
                )}
              </span>
            }
            description={`${meta.description}（key: ${key}）`}
          >
            <Textarea
              value={currentValue(key)}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [key]: e.target.value }))
              }
              rows={12}
              className="font-mono text-xs"
              spellCheck={false}
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void handleSave(key);
                }}
                loading={saving === key}
                disabled={!isSuperAdmin}
                title={isSuperAdmin ? undefined : "仅超级管理员可保存"}
              >
                保存
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadDefault(key)}
              >
                载入默认
              </Button>
              <span className="text-muted-foreground text-xs">
                {isSuperAdmin ? "编辑后保存即时生效" : "仅超级管理员可编辑内容"}
              </span>
            </div>
            {errors[key] && (
              <p className="text-sm" style={{ color: "var(--ox-danger)" }}>
                {errors[key]}
              </p>
            )}
          </AdminCard>
        );
      })}
    </div>
  );
}
