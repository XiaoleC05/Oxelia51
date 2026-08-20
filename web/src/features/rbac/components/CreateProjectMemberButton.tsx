import { Button } from "@/src/components/ui/button";
import { api } from "@/src/utils/api";
import { useState } from "react";
import { PlusIcon } from "lucide-react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/components/ui/form";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Input } from "@/src/components/ui/input";
import { Role } from "@oxelia51/shared";
import { usePostHogClientCapture } from "@/src/features/posthog-analytics/usePostHogClientCapture";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import {
  useHasEntitlement,
  useEntitlementLimit,
} from "@/src/features/entitlements/hooks";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { RoleSelectItem } from "@/src/features/rbac/components/RoleSelectItem";
import { ActionButton } from "@/src/components/ActionButton";

const formSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  orgRole: z.enum(Role),
  projectRole: z.enum(Role),
});

export function CreateProjectMemberButton(props: {
  orgId: string;
  project?: { id: string; name: string };
}) {
  const capture = usePostHogClientCapture();
  const [open, setOpen] = useState(false);
  const hasOrgAccess = useHasOrganizationAccess({
    organizationId: props.orgId,
    scope: "organizationMembers:CUD",
  });
  const hasProjectAccess = useHasProjectAccess({
    projectId: props.project?.id,
    scope: "projectMembers:CUD",
  });
  const orgMemberLimit = useEntitlementLimit("organization-member-count");
  const orgMemberCount = api.members.allFromOrg.useQuery(
    {
      orgId: props.orgId,
      page: 0,
      limit: 1,
    },
    {
      enabled: hasOrgAccess,
    },
  ).data?.totalCount;
  const inviteCount = api.members.allInvitesFromOrg.useQuery(
    {
      orgId: props.orgId,
      page: 0,
      limit: 1,
    },
    {
      enabled: hasOrgAccess,
    },
  ).data?.totalCount;
  const hasProjectRoleEntitlement = useHasEntitlement("rbac-project-roles");
  const hasOnlySingleProjectAccess =
    !hasOrgAccess && hasProjectAccess && hasProjectRoleEntitlement;

  const utils = api.useUtils();
  const mutCreateProjectMember = api.members.create.useMutation({
    onSuccess: () => utils.members.invalidate(),
    onError: (error) =>
      form.setError("email", {
        type: "manual",
        message: error.message,
      }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      orgRole: hasOnlySingleProjectAccess ? Role.NONE : Role.MEMBER,
      projectRole: hasOnlySingleProjectAccess ? Role.MEMBER : Role.NONE,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    capture(
      props.project
        ? "project_settings:send_membership_invitation"
        : "organization_settings:send_membership_invitation",
      {
        orgRole: values.orgRole,
        projectRole: values.projectRole,
      },
    );
    return mutCreateProjectMember
      .mutateAsync({
        orgId: props.orgId,
        email: values.email,
        orgRole: values.orgRole,
        //optional
        projectId: props.project?.id,
        projectRole:
          values.projectRole === Role.NONE ? undefined : values.projectRole,
      })
      .then(() => {
        form.reset();
        setOpen(false);
      })
      .catch((error) => {
        console.error(error);
      });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <ActionButton
            variant="secondary"
            loading={mutCreateProjectMember.isPending}
            hasAccess={hasOrgAccess || hasOnlySingleProjectAccess}
            usageLimit={
              typeof orgMemberLimit === "number"
                ? {
                    current: (orgMemberCount ?? 0) + (inviteCount ?? 0),
                    max: orgMemberLimit,
                  }
                : undefined
            }
            icon={<PlusIcon className="h-5 w-5" aria-hidden="true" />}
          >
            {hasOnlySingleProjectAccess ? "添加项目成员" : "添加新成员"}
          </ActionButton>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hasOnlySingleProjectAccess
                ? "向项目添加新成员"
                : "向组织添加新成员"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <DialogBody>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl>
                        <Input placeholder="jsdoe@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!hasOnlySingleProjectAccess && (
                  <FormField
                    control={form.control}
                    name="orgRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>组织角色</FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={(value) =>
                            field.onChange(
                              value as (typeof Role)[keyof typeof Role],
                            )
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择组织角色" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(Role).map((role) => (
                              <RoleSelectItem role={role} key={role} />
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {props.project !== undefined && hasProjectRoleEntitlement && (
                  <FormField
                    control={form.control}
                    name="projectRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>项目角色</FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={(value) =>
                            field.onChange(
                              value as (typeof Role)[keyof typeof Role],
                            )
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择项目角色" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(Role)
                              .filter(
                                (role) =>
                                  !hasOnlySingleProjectAccess ||
                                  role !== Role.NONE,
                              )
                              .map((role) => (
                                <RoleSelectItem
                                  role={role}
                                  key={role}
                                  isProjectRole
                                />
                              ))}
                          </SelectContent>
                        </Select>
                        {!hasOnlySingleProjectAccess && (
                          <FormDescription>
                            此项目角色将覆盖当前项目（{props.project!.name}
                            ）的默认角色。
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  type="submit"
                  className="w-full"
                  loading={form.formState.isSubmitting}
                >
                  授予访问权限
                </Button>
                <FormMessage />
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
