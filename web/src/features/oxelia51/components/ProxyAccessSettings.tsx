"use client";

import { useState } from "react";
import { api } from "@/src/utils/api";
import { env } from "@/src/env.mjs";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Trash2, Copy } from "lucide-react";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { cn } from "@/src/utils/tailwind";
import type { ProxyKeyItem } from "@/src/features/oxelia51/server/proxyKeyRouter";

const PROVIDERS = [
  "anthropic",
  "openai",
  "deepseek",
  "qwen",
  "gemini",
  "groq",
  "xai",
  "openrouter",
  "zhipu",
] as const;

const PROXY_BASE = env.NEXT_PUBLIC_OXELIA51_PROXY_BASE_URL;

function CopyField({ value, label }: { value: string; label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-muted-foreground text-xs">{label}</span>}
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded border px-2 py-1 text-xs">
          {value}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            showSuccessToast({
              title: "已复制",
              description: "内容已复制到剪贴板。",
            });
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** 代理接入设置：URL / 项目 ID / 密钥 / 分工具配置。 */
export function ProxyAccessSettings({ projectId }: { projectId: string }) {
  const [provider, setProvider] = useState<string>("anthropic");
  const [newKey, setNewKey] = useState<string | null>(null);

  const utils = api.useUtils();
  const keysQ = api.proxyKey.list.useQuery({ projectId });
  const createKey = api.proxyKey.create.useMutation({
    onSuccess: (res) => {
      setNewKey(res.key);
      void utils.proxyKey.list.invalidate();
      showSuccessToast({
        title: "密钥已生成",
        description: "明文仅展示一次，请立即保存。",
      });
    },
  });
  const removeKey = api.proxyKey.remove.useMutation({
    onSuccess: () => {
      void utils.proxyKey.list.invalidate();
      setRemoveTarget(null);
      showSuccessToast({
        title: "已删除",
        description: "项目密钥已删除，使用该密钥的工具将立即无法访问。",
      });
    },
  });
  const [removeTarget, setRemoveTarget] = useState<ProxyKeyItem | null>(null);

  const keys = keysQ.data?.items ?? [];
  const proxyUrl = `${PROXY_BASE}/${provider}`;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <span className="font-heading text-sm font-bold">代理地址</span>
        <p className="text-muted-foreground text-xs">
          把你的模型工具指向下面的地址，Token 消耗将自动统计到本项目。
        </p>
        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={(v) => setProvider(v)}>
            <SelectTrigger className="w-[150px]" aria-label="供应商">
              <SelectValue placeholder="供应商" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CopyField value={proxyUrl} label="代理 URL" />
        </div>
        <CopyField value={projectId} label="项目 ID（X-Project-ID）" />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="font-heading text-sm font-bold">项目密钥</span>
          <Button
            size="sm"
            onClick={() => createKey.mutate({ projectId })}
            loading={createKey.isPending}
          >
            生成新密钥
          </Button>
        </div>
        {newKey && (
          <div className="rounded-md border p-3">
            <span className="text-xs" style={{ color: "var(--ox-warn)" }}>
              新密钥明文（仅显示一次，请立即复制保存）：
            </span>
            <CopyField value={newKey} />
          </div>
        )}
        {keys.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            暂无密钥。生成后工具用它作为 Bearer 令牌。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>前缀</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k: ProxyKeyItem) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-xs">
                    {k.keyPrefix}
                  </TableCell>
                  <TableCell>{k.enabled ? "启用" : "已禁用"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(k.createdAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!k.enabled || removeKey.isPending}
                      onClick={() => setRemoveTarget(k)}
                    >
                      <Trash2
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--ox-danger)" }}
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <span className="font-heading text-sm font-bold">分工具配置</span>
        <ConfigBlock
          title="Claude Code"
          code={`export ANTHROPIC_BASE_URL="${PROXY_BASE}/anthropic"
export ANTHROPIC_API_KEY="${newKey ?? "<你的项目密钥 ox_...>"}"
# 你的真实上游 Anthropic key（可选，经网关透传）：
# export ANTHROPIC_AUTH_TOKEN="sk-ant-<真实key>" 或设置环境变量`}
        />
        <ConfigBlock
          title="OpenAI 兼容（DeepSeek / Qwen / Groq 等）"
          code={`export OPENAI_BASE_URL="${PROXY_BASE}/deepseek"
export OPENAI_API_KEY="${newKey ?? "<你的项目密钥 ox_...>"}"
# 你的真实上游 key（可选）：
# export OPENAI_API_KEY_UPSTREAM="sk-<真实key>" 作为 X-Oxelia51-Upstream-Key`}
        />
        <ConfigBlock
          title="curl 验证"
          code={`curl ${PROXY_BASE}/deepseek/chat/completions \\
  -H "Authorization: Bearer ${newKey ?? "<你的项目密钥>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}]}'`}
        />
        <p className="text-muted-foreground text-xs">
          真实上游模型密钥通过{" "}
          <code className="text-xs">X-Oxelia51-Upstream-Key</code>{" "}
          头传递（Claude Code 用{" "}
          <code className="text-xs">ANTHROPIC_AUTH_TOKEN</code>
          、OpenAI 兼容工具用自定义头）。未设置时上游按你工具原有的密钥配置。
        </p>
      </Card>

      {/* 删除密钥：二次确认（删除即生效不可恢复） */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除项目密钥</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，使用密钥 <b>{removeTarget?.keyPrefix}…</b>{" "}
              的工具将立即无法通过代理访问，且不可恢复。确认继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeKey.isPending}
              onClick={() => {
                if (removeTarget)
                  removeKey.mutate({ projectId, id: removeTarget.id });
              }}
            >
              {removeKey.isPending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConfigBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{title}</span>
      <pre
        className={cn(
          "overflow-x-auto rounded-md border p-3 text-xs leading-5",
          "bg-muted/50",
        )}
      >
        <code>{code}</code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="self-end"
        onClick={() => {
          void navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "已复制" : "复制配置"}
      </Button>
    </div>
  );
}
