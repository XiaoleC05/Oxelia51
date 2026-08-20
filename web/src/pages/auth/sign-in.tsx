import { type GetServerSideProps } from "next";
import { FilingInfo } from "@/src/components/FilingInfo";
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
import { zodResolver } from "@hookform/resolvers/zod";
import {
  SiOkta,
  SiAuthentik,
  SiAuth0,
  SiClickhouse,
  SiAmazoncognito,
  SiKeycloak,
  SiGoogle,
  SiGitlab,
  SiGithub,
  SiWordpress,
} from "react-icons/si";
import { TbBrandAzure, TbBrandOauth } from "react-icons/tb";
import { signIn } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { CloudPrivacyNotice } from "@/src/features/auth/components/AuthCloudPrivacyNotice";
import { CloudRegionSwitch } from "@/src/features/auth/components/AuthCloudRegionSwitch";
import { PasswordInput } from "@/src/components/ui/password-input";
import { isAnySsoConfigured } from "@/src/features/auth/multi-tenant-sso/utils";
import { isEmailVerificationRequired } from "@/src/features/auth-credentials/lib/credentialsUtils";
import { Code, Key, ShieldCheck } from "lucide-react";
import { useRouter } from "next/router";
import { captureException } from "@sentry/nextjs";
import { captureUnknownError } from "@/src/utils/captureUnknownError";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import useLocalStorage from "@/src/components/useLocalStorage";
import { AuthProviderButton } from "@/src/features/auth/components/AuthProviderButton";
import { cn } from "@/src/utils/tailwind";
import { useLangfuseCloudRegion } from "@/src/features/organizations/hooks";
import { getSafeRedirectPath } from "@/src/utils/redirect";

const credentialAuthForm = z.object({
  email: z.email(),
  password: z.string().min(8, {
    message: "密码至少需要8个字符",
  }),
});

// Also used in src/pages/auth/sign-up.tsx
export type PageProps = {
  authProviders: {
    credentials: boolean;
    google: boolean;
    github: boolean;
    githubEnterprise: boolean;
    gitlab: boolean;
    okta: boolean;
    authentik: boolean;
    onelogin: boolean;
    azureAd: boolean;
    auth0: boolean;
    clickhouseCloud: boolean;
    cognito: boolean;
    keycloak:
      | {
          name: string;
        }
      | boolean;
    workos:
      | {
          organizationId: string;
        }
      | {
          connectionId: string;
        }
      | boolean;
    wordpress: boolean;
    custom:
      | {
          name: string;
        }
      | false;
    sso: boolean;
  };
  runningOnHuggingFaceSpaces: boolean;
  signUpDisabled: boolean;
  emailVerificationRequired: boolean;
};

// Also used in src/pages/auth/sign-up.tsx

