"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { MessageSquare } from "lucide-react";
import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";

const CATEGORIES = [
  { value: "feature", label: "功能建议" },
  { value: "bug", label: "Bug 反馈" },
  { value: "other", label: "其他" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Oxelia51 意见反馈：写入 oxelia51.feedback，
 * 提交后通知运营（receive@oxelia51.com）+ 自动回复用户邮箱。
 *
 * 默认渲染侧栏圆形图标触发按钮；通过 `trigger` 可自定义触发元素
 * （例如支持抽屉里的「提交反馈」按钮）。
 */
export function FeedbackDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const projectId =
    typeof router.query.projectId === "string"
      ? router.query.projectId
      : undefined;

  const [category, setCategory] = useState<Category>("feature");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  // 邮箱预填当前登录用户（可改）；已手动输入过则不覆盖
  useEffect(() => {
    const sessionEmail = session?.user?.email;
    if (sessionEmail) setEmail((prev) => prev || sessionEmail);
  }, [session]);

  const submit = api.oxelia51.submitFeedback.useMutation({
    onSuccess: () => {
      setMessage("");
      setOpen(false);
      showSuccessToast({
        title: "已收到反馈",
        description: "感谢你的反馈，我们会尽快通过邮件回复你。",
      });
    },
  });

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit =
    emailValid && message.trim().length > 0 && !submit.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="意见反馈"
                className="flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 hover:rotate-[20deg]"
                style={{
                  borderColor: "var(--ox-border)",
                  color: "var(--ox-text-muted)",
                  background: "var(--ox-bg)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--ox-accent)";
                  e.currentTarget.style.color = "var(--ox-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--ox-border)";
                  e.currentTarget.style.color = "var(--ox-text-muted)";
                }}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">意见反馈</TooltipContent>
        </Tooltip>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>意见反馈</DialogTitle>
          <DialogDescription>
            告诉我们你的想法或遇到的问题，我们会通过邮件回复你。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-category">分类</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
            >
              <SelectTrigger id="feedback-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-email">联系邮箱</Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="用于接收我们的回复"
            />
            {email.length > 0 && !emailValid && (
              <p className="text-xs" style={{ color: "var(--ox-danger)" }}>
                邮箱格式不正确
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-message">反馈内容</Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="请描述你的建议或问题…"
              rows={5}
              maxLength={2000}
            />
          </div>
          {submit.isError && (
            <p className="text-sm" style={{ color: "var(--ox-danger)" }}>
              {submit.error?.message ?? "提交失败，请重试。"}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submit.isPending}
          >
            取消
          </Button>
          <Button
            onClick={() =>
              submit.mutate({
                category,
                email: email.trim(),
                message,
                projectId,
              })
            }
            disabled={!canSubmit}
            loading={submit.isPending}
          >
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
