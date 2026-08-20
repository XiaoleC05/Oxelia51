import Header from "@/src/components/layouts/header";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { CodeView } from "@/src/components/ui/CodeJsonViewer";
import { Input } from "@/src/components/ui/input";
import { ConfirmDialog } from "@/src/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableCellWithCopyButton,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { CreateApiKeyButton } from "@/src/features/public-api/components/CreateApiKeyButton";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { api } from "@/src/utils/api";
import { TrashIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { useLangfuseEnvCode } from "@/src/features/public-api/hooks/useLangfuseEnvCode";
import { OXELIA_DOCS_URL } from "@/src/features/oxelia51/constants";

type ApiKeyScope = "project" | "organization";
type ApiKeyEntity = { id: string; note: string | null };
type ApiKeyCreator = {
  createdByUser: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  createdByApiKey: { id: string; publicKey: string } | null;
};

export function ApiKeyList(props: { entityId: string; scope: ApiKeyScope }) {
  const { entityId, scope } = props;
  const envCode = useLangfuseEnvCode();

  if (!entityId) {
    throw new Error(
      `${scope}Id is required for ApiKeyList with scope ${scope}`,
    );
  }

  const hasProjectAccess = useHasProjectAccess({
    projectId: props.entityId,
    scope: "apiKeys:CUD",
  });
  const hasOrganizationAccess = useHasOrganizationAccess({
    organizationId: props.entityId,
    scope: "organization:CRUD_apiKeys",
  });

  const hasAccess =
    props.scope === "project" ? hasProjectAccess : hasOrganizationAccess;

  const projectApiKeysQuery = api.projectApiKeys.byProjectId.useQuery(
    { projectId: entityId },
    { enabled: hasProjectAccess && props.scope === "project" },
  );
  const organizationApiKeysQuery =
    api.organizationApiKeys.byOrganizationId.useQuery(
      { orgId: entityId },
      { enabled: hasOrganizationAccess && props.scope === "organization" },
    );
  const apiKeysQuery =
    props.scope === "project" ? projectApiKeysQuery : organizationApiKeysQuery;

  if (!hasAccess) {
    return (
      <div>
        <Header title="API 密钥" />
        <Alert>
          <AlertTitle>访问被拒绝</AlertTitle>
          <AlertDescription>
            您没有查看此{scope === "project" ? "项目" : "组织"}的 API
            密钥的权限。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header
        title={scope === "project" ? "项目 API 密钥" : "组织 API 密钥"}
        help={{
          description: `了解更多关于${scope === "project" ? "项目" : "组织"} API 密钥的信息`,
          href: OXELIA_DOCS_URL,
        }}
        actionButtons={<CreateApiKeyButton entityId={entityId} scope={scope} />}
      />
      <CodeView
        content={envCode}
        title=".env"
        copiedToClipboardMessage="不包含密钥，创建新密钥以复制。"
      />
      <Card className="mb-4 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-primary hidden md:table-cell">
                创建时间
              </TableHead>
              <TableHead className="text-primary hidden md:table-cell">
                创建者
              </TableHead>
              <TableHead className="text-primary">备注</TableHead>
              <TableHead className="text-primary">公钥</TableHead>
              <TableHead className="text-primary">密钥</TableHead>
              {/* <TableHead className="text-primary">Last used</TableHead> */}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody className="text-muted-foreground">
            {apiKeysQuery.data?.length === 0 ? (
              <TableRow>
                <TableCell
                  density="comfortable"
                  colSpan={6}
                  className="text-center"
                >
                  无
                </TableCell>
              </TableRow>
            ) : (
              apiKeysQuery.data?.map((apiKey) => (
                <TableRow
                  key={apiKey.id}
                  className="hover:bg-primary-foreground"
                >
                  <TableCell
                    density="comfortable"
                    className="hidden md:table-cell"
                  >
                    {apiKey.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell
                    density="comfortable"
                    className="hidden md:table-cell"
                  >
                    <ApiKeyCreatedBy apiKey={apiKey} />
                  </TableCell>
                  <TableCell density="comfortable">
                    <ApiKeyNote
                      apiKey={apiKey}
                      entityId={entityId}
                      scope={scope}
                    />
                  </TableCell>
                  <TableCellWithCopyButton
                    density="comfortable"
                    text={apiKey.publicKey}
                    className="truncate font-mono"
                    title={apiKey.publicKey}
                  />
                  <TableCell density="comfortable" className="font-mono">
                    {apiKey.displaySecretKey}
                  </TableCell>
                  {/* <TableCell>
                  {apiKey.lastUsedAt?.toLocaleDateString() ?? "Never"}
                </TableCell> */}
                  <TableCell density="comfortable">
                    <DeleteApiKeyButton
                      entityId={entityId}
                      apiKeyId={apiKey.id}
                      scope={scope}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// show dialog to let user confirm that this is a destructive action
function DeleteApiKeyButton(props: {
  entityId: string;
  apiKeyId: string;
  scope: ApiKeyScope;
}) {
  const { entityId, apiKeyId, scope } = props;
  const capture = usePostHogClientCapture();

  const hasProjectAccess = useHasProjectAccess({
    projectId: props.entityId,
    scope: "apiKeys:CUD",
  });
  const hasOrganizationAccess = useHasOrganizationAccess({
    organizationId: props.entityId,
    scope: "organization:CRUD_apiKeys",
  });

  const hasAccess =
    props.scope === "project" ? hasProjectAccess : hasOrganizationAccess;

  const utils = api.useUtils();

  const mutDeleteProjectApiKey = api.projectApiKeys.delete.useMutation({
    onSuccess: () => utils.projectApiKeys.invalidate(),
  });
  const mutDeleteOrgApiKey = api.organizationApiKeys.delete.useMutation({
    onSuccess: () => utils.organizationApiKeys.invalidate(),
  });

  const [open, setOpen] = useState(false);

  if (!hasAccess) return null;

  const handleDelete = () => {
    if (scope === "project") {
      mutDeleteProjectApiKey
        .mutateAsync({
          projectId: entityId,
          id: apiKeyId,
        })
        .then(() => {
          capture(`${scope}_settings:api_key_delete`);
          setOpen(false);
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      mutDeleteOrgApiKey
        .mutateAsync({
          orgId: entityId,
          id: apiKeyId,
        })
        .then(() => {
          capture(`${scope}_settings:api_key_delete`);
          setOpen(false);
        })
        .catch((error) => {
          console.error(error);
        });
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon">
          <TrashIcon className="h-4 w-4" />
        </Button>
      }
      title="删除 API 密钥"
      description="确定要删除此 API 密钥吗？此操作无法撤销。"
      confirmLabel="永久删除"
      loading={mutDeleteOrgApiKey.isPending || mutDeleteProjectApiKey.isPending}
      onConfirm={handleDelete}
    />
  );
}

function ApiKeyCreatedBy({ apiKey }: { apiKey: ApiKeyCreator }) {
  if (apiKey.createdByUser) {
    const { name, email } = apiKey.createdByUser;
    return (
      <span className="truncate" title={email ?? undefined}>
        {name ?? email ?? "未知用户"}
      </span>
    );
  }
  if (apiKey.createdByApiKey) {
    return (
      <span
        className="truncate font-mono"
        title={`通过 API 由密钥 ${apiKey.createdByApiKey.publicKey} 创建`}
      >
        {apiKey.createdByApiKey.publicKey}
      </span>
    );
  }
  return <span>—</span>;
}

function ApiKeyNote({
  apiKey,
  entityId,
  scope,
}: {
  apiKey: ApiKeyEntity;
  entityId: string;
  scope: ApiKeyScope;
}) {
  const utils = api.useUtils();

  const hasProjectAccess = useHasProjectAccess({
    projectId: entityId,
    scope: "apiKeys:CUD",
  });
  const hasOrganizationAccess = useHasOrganizationAccess({
    organizationId: entityId,
    scope: "organization:CRUD_apiKeys",
  });
  const hasEditAccess =
    scope === "project" ? hasProjectAccess : hasOrganizationAccess;

  const mutUpdateProjectApiKey = api.projectApiKeys.updateNote.useMutation({
    onSuccess: () => utils.projectApiKeys.invalidate(),
  });
  const mutUpdateOrgApiKey = api.organizationApiKeys.updateNote.useMutation({
    onSuccess: () => utils.organizationApiKeys.invalidate(),
  });

  const [note, setNote] = useState(apiKey.note ?? "");
  const [isEditing, setIsEditing] = useState(false);

  const handleBlur = () => {
    setIsEditing(false);
    if (note !== apiKey.note) {
      if (scope === "project") {
        mutUpdateProjectApiKey.mutate({
          projectId: entityId,
          keyId: apiKey.id,
          note,
        });
      } else {
        mutUpdateOrgApiKey.mutate({
          orgId: entityId,
          keyId: apiKey.id,
          note,
        });
      }
    }
  };

  if (!hasEditAccess) return note ?? "";

  if (isEditing) {
    return (
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        className="h-8"
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="hover:bg-secondary/50 -mx-2 cursor-pointer rounded px-2 py-1"
    >
      {note || "点击添加备注"}
    </div>
  );
}