export const getServerSideProps: GetServerSideProps<PageProps> = async () => {
  const sso: boolean = await isAnySsoConfigured();
  return {
    props: {
      authProviders: {
        google:
          env.AUTH_GOOGLE_CLIENT_ID !== undefined &&
          env.AUTH_GOOGLE_CLIENT_SECRET !== undefined,
        github:
          env.AUTH_GITHUB_CLIENT_ID !== undefined &&
          env.AUTH_GITHUB_CLIENT_SECRET !== undefined,
        githubEnterprise:
          env.AUTH_GITHUB_ENTERPRISE_CLIENT_ID !== undefined &&
          env.AUTH_GITHUB_ENTERPRISE_CLIENT_SECRET !== undefined &&
          env.AUTH_GITHUB_ENTERPRISE_BASE_URL !== undefined,
        gitlab:
          env.AUTH_GITLAB_CLIENT_ID !== undefined &&
          env.AUTH_GITLAB_CLIENT_SECRET !== undefined,
        okta:
          env.AUTH_OKTA_CLIENT_ID !== undefined &&
          env.AUTH_OKTA_CLIENT_SECRET !== undefined &&
          env.AUTH_OKTA_ISSUER !== undefined,
        authentik:
          env.AUTH_AUTHENTIK_CLIENT_ID !== undefined &&
          env.AUTH_AUTHENTIK_CLIENT_SECRET !== undefined &&
          env.AUTH_AUTHENTIK_ISSUER !== undefined,
        onelogin:
          env.AUTH_ONELOGIN_CLIENT_ID !== undefined &&
          env.AUTH_ONELOGIN_CLIENT_SECRET !== undefined &&
          env.AUTH_ONELOGIN_ISSUER !== undefined,
        credentials: env.AUTH_DISABLE_USERNAME_PASSWORD !== "true",
        azureAd:
          env.AUTH_AZURE_AD_CLIENT_ID !== undefined &&
          env.AUTH_AZURE_AD_CLIENT_SECRET !== undefined &&
          env.AUTH_AZURE_AD_TENANT_ID !== undefined,
        auth0:
          env.AUTH_AUTH0_CLIENT_ID !== undefined &&
          env.AUTH_AUTH0_CLIENT_SECRET !== undefined &&
          env.AUTH_AUTH0_ISSUER !== undefined,
        // Langfuse Cloud only — NOT for self-hosted Langfuse
        clickhouseCloud:
          env.AUTH_CLICKHOUSE_CLOUD_CLIENT_ID !== undefined &&
          env.AUTH_CLICKHOUSE_CLOUD_CLIENT_SECRET !== undefined &&
          env.AUTH_CLICKHOUSE_CLOUD_ISSUER !== undefined &&
          env.NEXT_PUBLIC_LANGFUSE_CLOUD_REGION !== undefined,
        cognito:
          env.AUTH_COGNITO_CLIENT_ID !== undefined &&
          env.AUTH_COGNITO_CLIENT_SECRET !== undefined &&
          env.AUTH_COGNITO_ISSUER !== undefined,
        keycloak:
          env.AUTH_KEYCLOAK_CLIENT_ID !== undefined &&
          env.AUTH_KEYCLOAK_CLIENT_SECRET !== undefined &&
          env.AUTH_KEYCLOAK_ISSUER !== undefined
            ? env.AUTH_KEYCLOAK_NAME !== undefined
              ? { name: env.AUTH_KEYCLOAK_NAME }
              : true
            : false,
        workos:
          env.AUTH_WORKOS_CLIENT_ID !== undefined &&
          env.AUTH_WORKOS_CLIENT_SECRET !== undefined
            ? env.AUTH_WORKOS_ORGANIZATION_ID !== undefined
              ? { organizationId: env.AUTH_WORKOS_ORGANIZATION_ID }
              : env.AUTH_WORKOS_CONNECTION_ID !== undefined
                ? { connectionId: env.AUTH_WORKOS_CONNECTION_ID }
                : true
            : false,
        wordpress:
          env.AUTH_WORDPRESS_CLIENT_ID !== undefined &&
          env.AUTH_WORDPRESS_CLIENT_SECRET !== undefined,
        custom:
          env.AUTH_CUSTOM_CLIENT_ID !== undefined &&
          env.AUTH_CUSTOM_CLIENT_SECRET !== undefined &&
          env.AUTH_CUSTOM_ISSUER !== undefined &&
          env.AUTH_CUSTOM_NAME !== undefined
            ? { name: env.AUTH_CUSTOM_NAME }
            : false,
        sso,
      },
      signUpDisabled: env.AUTH_DISABLE_SIGNUP === "true",
      emailVerificationRequired: isEmailVerificationRequired(),
      runningOnHuggingFaceSpaces: env.NEXTAUTH_URL?.replace(
        "/api/auth",
        "",
      ).endsWith(".hf.space"),
    },
  };
};

// Also used in src/pages/auth/sign-up.tsx
/** Oxelia51 品牌横版 logo：浅底用深色版，深底（dark）用浅色版。 */
export function AuthBrandLogo() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-64.png`}
        alt="Oxelia51"
        className="h-10 w-auto dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-64-dark.png`}
        alt="Oxelia51"
        className="hidden h-10 w-auto dark:block"
      />
    </>
  );
}

type NextAuthProvider = NonNullable<Parameters<typeof signIn>[0]>;

