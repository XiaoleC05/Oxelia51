import { SubHeader } from "@/src/components/layouts/header";
import { CodeView } from "@/src/components/ui/CodeJsonViewer";
import { Label } from "@/src/components/ui/label";
import { getLangfuseEnvCode } from "@/src/features/public-api/hooks/useLangfuseEnvCode";
import { cn } from "@/src/utils/tailwind";
import { OXELIA_DOCS_URL } from "@/src/features/oxelia51/constants";

type ApiKeyScope = "project" | "organization";

export type ApiKeyDetailContentProps = {
  scope: ApiKeyScope;
  secretKey: string;
  publicKey: string;
  baseUrl: string;
  className?: string;
  showMcpSection: boolean;
};

function encodeMcpCredential(publicKey: string, secretKey: string) {
  const credential = `${publicKey}:${secretKey}`;

  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(credential);
  }

  return Buffer.from(credential).toString("base64");
}

export function ApiKeyDetailContent(props: ApiKeyDetailContentProps) {
  const { scope, secretKey, publicKey, baseUrl, className, showMcpSection } =
    props;
  const envCode = getLangfuseEnvCode(baseUrl, { secretKey, publicKey });
  const mcpCredential = encodeMcpCredential(publicKey, secretKey);

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <SubHeader title="密钥" />
        <div className="text-muted-foreground text-sm">
          此密钥仅可查看一次。您可以在{scope}设置中随时创建新密钥。
        </div>
        <CodeView content={secretKey} className="mt-2" />
      </div>
      <div>
        <SubHeader title="公钥" />
        <CodeView content={publicKey} className="mt-2" />
      </div>
      <div>
        <SubHeader title=".env" />
        <CodeView content={envCode} className="mt-2" />
      </div>
      {showMcpSection ? (
        <>
          <hr />
          <div>
            <SubHeader title="与 MCP 配合使用" />
            <p className="text-muted-foreground text-sm">
              关于如何使用此 API 密钥连接 Langfuse MCP 服务器的详细指南，请参阅{" "}
              <a
                href={OXELIA_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline"
              >
                MCP 设置文档
              </a>
              .
            </p>
            <div className="mt-4">
              <Label>请求头</Label>
              <CodeView
                content={`Authorization: Basic ${mcpCredential}`}
                className="mt-2"
                lineWrap={false}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
