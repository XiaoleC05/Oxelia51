"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/src/utils/api";
import { Button } from "@/src/components/ui/button";
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
  AdminCard,
  errMsg,
  useIsSuperAdmin,
} from "@/src/features/oxelia51/components/admin/shared";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

type OrphanedOrg = {
  id: string;
  name: string;
  createdAt: Date;
  projectCount: number;
};
type EmptyProject = {
  id: string;
  name: string;
  orgName: string;
  createdAt: Date;
};

/**
 * 废弃数据清理：废弃组织（无成员）+ 空项目（无 trace 数据、无项目级成员）。
 * 两个只读清单 + 逐项删除（AlertDialog 二次确认）；删除仅超级管理员可见
 * （服务端 superAdminProcedure 兜底）。
 */
export function OrphanedDataSection() {
  const isSuperAdmin = useIsSuperAdmin();
  const utils = api.useUtils();

  const [opError, setOpError] = useState("");
  const [orgTarget, setOrgTarget] = useState<OrphanedOrg | null>(null);
  const [projectTarget, setProjectTarget] = useState<EmptyProject | null>(null);

  const orgsQ = api.oxelia51Admin.listOrphanedOrgs.useQuery();
  const projectsQ = api.oxelia51Admin.listEmptyProjects.useQuery();
  const orgs = (orgsQ.data?.items ?? []) as OrphanedOrg[];
  const projects = (projectsQ.data?.items ?? []) as EmptyProject[];

  const invalidateBoth = () => {
    void utils.oxelia51Admin.listOrphanedOrgs.invalidate();
    void utils.oxelia51Admin.listEmptyProjects.invalidate();
  };

  const deleteOrgMut = api.oxelia51Admin.deleteOrphanedOrg.useMutation({
    onSuccess: (data) => {
      setOrgTarget(null);
      invalidateBoth();
      showSuccessToast({
        title: "废弃组织已删除",
        description: `组织「${data.name}」及其项目已删除。`,
      });
    },
    onError: (e) => {
      setOrgTarget(null);
      setOpError(e.message);
    },
  });

  const deleteProjectMut = api.oxelia51Admin.deleteEmptyProject.useMutation({
    onSuccess: (data) => {
      setProjectTarget(null);
      invalidateBoth();
      showSuccessToast({
        title: "空项目已删除",
        description: `项目「${data.name}」已删除。`,
      });
    },
    onError: (e) => {
      setProjectTarget(null);
      setOpError(e.message);
    },
  });

  return (
    <>
      {/* 废弃组织（无成员） */}
      <AdminCard
        title={`废弃组织（${orgsQ.data ? orgs.length : "…"}）`}
        description="无任何成员的组织。删除会连带删除其下所有项目，请逐项确认。"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void orgsQ.refetch();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {opError && (
          <p className="text-sm" style={{ color: "var(--ox-danger)" }}>
            {opError}
          </p>
        )}
        {orgsQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(orgsQ.error)}
          </p>
        ) : orgs.length === 0 ? (
          <p className="text-muted-foreground text-sm">没有废弃组织</p>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>组织名</TableHead>
                <TableHead className="w-20">项目数</TableHead>
                <TableHead className="w-24">创建时间</TableHead>
                {isSuperAdmin && (
                  <TableHead className="w-20 text-right">操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="truncate" title={o.name}>
                    {o.name}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {o.projectCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {o.createdAt
                      ? new Date(o.createdAt).toLocaleDateString("zh-CN")
                      : "—"}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="删除该组织及其项目（仅超级管理员可操作）"
                        style={{ color: "var(--ox-danger)" }}
                        onClick={() => {
                          setOpError("");
                          setOrgTarget(o);
                        }}
                      >
                        删除
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      {/* 空项目（无 trace 数据、无项目级成员） */}
      <AdminCard
        title={`空项目（${projectsQ.data ? projects.length : "…"}）`}
        description="口径：项目从未收到 trace（has_traces=false）且无项目级成员；仅列出仍有成员的活跃组织下的项目。"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void projectsQ.refetch();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      >
        {projectsQ.error ? (
          <p className="text-sm" style={{ color: "var(--ox-warn)" }}>
            {errMsg(projectsQ.error)}
          </p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground text-sm">没有空项目</p>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>项目名</TableHead>
                <TableHead>所属组织</TableHead>
                <TableHead className="w-24">创建时间</TableHead>
                {isSuperAdmin && (
                  <TableHead className="w-20 text-right">操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="truncate" title={p.name}>
                    {p.name}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground truncate"
                    title={p.orgName}
                  >
                    {p.orgName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString("zh-CN")
                      : "—"}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="删除该空项目（仅超级管理员可操作）"
                        style={{ color: "var(--ox-danger)" }}
                        onClick={() => {
                          setOpError("");
                          setProjectTarget(p);
                        }}
                      >
                        删除
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>

      {/* 删除废弃组织：二次确认 */}
      <AlertDialog
        open={orgTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOrgTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除废弃组织</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除组织 <b>{orgTarget?.name}</b> 及其{" "}
              {orgTarget?.projectCount ?? 0} 个项目，不可恢复。确认继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteOrgMut.isPending}
              onClick={() => {
                if (orgTarget) deleteOrgMut.mutate({ orgId: orgTarget.id });
              }}
            >
              {deleteOrgMut.isPending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除空项目：二次确认 */}
      <AlertDialog
        open={projectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setProjectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除空项目</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除项目 <b>{projectTarget?.name}</b>
              {projectTarget?.orgName
                ? `（组织「${projectTarget.orgName}」）`
                : ""}
              ，不可恢复。确认继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteProjectMut.isPending}
              onClick={() => {
                if (projectTarget)
                  deleteProjectMut.mutate({ projectId: projectTarget.id });
              }}
            >
              {deleteProjectMut.isPending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
