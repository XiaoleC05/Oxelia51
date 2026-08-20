import { Button } from "@/src/components/ui/button";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { api } from "@/src/utils/api";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { useQueryOrganization } from "@/src/features/organizations/hooks";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast"; // Import success toast function
import { env } from "@/src/env.mjs";

export function DeleteOrganizationButton() {
  const capture = usePostHogClientCapture();

  const organization = useQueryOrganization();
  const confirmMessage =
    organization?.name.replaceAll(" ", "-").toLowerCase() ?? "organization";

  const formSchema = z.object({
    name: z.string().includes(confirmMessage, {
      message: `请输入 "${confirmMessage}" 以确认`,
    }),
  });

  const hasAccess = useHasOrganizationAccess({
    organizationId: organization?.id,
    scope: "organization:delete",
  });

  const deleteOrganization = api.organizations.delete.useMutation();
  const hasProjects = !!organization && organization.projects.length > 0;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async () => {
    if (!organization || hasProjects) return;
    try {
      await deleteOrganization.mutateAsync({
        orgId: organization.id,
      });
      capture("organization_settings:delete_organization");
      showSuccessToast({
        title: "组织已删除",
        description: "组织已成功删除。",
      });
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Delay for 5 seconds
      window.location.href = env.NEXT_PUBLIC_BASE_PATH ?? "/"; // Browser reload to refresh jwt
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive-secondary" disabled={!hasAccess}>
          删除组织
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">删除组织</DialogTitle>
          <DialogDescription>
            {hasProjects
              ? "只有不包含任何关联项目的组织才能被删除。请先删除或转移所有项目。删除项目可能需要几分钟。"
              : `请在下方的输入框中输入 "${confirmMessage}" 以确认 `}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {!hasProjects && (
              <DialogBody>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder={confirmMessage} {...field} />
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
                loading={deleteOrganization.isPending}
                disabled={hasProjects}
                className="w-full"
              >
                删除组织
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
