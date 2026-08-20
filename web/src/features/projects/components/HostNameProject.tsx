import { Card } from "@/src/components/ui/card";
import { CodeView } from "@/src/components/ui/CodeJsonViewer";
import Header from "@/src/components/layouts/header";
import { env } from "@/src/env.mjs";

export function HostNameProject() {
  return (
    <div>
      <Header title="主机名称" />
      <Card className="mb-4 p-3">
        <div className="">
          <div className="mb-2 text-sm">连接平台时请使用此主机名/baseurl。</div>
          <CodeView
            content={`${window.location.origin}${env.NEXT_PUBLIC_BASE_PATH ?? ""}`}
          />
        </div>
      </Card>
    </div>
  );
}
