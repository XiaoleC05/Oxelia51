import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { Oxelia51Icon } from "@/src/components/design-system/Oxelia51Icon/Oxelia51Icon";
import { Button } from "@/src/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { env } from "@/src/env.mjs";
import { captureUnknownError } from "@/src/utils/captureUnknownError";

const enterpriseSsoFormSchema = z.object({
  email: z.email(),
});

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  "github-enterprise": "GitHub Enterprise",
  gitlab: "GitLab",
  "azure-ad": "Azure AD",
  okta: "Okta",
  authentik: "Authentik",
  onelogin: "OneLogin",
  auth0: "Auth0",
  cognito: "Cognito",
  keycloak: "Keycloak",
  workos: "WorkOS",
  wordpress: "WordPress",
  custom: "Custom OAuth",
};

export default function EnterpriseSsoRequiredPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailFromQuery =
    typeof router.query.email === "string" ? router.query.email : "";
  const attemptedProvider =
    typeof router.query.attemptedProvider === "string"
      ? router.query.attemptedProvider
      : undefined;
  const callbackUrl =
    typeof router.query.callbackUrl === "string"
      ? router.query.callbackUrl
      : undefined;

  const friendlyProviderName = useMemo(() => {
    if (!attemptedProvider) return undefined;
    return (
      PROVIDER_LABELS[attemptedProvider] ?? attemptedProvider.replace(/-/g, " ")
    );
  }, [attemptedProvider]);

  const form = useForm<z.infer<typeof enterpriseSsoFormSchema>>({
    resolver: zodResolver(enterpriseSsoFormSchema),
    defaultValues: {
      email: emailFromQuery,
    },
  });

  useEffect(() => {
    if (emailFromQuery) {
      form.setValue("email", emailFromQuery);
    }
  }, [emailFromQuery, form]);

  async function onSubmit(values: z.infer<typeof enterpriseSsoFormSchema>) {
    setError(null);
    setLoading(true);

    const domain = values.email.split("@")[1]?.toLowerCase();
    if (!domain) {
      form.setError("email", { message: "邮箱地址无效" });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth/check-sso`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        },
      );

      if (response.ok) {
        const { providerId } = (await response.json()) as {
          providerId: string;
        };
        await signIn(providerId, {
          callbackUrl,
        });
        return;
      }

      if (response.status === 404) {
        setError(
          "未找到此域名的企业单点登录配置，请检查您的公司邮箱或联系管理员。",
        );
        return;
      }

      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(data?.message ?? "无法启动企业单点登录流程，请重试。");
    } catch (err) {
      captureUnknownError("auth.enterpriseSso", err);
      setError("检查企业单点登录配置时出错，请重试。");
    } finally {
      setLoading(false);
    }
  }

  const description = friendlyProviderName
    ? `您尝试使用 ${friendlyProviderName} 登录，但此域名需要使用您公司的企业单点登录。`
    : "此域名需要使用您公司的企业单点登录。";

  return (
    <>
      <Head>
        <title>需要企业单点登录 | Oxelia51</title>
      </Head>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mx-auto w-fit">
            <Oxelia51Icon />
          </div>
          <h1 className="text-primary mt-6 text-center text-2xl font-bold">
            使用企业单点登录
          </h1>
          <p className="text-muted-foreground mt-2 text-center text-sm leading-6">
            {description} 请输入您的公司邮箱，以便将您引导至正确的身份提供商。
          </p>
        </div>

        <div className="border-border bg-card mt-10 rounded-lg border px-6 py-8 shadow-sm sm:mx-auto sm:w-full sm:max-w-md">
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="jsdoe@example.com"
                        allowPasswordManager
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={loading}
              >
                使用企业单点登录继续
              </Button>
            </form>
          </Form>
          {error ? (
            <div className="text-destructive mt-4 text-center text-sm font-bold">
              {error}
              <br />
              联系{" "}
              <a
                href="mailto:receive@oxelia51.com"
                className="text-link hover:text-link-hover"
              >
                receive@oxelia51.com
              </a>{" "}
              如果问题持续出现。
            </div>
          ) : null}
          <div className="text-muted-foreground mt-6 text-center text-sm">
            <Link
              href="/auth/sign-in"
              className="text-link hover:text-link-hover"
            >
              返回其他登录选项
            </Link>
          </div>
        </div>

        <div className="text-muted-foreground mt-4 text-center text-xs">
          需要帮助？请联系{" "}
          <a
            href="mailto:receive@oxelia51.com"
            className="text-link hover:text-link-hover"
          >
            receive@oxelia51.com
          </a>
          .
        </div>
      </div>
    </>
  );
}
