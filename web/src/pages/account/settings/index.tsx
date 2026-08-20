import { PagedSettingsContainer } from "@/src/components/PagedSettingsContainer";
import Header from "@/src/components/layouts/header";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { api } from "@/src/utils/api";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/src/components/ui/form";
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
import { useSession, signOut } from "next-auth/react";
import { SettingsDangerZone } from "@/src/components/SettingsDangerZone";
import ContainerPage from "@/src/components/layouts/container-page";
import { useRouter } from "next/router";
import { StringNoHTML } from "@oxelia51/shared";
import Link from "next/link";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { showErrorToast } from "@/src/features/notifications/showErrorToast";
import Head from "next/head";

const displayNameSchema = z.object({
  name: StringNoHTML.min(1, "名称不能为空").max(100, "名称最多 100 个字符"),
});

function UpdateDisplayName() {
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
    <div>
      <Header title="修改名称" />
      <Card className="p-3">
        {form.getValues().name !== "" ? (
          <p className="text-primary mb-4 text-sm">
            您的名称将从&quot;
            {session?.user?.name ?? ""}
            &quot;更新为&quot;
            <b>{form.watch().name}</b>&quot;。
          </p>
        ) : (
          <p className="text-primary mb-4 text-sm">
            您当前的名称是&quot;
            <b>{session?.user?.name ?? ""}</b>
            &quot;。
          </p>
        )}
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
                      className="flex-1"
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
      </Card>
    </div>
  );
}

function DeleteAccountButton() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";

  const { data: canDeleteData } = api.userAccount.checkCanDelete.useQuery();
  const deleteAccount = api.userAccount.delete.useMutation();

  const formSchema = z.object({
    email: z.string().refine((val) => val === userEmail, {
      message: `请输入您的邮箱地址：${userEmail}`,
    }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const canDelete = canDeleteData?.canDelete ?? false;
  const blockingOrganizations = canDeleteData?.blockingOrganizations ?? [];

  const onSubmit = async () => {
    if (!canDelete) return;
    try {
      await deleteAccount.mutateAsync();
      showSuccessToast({
        title: "账户已删除",
        description: "您的账户已成功删除。",
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await signOut();
    } catch (error) {
      console.error(error);
      showErrorToast(
        "删除账户失败",
        error instanceof Error ? error.message : "发生意外错误",
      );
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive-secondary">删除账户</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">删除账户</DialogTitle>
          <DialogDescription>
            {!canDelete && blockingOrganizations.length > 0 ? (
              <div>
                <p className="mb-2">
                  您无法删除账户，因为您是以下组织中的最后一位所有者：
                </p>
                <ul className="list-inside list-disc space-y-1">
                  {blockingOrganizations.map((org) => (
                    <li key={org.id}>
                      <Link
                        href={`/organization/${org.id}/settings`}
                        className="text-primary hover:text-primary/80 font-bold underline"
                      >
                        {org.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2">
                  删除账户前，请先添加其他所有者或删除这些组织。
                </p>
              </div>
            ) : (
              `如需确认，请在输入框中输入您的邮箱地址“${userEmail}”`
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {canDelete && (
              <DialogBody>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder={userEmail} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogBody>
            )}
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                loading={deleteAccount.isPending}
                disabled={!canDelete}
                className="w-full"
              >
                删除账户
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type AccountSettingsPage = {
  title: string;
  slug: string;
  content: React.ReactNode;
  cmdKKeywords?: string[];
};

export function useAccountSettingsPages(): AccountSettingsPage[] {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";

  return getAccountSettingsPages(userEmail);
}

const getAccountSettingsPages = (userEmail: string): AccountSettingsPage[] => [
  {
    title: "通用",
    slug: "index",
    cmdKKeywords: [
      "account",
      "user",
      "profile",
      "email",
      "password",
      "name",
      "display",
      "delete",
      "remove",
    ],
    content: (
      <div className="flex flex-col gap-6">
        <div>
          <Header title="邮箱" />
          <Card className="p-3">
            <p className="text-primary text-sm">
              您的邮箱地址： <b>{userEmail}</b>
            </p>
          </Card>
        </div>
        <UpdateDisplayName />
        <div>
          <Header title="密码" />
          <Card className="p-3">
            <p className="text-primary mb-4 text-sm">
              我们将向您的邮箱发送安全链接，点击下方按钮开始重置密码流程。
            </p>
            <Button asChild variant="secondary">
              <Link href="/auth/reset-password">修改密码</Link>
            </Button>
          </Card>
        </div>
        <SettingsDangerZone
          items={[
            {
              title: "删除账户",
              description:
                "如果您不是任何组织的最后一位所有者，即可删除账户。如果是最后一位所有者，请先添加其他所有者或删除组织及其全部项目。",
              button: <DeleteAccountButton />,
            },
          ]}
        />
      </div>
    ),
  },
];

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const userEmail = session?.user?.email ?? "";

  const pages = getAccountSettingsPages(userEmail);

  return (
    <>
      <Head>
        <title>账户设置 | Oxelia51</title>
      </Head>
      <ContainerPage
        headerProps={{
          title: "账户设置",
        }}
      >
        <PagedSettingsContainer
          activeSlug={router.query.page as string | undefined}
          pages={pages}
        />
      </ContainerPage>
    </>
  );
}
