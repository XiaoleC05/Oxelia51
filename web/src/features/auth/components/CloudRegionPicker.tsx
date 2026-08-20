import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/src/components/ui/select";
import type { CloudRegion } from "@/src/features/organizations/cloudRegions";
import { OXELIA_DOCS_URL } from "@/src/features/oxelia51/constants";

export function CloudRegionPicker({
  regions,
  selectedRegion,
  onValueChange,
  isSignUpPage,
}: {
  regions: CloudRegion[];
  selectedRegion?: CloudRegion;
  onValueChange: (value: CloudRegion["name"]) => void;
  isSignUpPage?: boolean;
}) {
  return (
    <div className="bg-card mt-8 -mb-10 rounded-lg px-6 py-6 text-sm sm:mx-auto sm:w-full sm:max-w-[480px] sm:rounded-lg sm:px-10">
      <div className="flex w-full flex-col gap-2">
        <div>
          <span className="text-sm leading-none font-bold">
            数据区域
            <DataRegionInfo />
          </span>
          {isSignUpPage && selectedRegion?.name === "HIPAA" ? (
            <p className="text-muted-foreground text-xs">
              HIPAA 数据区域不提供演示项目。
            </p>
          ) : null}
        </div>
        <Select value={selectedRegion?.name} onValueChange={onValueChange}>
          <SelectTrigger
            className="w-full"
            disableValueLineClamp
            aria-label={
              selectedRegion ? `${selectedRegion.name} data region` : undefined
            }
          >
            {selectedRegion ? (
              <CloudRegionLabel region={selectedRegion} />
            ) : null}
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => (
              <SelectItem key={region.name} value={region.name}>
                <CloudRegionLabel region={region} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedRegion?.name === "HIPAA" && (
          <div className="bg-muted/50 text-muted-foreground mt-2 rounded-md p-3 text-xs">
            <p>
              业务伙伴协议（BAA）仅在 Cloud Pro 和 Teams 套餐中生效。{" "}
              <a
                href="https://langfuse.com/security/hipaa"
                target="_blank"
                rel="noopener noreferrer"
                className="text-link hover:text-link-hover underline"
              >
                了解更多 HIPAA 合规信息 →
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CloudRegionLabel({ region }: { region: CloudRegion }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={
          region.name === "HIPAA"
            ? "translate-y-[-3px] text-xl leading-none"
            : "-translate-y-px text-xl leading-none"
        }
      >
        {region.flag}
      </span>
      <span>{region.name}</span>
    </span>
  );
}

const DataRegionInfo = () => (
  <Dialog>
    <DialogTrigger asChild>
      <a
        href="#"
        className="text-link hover:text-link-hover ml-1 text-xs"
        title="这是什么？"
        tabIndex={-1}
      >
        （这是什么？）
      </a>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>数据区域</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <DialogDescription className="flex flex-col gap-2">
          <p>Langfuse Cloud 提供四个数据区域：</p>
          <ul className="list-disc pl-5">
            <li>US：俄勒冈州（AWS us-west-2）</li>
            <li>EU：爱尔兰（AWS eu-west-1）</li>
            <li>JP：东京（AWS ap-northeast-1）</li>
            <li>
              HIPAA：俄勒冈州（AWS us-west-2）- 符合 HIPAA 的区域（Pro 和 Teams
              套餐可用）
            </li>
          </ul>
          <p>
            各区域之间严格隔离，区域之间不共享任何数据。选择距离较近的区域有助于提升速度，
            并满足本地数据驻留法律和隐私法规的要求。
          </p>
          <p>您可以拥有多个区域的账户。每个区域都需要单独的订阅。</p>
          <p>
            了解更多{" "}
            <a
              href="https://langfuse.com/security/data-regions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:text-link-hover underline"
            >
              数据区域
            </a>{" "}
            以及{" "}
            <a
              href={OXELIA_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:text-link-hover underline"
            >
              数据安全与隐私
            </a>
            的信息。
          </p>
        </DialogDescription>
      </DialogBody>
    </DialogContent>
  </Dialog>
);
