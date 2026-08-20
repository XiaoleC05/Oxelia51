"use client";

import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  Search,
} from "lucide-react";
import { api } from "@/src/utils/api";
import { useDebounce } from "@/src/hooks/useDebounce";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  AdminCard,
  errMsg,
  useIsSuperAdmin,
  type UserItem,
} from "@/src/features/oxelia51/components/admin/shared";
import { OrphanedDataSection } from "@/src/features/oxelia51/components/admin/OrphanedDataSection";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

const PAGE_SIZE = 20;

/** 平台管理员状态由服务端邮箱名单判定（adminAuth.ts），UI 不再依赖 langfuse 组织/角色。 */

/**
 * 用户管理：管理员名单说明 + 平台用户列表（搜索 / 分页 / 行展开详情）。
 * 管理员由服务端环境变量驱动，此处不做任何增删管理员的 UI。
 * 重置密码 / 删除用户为写操作，仅超级管理员可见（服务端 superAdminProcedure 兜底）。
 */
export function UsersTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const utils = api.useUtils();

  // 搜索：输入即时受控，防抖后才触发查询并回到第一页
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const applySearch = useDebounce(
    (v: string) => {
      setSearch(v);
      setPage(0);
    },
    300,
    false,
  );

  const usersQ = api.oxelia51Admin.usersList.useQuery(
    {
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    // 翻页/搜索时保留上一页数据，避免表格闪烁
    { placeholderData: (prev) => prev },
  );
  const users = usersQ.data?.items as UserItem[] | undefined;
  const total = usersQ.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [opError, setOpError] = useState("");
  // 行展开详情：同时只展开一行
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 重置密码：确认对话框目标 + 成功后的临时密码（仅本次展示）
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [resetResult, setResetResult] = useState<{
    email: string | null;
    tempPassword: string;
  } | null>(null);

  // 删除用户：对话框目标 + 邮箱确认输入 + 对话框内错误
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const resetMut = api.oxelia51Admin.adminResetUserPassword.useMutation({
    onSuccess: (data) => {
      setResetTarget(null);
      setResetResult(data);
    },
    onError: (e) => {
      setResetTarget(null);
      setOpError(e.message);
    },
  });

  const deleteMut = api.oxelia51Admin.adminDeleteUser.useMutation({
    onSuccess: (data) => {
      setDeleteTarget(null);
      setDeleteConfirmEmail("");
      setDeleteError("");
      void utils.oxelia51Admin.usersList.invalidate();
      void utils.oxelia51Admin.listOrphanedOrgs.invalidate();
      void utils.oxelia51Admin.listEmptyProjects.invalidate();
      const cascaded = data.deletedOrganizations ?? [];
      showSuccessToast({
        title: "用户已删除",
        description:
          cascaded.length > 0
            ? `${data.email ?? "该用户"} 已删除，并级联删除 ${cascaded.length} 个空组织：${cascaded.join("、")}。`
            : `${data.email ?? "该用户"} 及其关联数据已删除。`,
      });
    },
    onError: (e) => setDeleteError(e.message),
  });

  const openDeleteDialog = (u: UserItem) => {
    setDeleteTarget(u);
    setDeleteConfirmEmail("");
    setDeleteError("");
  };

  const colSpan = isSuperAdmin ? 6 : 5;

  return (
    <div className="flex flex-col gap-4">
      <AdminCard
        title={`平台用户（${usersQ.data ? total : "…"}）`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  applySearch(e.target.value);
                }}
                placeholder="搜索邮箱 / 姓名"
                className="h-8 w-44 pl-7 text-xs sm:w-56"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void usersQ.refetch();
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
        {usersQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(usersQ.error)}
          </p>
        ) : (
          <>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>邮箱</TableHead>
                  <TableHead className="w-28">姓名</TableHead>
                  <TableHead className="w-20">权限</TableHead>
                  <TableHead className="w-24">注册时间</TableHead>
                  {isSuperAdmin && (
                    <TableHead className="w-40 text-right">操作</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="ox-stagger">
                {(users ?? []).map((u) => (
                  <Fragment key={u.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title={expandedId === u.id ? "收起详情" : "展开详情"}
                          onClick={() =>
                            setExpandedId(expandedId === u.id ? null : u.id)
                          }
                        >
                          {expandedId === u.id ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span
                            className="truncate"
                            title={u.email ?? undefined}
                          >
                            {u.email ?? "—"}
                          </span>
                          {u.isPlatformSuperAdmin && (
                            <Badge variant="secondary" className="shrink-0">
                              管理员
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell
                        className="truncate"
                        title={u.name ?? undefined}
                      >
                        {u.name || "—"}
                      </TableCell>
                      <TableCell>
                        {u.isPlatformSuperAdmin ? (
                          <Badge variant="secondary" size="sm">
                            超级管理员
                          </Badge>
                        ) : u.isPlatformAdmin ? (
                          <Badge variant="outline" size="sm">
                            平台管理员
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            普通用户
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("zh-CN")
                          : "—"}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="重置为该用户的登录密码（仅超级管理员可操作）"
                              onClick={() => {
                                setOpError("");
                                setResetTarget(u);
                              }}
                            >
                              重置密码
                            </Button>
                            {/* 超级管理员账户不提供删除入口（服务端另有保护） */}
                            {!u.isPlatformSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="永久删除该用户（仅超级管理员可操作）"
                                style={{ color: "var(--ox-danger)" }}
                                onClick={() => {
                                  setOpError("");
                                  openDeleteDialog(u);
                                }}
                              >
                                删除
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {expandedId === u.id && (
                      <TableRow>
                        <TableCell
                          colSpan={colSpan}
                          className="bg-muted/30 px-4 py-3"
                        >
                          <div className="flex flex-col gap-2 text-xs">
                            <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
                              <span>
                                用户 ID：
                                <code className="font-mono select-all">
                                  {u.id}
                                </code>
                              </span>
                              <span>
                                注册：
                                {u.created_at
                                  ? new Date(u.created_at).toLocaleString(
                                      "zh-CN",
                                    )
                                  : "—"}
                              </span>
                              <span>
                                最近更新：
                                {u.updated_at
                                  ? new Date(u.updated_at).toLocaleString(
                                      "zh-CN",
                                    )
                                  : "—"}
                              </span>
                            </div>
                            <span>
                              平台权限：
                              {u.isPlatformSuperAdmin
                                ? "超级管理员"
                                : u.isPlatformAdmin
                                  ? "平台管理员"
                                  : "普通用户"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
                {(users ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={colSpan}
                      className="text-muted-foreground text-center text-sm"
                    >
                      {search ? "没有匹配的用户" : "暂无用户数据"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                共 {total} 个用户 · 第 {page + 1} / {pageCount} 页
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || usersQ.isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pageCount || usersQ.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </AdminCard>

      {/* 废弃数据清理：废弃组织 + 空项目（清单确认后逐项删除） */}
      <OrphanedDataSection />

      {/* 重置密码：二次确认 */}
      <AlertDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重置用户密码</AlertDialogTitle>
            <AlertDialogDescription>
              将为 <b>{resetTarget?.email}</b> 生成一个 12
              位临时密码，原密码立即失效。
              临时密码仅显示一次，需由您转交用户。确认继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetMut.isPending}
              onClick={() => {
                if (resetTarget) resetMut.mutate({ userId: resetTarget.id });
              }}
            >
              {resetMut.isPending ? "重置中…" : "确认重置"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重置成功：临时密码仅显示一次 + 一键复制 */}
      <Dialog
        open={resetResult !== null}
        onOpenChange={(open) => {
          if (!open) setResetResult(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>临时密码已生成</DialogTitle>
            <DialogDescription>
              用户 {resetResult?.email} 的密码已重置。
              临时密码仅显示一次，关闭后无法再次查看，请立即转交用户并提醒其尽快修改密码。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border px-2 py-1 font-mono text-sm select-all">
                {resetResult?.tempPassword}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!resetResult) return;
                  void navigator.clipboard.writeText(resetResult.tempPassword);
                  showSuccessToast({
                    title: "已复制",
                    description: "临时密码已复制到剪贴板。",
                  });
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                复制
              </Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>我已妥善保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除用户：输入邮箱二次确认 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMut.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除用户</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除用户 <b>{deleteTarget?.email}</b>{" "}
              及其会员关系等关联数据，不可恢复。请输入该用户的邮箱地址以确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder={deleteTarget?.email ?? ""}
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            autoComplete="off"
          />
          {deleteError && (
            <p className="text-sm" style={{ color: "var(--ox-danger)" }}>
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              取消
            </AlertDialogCancel>
            {/* 不用 AlertDialogAction：失败时需停留在对话框内展示错误 */}
            <Button
              variant="destructive"
              loading={deleteMut.isPending}
              disabled={
                deleteConfirmEmail.trim() !== (deleteTarget?.email ?? "")
              }
              onClick={() => {
                if (deleteTarget) deleteMut.mutate({ userId: deleteTarget.id });
              }}
            >
              确认删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