// Also used in src/pages/auth/sign-up.tsx
export function SSOButtons({
  authProviders,
  action = "sign in",
  lastUsedMethod,
  onProviderSelect,
}: {
  authProviders: PageProps["authProviders"];
  action?: string;
  lastUsedMethod?: NextAuthProvider | null;
  onProviderSelect?: (provider: NextAuthProvider) => void;
}) {
  const capture = usePostHogClientCapture();
  const [providerSigningIn, setProviderSigningIn] =
    useState<NextAuthProvider | null>(null);

  // Count available auth methods (including credentials if available)
  const availableProviders = Object.entries(authProviders).filter(
    ([name, enabled]) => enabled && name !== "sso", // sso is just a flag, not an actual provider
  );
  const hasMultipleAuthMethods = availableProviders.length > 1;

  const handleSignIn = (provider: NextAuthProvider) => {
    setProviderSigningIn(provider);
    capture("sign_in:button_click", { provider });

    // Notify parent component about provider selection
    onProviderSelect?.(provider);

    signIn(provider)
      .then(() => {
        // do not reset loadingProvider here, as the page will reload
      })
      .catch((error) => {
        captureUnknownError("auth.signIn.provider", error, { provider });
        setProviderSigningIn(null);
      });
  };

  // Only show separator if credentials are enabled (for sign-in) or if action is sign-up (which always has the form)
  const showSeparator = authProviders.credentials || action !== "sign in";

  return (
    // any authprovider from props is enabled
    Object.entries(authProviders).some(
      ([name, enabled]) => enabled && name !== "credentials",
    ) ? (
      <div>
        {showSeparator ? (
          action === "sign in" ? (
            <div className="border-border my-6 border-t"></div>
          ) : (
            <div className="text-muted-foreground my-6 text-center text-xs">
              或使用以下方式{action === "sign in" ? "登录" : "注册"}
            </div>
          )
        ) : null}
        <div className="flex flex-row flex-wrap items-center justify-center gap-2">
          {authProviders.google && (
            <AuthProviderButton
              icon={<SiGoogle className="mr-3" size={18} />}
              label="Google"
              onClick={() => handleSignIn("google")}
              loading={providerSigningIn === "google"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "google"
              }
            />
          )}
          {authProviders.github && (
            <AuthProviderButton
              icon={<SiGithub className="mr-3" size={18} />}
              label="GitHub"
              onClick={() => handleSignIn("github")}
              loading={providerSigningIn === "github"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "github"
              }
            />
          )}
          {authProviders.githubEnterprise && (
            <AuthProviderButton
              icon={<SiGithub className="mr-3" size={18} />}
              label="GitHub Enterprise"
              onClick={() => handleSignIn("github-enterprise")}
              loading={providerSigningIn === "github-enterprise"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "github-enterprise"
              }
            />
          )}
          {authProviders.gitlab && (
            <AuthProviderButton
              icon={<SiGitlab className="mr-3" size={18} />}
              label="Gitlab"
              onClick={() => handleSignIn("gitlab")}
              loading={providerSigningIn === "gitlab"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "gitlab"
              }
            />
          )}
          {authProviders.azureAd && (
            <AuthProviderButton
              icon={<TbBrandAzure className="mr-3" size={18} />}
              label="Azure AD"
              onClick={() => handleSignIn("azure-ad")}
              loading={providerSigningIn === "azure-ad"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "azure-ad"
              }
            />
          )}
          {authProviders.okta && (
            <AuthProviderButton
              icon={<SiOkta className="mr-3" size={18} />}
              label="Okta"
              onClick={() => handleSignIn("okta")}
              loading={providerSigningIn === "okta"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "okta"
              }
            />
          )}
          {authProviders.authentik && (
            <AuthProviderButton
              icon={<SiAuthentik className="mr-3" size={18} />}
              label="Authentik"
              onClick={() => handleSignIn("authentik")}
              loading={providerSigningIn === "authentik"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "authentik"
              }
            />
          )}
          {authProviders.onelogin && (
            <AuthProviderButton
              icon={<Key className="mr-3" size={18} />}
              label="OneLogin"
              onClick={() => handleSignIn("onelogin")}
              loading={providerSigningIn === "onelogin"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "onelogin"
              }
            />
          )}
          {authProviders.auth0 && (
            <AuthProviderButton
              icon={<SiAuth0 className="mr-3" size={18} />}
              label="Auth0"
              onClick={() => handleSignIn("auth0")}
              loading={providerSigningIn === "auth0"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "auth0"
              }
            />
          )}
          {authProviders.clickhouseCloud && (
            <AuthProviderButton
              icon={<SiClickhouse className="mr-3" size={18} />}
              label="ClickHouse Cloud"
              onClick={() => handleSignIn("clickhouse-cloud")}
              loading={providerSigningIn === "clickhouse-cloud"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "clickhouse-cloud"
              }
            />
          )}
          {authProviders.cognito && (
            <AuthProviderButton
              icon={<SiAmazoncognito className="mr-3" size={18} />}
              label="Cognito"
              onClick={() => handleSignIn("cognito")}
              loading={providerSigningIn === "cognito"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "cognito"
              }
            />
          )}
          {authProviders.keycloak && (
            <AuthProviderButton
              icon={<SiKeycloak className="mr-3" size={18} />}
              label={
                typeof authProviders.keycloak === "object"
                  ? authProviders.keycloak.name
                  : "Keycloak"
              }
              onClick={() => {
                capture("sign_in:button_click", { provider: "keycloak" });
                onProviderSelect?.("keycloak");
                signIn("keycloak");
              }}
              loading={providerSigningIn === "keycloak"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "keycloak"
              }
            />
          )}
          {typeof authProviders.workos === "object" &&
            "connectionId" in authProviders.workos && (
              <AuthProviderButton
                icon={<Code className="mr-3" size={18} />}
                label="WorkOS"
                onClick={() => {
                  capture("sign_in:button_click", { provider: "workos" });
                  onProviderSelect?.("workos");
                  signIn("workos", undefined, {
                    connection: (
                      authProviders.workos as { connectionId: string }
                    ).connectionId,
                  });
                }}
                loading={providerSigningIn === "workos"}
                showLastUsedBadge={
                  hasMultipleAuthMethods && lastUsedMethod === "workos"
                }
              />
            )}
          {typeof authProviders.workos === "object" &&
            "organizationId" in authProviders.workos && (
              <AuthProviderButton
                icon={<Code className="mr-3" size={18} />}
                label="WorkOS"
                onClick={() => {
                  capture("sign_in:button_click", { provider: "workos" });
                  onProviderSelect?.("workos");
                  signIn("workos", undefined, {
                    organization: (
                      authProviders.workos as { organizationId: string }
                    ).organizationId,
                  });
                }}
                loading={providerSigningIn === "workos"}
                showLastUsedBadge={
                  hasMultipleAuthMethods && lastUsedMethod === "workos"
                }
              />
            )}
          {authProviders.workos === true && (
            <>
              <AuthProviderButton
                icon={<Code className="mr-3" size={18} />}
                label="WorkOS（组织）"
                onClick={() => {
                  const organization = window.prompt("请输入您的组织 ID");
                  if (organization) {
                    capture("sign_in:button_click", { provider: "workos" });
                    onProviderSelect?.("workos");
                    signIn("workos", undefined, {
                      organization,
                    });
                  }
                }}
                loading={providerSigningIn === "workos"}
                showLastUsedBadge={
                  hasMultipleAuthMethods && lastUsedMethod === "workos"
                }
              />
              <AuthProviderButton
                icon={<Code className="mr-3" size={18} />}
                label="WorkOS（连接）"
                onClick={() => {
                  const connection = window.prompt("请输入您的连接 ID");
                  if (connection) {
                    capture("sign_in:button_click", { provider: "workos" });
                    onProviderSelect?.("workos");
                    signIn("workos", undefined, {
                      connection,
                    });
                  }
                }}
                loading={providerSigningIn === "workos"}
                showLastUsedBadge={
                  hasMultipleAuthMethods && lastUsedMethod === "workos"
                }
              />
            </>
          )}
          {authProviders.wordpress && (
            <AuthProviderButton
              icon={<SiWordpress className="mr-3" size={18} />}
              label="WordPress"
              onClick={() => handleSignIn("wordpress")}
              loading={providerSigningIn === "wordpress"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "wordpress"
              }
            />
          )}
          {authProviders.custom && (
            <AuthProviderButton
              icon={<TbBrandOauth className="mr-3" size={18} />}
              label={authProviders.custom.name}
              onClick={() => handleSignIn("custom")}
              loading={providerSigningIn === "custom"}
              showLastUsedBadge={
                hasMultipleAuthMethods && lastUsedMethod === "custom"
              }
            />
          )}
        </div>
      </div>
    ) : null
  );
}

