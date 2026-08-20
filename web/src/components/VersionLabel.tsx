import { BadgeCheck } from "lucide-react";
import { SiGithub } from "react-icons/si";
import { VERSION } from "@/src/constants";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/src/components/ui/dropdown-menu";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/utils/tailwind";
import { usePlan } from "@/src/features/entitlements/hooks";
import { isSelfHostedPlan, planLabels } from "@oxelia51/shared";
import { useLangfuseCloudRegion } from "@/src/features/organizations/hooks";

export const VersionLabel = ({ className }: { className?: string }) => {
  const { isLangfuseCloud } = useLangfuseCloudRegion();

  const plan = usePlan();

  const selfHostedPlanLabel = !isLangfuseCloud
    ? plan && isSelfHostedPlan(plan)
      ? // self-host plan
        // TODO: clean up to use planLabels in packages/shared/src/features/entitlements/plans.ts
        {
          short: plan === "self-hosted:pro" ? "Pro" : "EE",
          long: planLabels[plan],
        }
      : // no plan, oss
        {
          short: "开源",
          long: "开源版",
        }
    : // null on cloud
      null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          title="版本信息"
          className={cn("mt-[0.2px] text-[0.625rem]", className)}
        >
          {VERSION}
          {selfHostedPlanLabel ? <> {selfHostedPlanLabel.short}</> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        {selfHostedPlanLabel && (
          <>
            <DropdownMenuLabel className="flex items-center font-normal">
              <BadgeCheck size={16} className="mr-2" />
              {selfHostedPlanLabel.long}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link
            href="https://github.com/XiaoleC05/langfuse-token/releases"
            target="_blank"
          >
            <SiGithub size={16} className="mr-2" />
            发布记录
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
