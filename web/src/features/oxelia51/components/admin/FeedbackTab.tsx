"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/src/utils/api";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { SegmentedControl } from "@/src/features/oxelia51/components/SegmentedControl";
import {
  AdminCard,
  FEEDBACK_CATEGORY_LABEL,
  FEEDBACK_CATEGORY_VARIANT,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STATUS_VARIANT,
  errMsg,
  useIsSuperAdmin,
  type FeedbackItem,
} from "@/src/features/oxelia51/components/admin/shared";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

type StatusFilter = "" | "new" | "processing" | "done";

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "", label: "全部" },
  { value: "new", label: "新反馈" },
  { value: "processing", label: "处理中" },
  { value: "done", label: "已完成" },
];

/** 状态的下一个流转目标及操作文案 */
const NEXT_STATUS: Record<
  string,
  { to: "processing" | "done"; label: string }
> = {
  new: { to: "processing", label: "开始处理" },
  processing: { to: "done", label: "标记完成" },
};

/** 用户反馈：列表 + 状态筛选 + 状态流转 + 邮件回复（写操作仅超级管理员可见） */
export function FeedbackTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [opError, setOpError] = useState("");

  // 回复：对话框目标 + 回复正文 + 对话框内错误
  const [replyTarget, setReplyTarget] = useState<FeedbackItem | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyError, setReplyError] = useState("");

  const feedbackQ = api.oxelia51Admin.listFeedback.useQuery({
    limit: 100,
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const feedback = feedbackQ.data?.items as FeedbackItem[] | undefined;

  const utils = api.useUtils();
  const updateMut = api.oxelia51Admin.updateFeedbackStatus.useMutation({
    onSuccess: () => {
      void utils.oxelia51Admin.listFeedback.invalidate();
    },
    onError: (e) => setOpError(e.message),
  });

  const replyMut = api.oxelia51Admin.replyFeedback.useMutation({
    onSuccess: () => {
      setReplyTarget(null);
      setReplyMessage("");
      setReplyError("");
      void utils.oxelia51Admin.listFeedback.invalidate();
      showSuccessToast({
        title: "回复已发送",
        description: "回复邮件已发出，该反馈已标记为已完成。",
      });
    },
    onError: (e) => setReplyError(e.message),
  });

  const openReplyDialog = (f: FeedbackItem) => {
    setReplyTarget(f);
    setReplyMessage("");
    setReplyError("");
  };

  return (
    <>
      <AdminCard
        title={`用户反馈（最近 100 条，当前 ${feedback?.length ?? "…"} 条）`}
        action={
          <div className="flex items-center gap-2">
            <SegmentedControl
              options={FILTER_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void feedbackQ.refetch();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      >
        {opError && (
          <p className="text-sm" style={{ color: "var(--ox-danger)" }}>
            {opError}
          </p>
        )}
        {feedbackQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(feedbackQ.error)}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">分类</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>内容</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-36">时间</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody className="ox-stagger">
              {(feedback ?? []).map((f) => {
                const next = NEXT_STATUS[f.status];
                return (
                  <TableRow key={f.id}>
                    <TableCell>
                      <Badge
                        variant={
                          FEEDBACK_CATEGORY_VARIANT[f.category] ?? "outline"
                        }
                      >
                        {FEEDBACK_CATEGORY_LABEL[f.category] ?? f.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{f.email}</TableCell>
                    <TableCell className="max-w-md">
                      <span className="line-clamp-2 text-xs whitespace-pre-wrap">
                        {f.message}
                      </span>
                      {f.projectId && (
                        <span
                          className="text-muted-foreground block text-xs"
                          title={f.projectId}
                        >
                          项目：{f.projectName ?? `${f.projectId.slice(0, 8)}…`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={FEEDBACK_STATUS_VARIANT[f.status] ?? "outline"}
                      >
                        {FEEDBACK_STATUS_LABEL[f.status] ?? f.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {f.createdAt
                        ? new Date(f.createdAt).toLocaleString("zh-CN")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOpError("");
                              openReplyDialog(f);
                            }}
                          >
                            回复
                          </Button>
                          {next && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={updateMut.isPending}
                              onClick={() => {
                                setOpError("");
                                updateMut.mutate({ id: f.id, status: next.to });
                              }}
                            >
                              {next.label}
                            </Button>
                          )}
                        </div>
                      ) : (
                        next && (
                          <span
                            className="text-muted-foreground text-xs"
                            title="仅超级管理员可操作"
                          >
                            —
                          </span>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(feedback ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center text-sm"
                  >
                    暂无反馈
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      {/* 回复反馈：原反馈只读摘要 + 回复正文，发送后状态置为已完成 */}
      <Dialog
        open={replyTarget !== null}
        onOpenChange={(open) => {
          if (!open && !replyMut.isPending) setReplyTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>回复反馈</DialogTitle>
            <DialogDescription>
              回复将以邮件发送至 {replyTarget?.email}
              ，发送成功后该反馈自动标记为已完成。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {replyTarget && (
              <div className="rounded-md border p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge
                    variant={
                      FEEDBACK_CATEGORY_VARIANT[replyTarget.category] ??
                      "outline"
                    }
                  >
                    {FEEDBACK_CATEGORY_LABEL[replyTarget.category] ??
                      replyTarget.category}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {replyTarget.createdAt
                      ? new Date(replyTarget.createdAt).toLocaleString("zh-CN")
                      : ""}
                  </span>
                </div>
                <p className="text-muted-foreground max-h-32 overflow-y-auto text-xs whitespace-pre-wrap">
                  {replyTarget.message}
                </p>
              </div>
            )}
            <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder="输入回复内容（1-2000 字），邮件中将按换行分段展示"
            />
            {replyError && (
              <p className="text-sm" style={{ color: "var(--ox-danger)" }}>
                {replyError}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={replyMut.isPending}
              onClick={() => setReplyTarget(null)}
            >
              取消
            </Button>
            <Button
              loading={replyMut.isPending}
              disabled={!replyMessage.trim()}
              onClick={() => {
                if (replyTarget)
                  replyMut.mutate({
                    feedbackId: replyTarget.id,
                    message: replyMessage.trim(),
                  });
              }}
            >
              发送回复
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
