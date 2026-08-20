"use client";

import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/src/utils/api";
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
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  AdminCard,
  errMsg,
  useIsSuperAdmin,
  type WhitelistItem,
} from "@/src/features/oxelia51/components/admin/shared";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

/** 安全：IP 白名单增删查、一键添加本机 IP（增删仅超级管理员可见） */
export function SecurityTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const whitelistQ = api.oxelia51Admin.whitelistList.useQuery();
  const whitelist = whitelistQ.data as
    | { items?: WhitelistItem[]; clientIP?: string }
    | undefined;

  const utils = api.useUtils();
  const [opError, setOpError] = useState("");
  // 非错误类的操作提示（如「IP 已在白名单中」），用 muted 样式与错误区分
  const [opInfo, setOpInfo] = useState("");
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");
  // 删除二次确认的目标条目
  const [deleteTarget, setDeleteTarget] = useState<WhitelistItem | null>(null);

  const invalidateWhitelist = () =>
    utils.oxelia51Admin.whitelistList.invalidate();

  const createMut = api.oxelia51Admin.whitelistCreate.useMutation({
    onSuccess: () => {
      setNewIp("");
      setNewLabel("");
      setOpInfo("");
      void invalidateWhitelist();
      showSuccessToast({ title: "已添加", description: "IP 已加入白名单。" });
    },
    onError: (e) => setOpError(e.message),
  });
  const deleteMut = api.oxelia51Admin.whitelistDelete.useMutation({
    onSuccess: () => {
      setDeleteTarget(null);
      void invalidateWhitelist();
      showSuccessToast({
        title: "已删除",
        description: "该 IP 已移出白名单。",
      });
    },
    onError: (e) => setOpError(e.message),
  });

  return (
    <AdminCard
      title="IP 白名单"
      description={`白名单控制高危运维接口（命令执行）的访问来源${whitelist?.clientIP ? `，当前出口 IP：${whitelist.clientIP}` : ""}`}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void whitelistQ.refetch();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {isSuperAdmin ? (
        <div className="flex gap-2">
          <Input
            placeholder="IP 地址"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            className="w-48"
          />
          <Input
            placeholder="备注（可选）"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => {
              setOpError("");
              setOpInfo("");
              createMut.mutate({ ip: newIp.trim(), label: newLabel.trim() });
            }}
            disabled={!newIp.trim() || createMut.isPending}
          >
            添加
          </Button>
          {whitelist?.clientIP && (
            <Button
              variant="outline"
              title={`将当前出口 IP ${whitelist.clientIP} 加入白名单`}
              disabled={createMut.isPending}
              onClick={() => {
                setOpError("");
                // IP 已在白名单：给出明确提示（信息样式）而非禁用按钮（禁用会显示禁止指针）
                if (
                  (whitelist.items ?? []).some(
                    (i) => i.ip === whitelist.clientIP,
                  )
                ) {
                  setOpInfo(`当前出口 IP ${whitelist.clientIP} 已在白名单中`);
                  return;
                }
                setOpInfo("");
                createMut.mutate({
                  ip: whitelist.clientIP!,
                  label: "本机（一键添加）",
                });
              }}
            >
              一键添加本机 IP
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          当前为只读视图，新增 / 删除白名单仅超级管理员可操作。
        </p>
      )}
      {opError && (
        <p className="text-sm" style={{ color: "var(--ox-danger)" }}>
          {opError}
        </p>
      )}
      {opInfo && <p className="text-muted-foreground text-sm">{opInfo}</p>}
      {whitelistQ.error ? (
        <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
          {errMsg(whitelistQ.error)}
        </p>
      ) : whitelistQ.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 text-xs">IP</TableHead>
              <TableHead className="h-8 text-xs">备注</TableHead>
              <TableHead className="h-8 text-xs">添加时间</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody className="ox-stagger">
            {(whitelist?.items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.ip}</TableCell>
                <TableCell>{item.label || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString("zh-CN")
                    : "—"}
                </TableCell>
                <TableCell>
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="删除（仅超级管理员可操作）"
                      onClick={() => {
                        setOpError("");
                        setOpInfo("");
                        setDeleteTarget(item);
                      }}
                    >
                      <Trash2
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--ox-danger)" }}
                      />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(whitelist?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-muted-foreground text-center text-sm"
                >
                  暂无白名单条目
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* 删除白名单条目：二次确认 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMut.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除白名单条目</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，来自 <b>{deleteTarget?.ip}</b>{" "}
              的请求将无法再访问高危运维接口。确认删除？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={() => {
                if (deleteTarget)
                  deleteMut.mutate({ id: String(deleteTarget.id) });
              }}
            >
              {deleteMut.isPending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminCard>
  );
}