/**
 * Redirect to HuggingFace Spaces auth page (/auth/hf-spaces) if running in an iframe on a HuggingFace host.
 * The iframe detection needs to happen client-side since window/document objects are not available during SSR.
 * @param runningOnHuggingFaceSpaces - whether the app is running on a HuggingFace spaces, needs to be checked server-side
 */
export function useHuggingFaceRedirect(runningOnHuggingFaceSpaces: boolean) {
  const router = useRouter();

  useEffect(() => {
    const isInIframe = () => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    };

    if (
      runningOnHuggingFaceSpaces &&
      typeof window !== "undefined" &&
      isInIframe()
    ) {
      router.push("/auth/hf-spaces");
    }
  }, [router, runningOnHuggingFaceSpaces]);
}

const signInErrors = [
  {
    code: "OAuthAccountNotLinked",
    description:
      "请使用您创建此账户时所用的同一提供商（如 Google、GitHub、Azure AD 等）登录。",
  },
];

export default function SignIn({
  authProviders,
  signUpDisabled,
  runningOnHuggingFaceSpaces,
}: PageProps) {
  const router = useRouter();
  useHuggingFaceRedirect(runningOnHuggingFaceSpaces);

  // handle NextAuth error codes: https://next-auth.js.org/configuration/pages#sign-in-page
  const nextAuthError =
    typeof router.query.error === "string"
      ? decodeURIComponent(router.query.error)
      : null;
  const nextAuthErrorDescription =
    typeof router.query.error_description === "string"
      ? decodeURIComponent(router.query.error_description)
      : null;

  // Use error_description from IdP if available, otherwise use mapped error or error code
  const errorMessage = nextAuthErrorDescription
    ? nextAuthErrorDescription
    : (signInErrors.find((e) => e.code === nextAuthError)?.description ??
      nextAuthError);

  useEffect(() => {
    // log unexpected sign in errors to Sentry
    // An error is unexpected if it's not in our mapped errors and has no IdP error_description
    if (
      nextAuthError &&
      !nextAuthErrorDescription &&
      !signInErrors.find((e) => e.code === nextAuthError)
    ) {
      captureException(new Error(`Sign in error: ${nextAuthError}`));
    }
  }, [nextAuthError, nextAuthErrorDescription]);

  const [credentialsFormError, setCredentialsFormError] = useState<
    string | null
  >(errorMessage);
  // Two-step login flow: ask for email first, detect SSO, then either redirect to SSO or reveal password field.
  // Skip this flow when no SSO is configured - show password field immediately
  const [showPasswordStep, setShowPasswordStep] = useState<boolean>(
    !authProviders.sso,
  );
  const [continueLoading, setContinueLoading] = useState<boolean>(false);
  const [lastUsedAuthMethod, setLastUsedAuthMethod] =
    useLocalStorage<NextAuthProvider | null>(
      "langfuse_last_used_auth_method",
      null,
    );

  const capture = usePostHogClientCapture();
  const { isLangfuseCloud } = useLangfuseCloudRegion();

  // Count available auth methods to determine if we should show "Last used" badge
  const availableProviders = Object.entries(authProviders).filter(
    ([name, enabled]) => enabled && name !== "sso", // sso is just a flag, not an actual provider
  );
  const hasMultipleAuthMethods = availableProviders.length > 1;

  // Read query params for targetPath and email pre-population
  const queryTargetPath = router.query.targetPath as string | undefined;
  const emailParam = router.query.email as string | undefined;

  // Validate targetPath to prevent open redirect attacks
  const targetPath = queryTargetPath
    ? getSafeRedirectPath(queryTargetPath)
    : undefined;

  // Credentials
  const credentialsForm = useForm({
    resolver: zodResolver(credentialAuthForm),
    defaultValues: {
      email: emailParam ?? "",
      password: "",
    },
  });
  async function onCredentialsSubmit(
    values: z.infer<typeof credentialAuthForm>,
  ) {
    setCredentialsFormError(null);
    try {
      capture("sign_in:button_click", { provider: "email/password" });

      // Store credentials as the last used auth method before signing in
      setLastUsedAuthMethod("credentials");

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        // Oxelia51 fork 定制：无显式 targetPath 时默认落 /app 工作台
        //（上游默认落 "/"，本 fork 的 "/" 是营销落地页）。
        callbackUrl: targetPath ?? "/app",
        redirect: false,
      });
      if (result?.ok) {
        // Oxelia51：登录成功后立即显式跳转。若依赖会话刷新→守卫重定向的
        // 异步时序，会慢一拍导致「要点两下才能登录」的观感。
        void router.push(targetPath ?? "/app");
        return;
      }
      if (result === undefined) {
        setCredentialsFormError("发生未知错误。");
        captureException(new Error("Sign in result is undefined"));
      } else if (!result.ok) {
        if (!result.error) {
          captureException(
            new Error(
              `Sign in result error is falsy, result: ${JSON.stringify(result)}`,
            ),
          );
        }
        setCredentialsFormError(result?.error ?? "发生未知错误。");
      }
    } catch (error) {
      captureUnknownError("auth.signIn.credentials", error);
      setCredentialsFormError("发生未知错误。");
    }
  }

  /**
   * First-step handler ("Continue" button).
   * 1. Validates email.
   * 2. Queries backend to see if a tenant-specific SSO provider is configured.
   *    ‑ If found: redirects to that provider immediately.
   *    ‑ Otherwise: reveals password input so the user can finish with credentials.
   * 3. Gracefully handles network errors and edge cases.
   */
  async function handleContinue() {
    setContinueLoading(true);
    setCredentialsFormError(null);
    credentialsForm.clearErrors();

    // Ensure email is valid before hitting the API
    const emailSchema = z.email();
    const email = emailSchema.safeParse(credentialsForm.getValues("email"));
    if (!email.success) {
      credentialsForm.setError("email", {
        message: "邮箱地址无效",
      });
      setContinueLoading(false);
      return;
    }

    // Extract domain and check whether SSO is configured for it
    const domain = email.data.split("@")[1]?.toLowerCase();

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth/check-sso`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        },
      );

      if (res.ok) {
        // Enterprise SSO found – redirect straight away
        const { providerId } = await res.json();
        capture("sign_in:button_click", { provider: "sso_auto" });

        // Store the SSO provider as the last used auth method
        setLastUsedAuthMethod(providerId as NextAuthProvider);

        signIn(providerId);
        return; // stop further execution – page redirect expected
      }

      // No SSO – fall back to password step
      setShowPasswordStep(true);

      // Auto-focus password input when password step becomes visible
      setTimeout(() => {
        // Find and focus the password input
        // Ref did not work, so we use a more specific selector
        const passwordInput = document.querySelector(
          'input[name="password"]',
        ) as HTMLInputElement;
        if (passwordInput) {
          passwordInput.focus();
        }
      }, 100);
    } catch (error) {
      captureUnknownError("auth.signIn.checkSso", error);
      setCredentialsFormError("无法检查单点登录配置，请重试。");
    } finally {
      setContinueLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>登录 | Oxelia51</title>
        <meta
          name="description"
          content="登录 Oxelia51 — 使用桌面应用与查看文档无需登录，账户仅用于跨设备同步与云平台托管"
        />
      </Head>
      <div className="flex flex-1 flex-col py-6 sm:min-h-full sm:justify-center sm:px-6 sm:py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mx-auto w-fit">
            <AuthBrandLogo />
          </div>
          <h2 className="text-primary mt-4 text-center text-2xl leading-9 font-bold tracking-tight">
            登录您的账户
          </h2>
          {/* Oxelia51：弱认证——说明账户用途，明确基础使用无需登录 */}
          <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-center text-xs leading-5">
            使用桌面应用、查看文档与下载无需登录。账户仅用于
            <b> 跨设备同步 </b>、<b> 云平台托管 </b>与 <b> 管理员管理 </b>。
          </p>
        </div>

        {isLangfuseCloud && (
          <div className="bg-card mt-4 -mb-4 rounded-lg p-3 text-center text-sm sm:mx-auto sm:w-full sm:max-w-[480px] sm:rounded-lg sm:px-6">
            如果您在登录时遇到问题，请强制刷新此页面（CMD + SHIFT +
            R）或清除浏览器缓存。{" "}
            <a
              href="mailto:receive@oxelia51.com"
              className="text-link hover:text-link-hover cursor-pointer text-xs font-bold whitespace-nowrap"
            >
              （联系我们）
            </a>
          </div>
        )}

        <CloudRegionSwitch />

        <div className="bg-background mt-14 px-6 py-10 shadow-sm sm:mx-auto sm:w-full sm:max-w-[480px] sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            {/* Email / (optional) password form – only when credentials auth is enabled */}
            {authProviders.credentials && (
              <div>
                <Form {...credentialsForm}>
                  <form
                    className="space-y-6"
                    onSubmit={
                      showPasswordStep
                        ? credentialsForm.handleSubmit(onCredentialsSubmit)
                        : (e) => {
                            e.preventDefault();
                            handleContinue();
                          }
                    }
                  >
                    {/* Email input – always visible */}
                    <FormField
                      control={credentialsForm.control}
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

                    {/* Password only shown once we know SSO is not configured */}
                    {showPasswordStep && (
                      <FormField
                        control={credentialsForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              密码{" "}
                              <Link
                                href="/auth/reset-password"
                                className="text-link hover:text-link-hover ml-1 text-xs"
                                title="这是什么？"
                              >
                                （忘记密码？）
                              </Link>
                            </FormLabel>
                            <FormControl>
                              <PasswordInput {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Primary action button */}
                    <Button
                      type="submit"
                      className="w-full"
                      loading={
                        showPasswordStep
                          ? credentialsForm.formState.isSubmitting
                          : continueLoading
                      }
                      disabled={
                        credentialsForm.watch("email") === "" ||
                        (showPasswordStep &&
                          credentialsForm.watch("password") === "") ||
                        // Oxelia51：提交期间禁止重复点击，避免二次提交
                        credentialsForm.formState.isSubmitting ||
                        continueLoading
                      }
                      data-testid="submit-email-password-sign-in-form"
                    >
                      {showPasswordStep ? "登录" : "继续"}
                    </Button>
                  </form>
                </Form>
                <div
                  className={cn(
                    "text-muted-foreground mt-1 text-center text-xs",
                    hasMultipleAuthMethods &&
                      lastUsedAuthMethod === "credentials"
                      ? "block"
                      : "hidden",
                  )}
                >
                  上次使用
                </div>
              </div>
            )}
            {credentialsFormError ? (
              <div className="text-destructive text-center text-sm font-bold">
                {credentialsFormError}
                <br />
                如果此错误在意料之外，请联系支持。{" "}
                {isLangfuseCloud && "请确保您使用的是正确的云端数据区域。"}
              </div>
            ) : null}
            <SSOButtons
              authProviders={authProviders}
              lastUsedMethod={lastUsedAuthMethod}
              onProviderSelect={setLastUsedAuthMethod}
            />
          </div>

          {!signUpDisabled &&
          env.NEXT_PUBLIC_SIGN_UP_DISABLED !== "true" &&
          authProviders.credentials ? (
            <p className="text-muted-foreground mt-10 text-center text-sm">
              还没有账号？{" "}
              <Link
                href={`/auth/sign-up${router.asPath.includes("?") ? router.asPath.substring(router.asPath.indexOf("?")) : ""}`}
                className="text-link hover:text-link-hover leading-6 font-bold"
              >
                注册
              </Link>
            </p>
          ) : null}
        </div>

        {/* Oxelia51：管理员登录入口，独立页面 /auth/admin，普通用户可忽略 */}
        <p className="mt-4 text-center">
          <Link
            href="/auth/admin"
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            我是管理员
          </Link>
        </p>

        <CloudPrivacyNotice action="登录" />

        <div className="mt-6 flex justify-center pb-4">
          <FilingInfo variant="full" />
        </div>
      </div>
    </>
  );
}
