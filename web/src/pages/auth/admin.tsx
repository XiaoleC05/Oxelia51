import { FilingInfo } from "@/src/components/FilingInfo";
import { AuthBrandLogo } from "@/src/pages/auth/sign-in";
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
import { PasswordInput } from "@/src/components/ui/password-input";
import { api } from "@/src/utils/api";
import { captureUnknownError } from "@/src/utils/captureUnknownError";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const credentialAuthForm = z.object({
  email: z.email(),
  password: z.string().min(8, {
    message: "密码至少需要8个字符",
  }),
});

/**
 * Oxelia51 管理员专有登录页（/auth/admin）。
 * 与普通登录页分离：仅邮箱+密码单步表单，无 SSO / 注册 / 营销内容。
 * 登录成功后通过 whoami 校验管理员身份，非管理员立即登出。
 */
export default function AdminSignIn() {
  const router = useRouter();
  const session = useSession();
  const utils = api.useUtils();
  const [formError, setFormError] = useState<string | null>(null);
  // 已登录用户打开本页时，先校验是否已是管理员
  const [checkingSession, setCheckingSession] = useState<boolean>(
    session.status === "authenticated",
  );

  // 已登录用户：已是管理员直接进 /admin；非管理员停留表单（允许切换账户）
  useEffect(() => {
    if (session.status !== "authenticated") {
      setCheckingSession(false);
      return;
    }
    let cancelled = false;
    utils.oxelia51Admin.whoami
      .fetch(undefined, { staleTime: 0 })
      .then((whoami) => {
        if (cancelled) return;
        if (whoami.isAdmin) {
          void router.replace("/admin");
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, utils, router]);

  const form = useForm({
    resolver: zodResolver(credentialAuthForm),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof credentialAuthForm>) {
    setFormError(null);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        callbackUrl: "/admin",
        redirect: false,
      });
      if (result?.ok) {
        // 登录成功后先校验管理员身份；非管理员登出并停留本页。
        // whoami 走 tRPC（cookie 会话），staleTime:0 强制实时查询，避免命中旧缓存。
        try {
          const whoami = await utils.oxelia51Admin.whoami.fetch(undefined, {
            staleTime: 0,
          });
          if (whoami.isAdmin) {
            void router.push("/admin");
          } else {
            setFormError("该账户没有管理员权限");
            await signOut({ redirect: false });
          }
        } catch (error) {
          captureUnknownError("auth.adminSignIn.whoami", error);
          setFormError("无法验证管理员权限，请重试。");
          await signOut({ redirect: false });
        }
        return;
      }
      // 登录失败：统一提示，不区分账户是否存在 / 密码错误
      setFormError("邮箱或密码错误");
    } catch (error) {
      captureUnknownError("auth.adminSignIn.credentials", error);
      setFormError("发生未知错误。");
    }
  }

  return (
    <>
      <Head>
        <title>管理员登录 | Oxelia51</title>
        <meta name="description" content="Oxelia51 管理员安全登录入口" />
      </Head>
      <div className="flex flex-1 flex-col py-6 sm:min-h-full sm:justify-center sm:px-6 sm:py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mx-auto w-fit">
            <AuthBrandLogo />
          </div>
          <h2 className="text-primary mt-4 text-center text-2xl leading-9 font-bold tracking-tight">
            管理员登录
          </h2>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            仅限授权账户
          </p>
        </div>

        <div className="bg-background mt-14 px-6 py-10 shadow-sm sm:mx-auto sm:w-full sm:max-w-[480px] sm:rounded-lg sm:px-10">
          {checkingSession ? (
            <div className="flex justify-center py-6">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <Form {...form}>
                <form
                  className="space-y-6"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="admin@example.com"
                            allowPasswordManager
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <PasswordInput {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    loading={form.formState.isSubmitting}
                    disabled={
                      form.watch("email") === "" ||
                      form.watch("password") === "" ||
                      // 提交期间禁止重复点击，避免二次提交
                      form.formState.isSubmitting
                    }
                    data-testid="submit-admin-sign-in-form"
                  >
                    登录
                  </Button>
                </form>
              </Form>
              {formError ? (
                <div className="text-destructive text-center text-sm font-bold">
                  {formError}
                </div>
              ) : null}
            </div>
          )}

          <p className="text-muted-foreground mt-10 text-center text-sm">
            <Link
              href="/auth/sign-in"
              className="text-link hover:text-link-hover leading-6 font-bold"
            >
              返回用户登录
            </Link>
          </p>
        </div>

        <div className="mt-6 flex justify-center pb-4">
          <FilingInfo variant="full" />
        </div>
      </div>
    </>
  );
}
