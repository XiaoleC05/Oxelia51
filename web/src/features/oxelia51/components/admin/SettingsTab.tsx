"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { StringNoHTML } from "@oxelia51/shared";
import { api } from "@/src/utils/api";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/src/components/ui/form";
import {
  AdminCard,
  useIsSuperAdmin,
} from "@/src/features/oxelia51/components/admin/shared";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

// 与 /account/settings 的修改名称表单同一 schema / mutation / 提示文案，保持一致体验
const displayNameSchema = z.object({
  name: StringNoHTML.min(1, "名称不能为空").max(100, "名称最多 100 个字符"),
});

function UpdateDisplayNameForm() {
  const { data: session, update: updateSession } = useSession();
  const utils = api.useUtils();

  const form = useForm({
    resolver: zodResolver(displayNameSchema),
    defaultValues: {
      name: "",
    },
  });

  const updateDisplayName = api.userAccount.updateDisplayName.useMutation({
    onSuccess: async () => {
      await updateSession();
      await utils.invalidate();
      form.reset();
      showSuccessToast({
        title: "名称已更新",
        description: "您的名称已成功更新。",
      });
    },
    onError: (error) => form.setError("name", { message: error.message }),
  });

  function onSubmit(values: z.infer<typeof displayNameSchema>) {
    updateDisplayName.mutate({ name: values.name });
  }

  return (
    <>
      <p className="text-muted-foreground text-sm">
        当前名称：&quot;<b>{session?.user?.name ?? ""}</b>&quot;
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder={session?.user?.name ?? ""}
                    {...field}
                    className="max-w-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            variant="secondary"
            type="submit"
            loading={updateDisplayName.isPending}
            disabled={form.getValues().name === ""}
            className="mt-4"
          >
            保存
          </Button>
        </form>
      </Form>
    </>
  );
}

/**
 * 设置 Tab：账户信息 + 修改姓名 + 修改密码。
 * 原为独立页面 /admin/settings，现并入 /admin 的 Tab（外层 AdminGate 统一门控，
 * Tab 内不再重复门控）；旧路径由 pages/admin/settings.tsx 重定向到 /admin?tab=settings。
 */
export function SettingsTab() {
  const { data: session } = useSession();
  const isSuperAdmin = useIsSuperAdmin();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <AdminCard title="账户信息" description="当前登录的管理员账户">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">当前邮箱</span>
          <span className="font-mono text-xs tabular-nums sm:text-sm">
            {session?.user?.email ?? "—"}
          </span>
          <Badge variant="secondary">
            {isSuperAdmin ? "超级管理员" : "管理员"}
          </Badge>
        </div>
      </AdminCard>

      <AdminCard title="修改姓名" description="该名称会同步显示在平台各处">
        <UpdateDisplayNameForm />
      </AdminCard>

      <AdminCard title="修改密码" description="通过邮箱安全链接完成密码重置">
        <p className="text-muted-foreground text-sm">
          我们将向您的邮箱发送安全链接，点击下方按钮开始重置密码流程。
        </p>
        <Button asChild variant="secondary" className="self-start">
          <Link href="/auth/reset-password">修改密码</Link>
        </Button>
      </AdminCard>
    </div>
  );
}
