/**
 * When running Langfuse in HuggingFace Spaces, the app needs to be opened in a new tab.
 * Otherwise, the app will not be able to access the session cookie.
 */

import { Button } from "@/src/components/ui/button";
import { Oxelia51Icon } from "@/src/components/design-system/Oxelia51Icon/Oxelia51Icon";
import Head from "next/head";
import Link from "next/link";
import { type GetServerSideProps } from "next";
import { env } from "@/src/env.mjs";
import { PlusIcon } from "lucide-react";
import { CodeView } from "@/src/components/ui/CodeJsonViewer";

type PageProps = {
  deploymentDomain: string;
};

export const getServerSideProps: GetServerSideProps<PageProps> = async () => {
  // remove /api/auth from the URL as it needs to be added for custom base url
  const deploymentDomain = env.NEXTAUTH_URL?.replace("/api/auth", "");
  return {
    props: {
      deploymentDomain,
    },
  };
};

export default function HfSpaces({ deploymentDomain }: PageProps) {
  return (
    <>
      <Head>
        <title>Hugging Face 上的 Oxelia51</title>
        <meta
          name="description"
          content="在 Hugging Face Spaces 上免费部署 Oxelia51"
        />
      </Head>
      <div className="flex flex-1 flex-col py-6 sm:min-h-full sm:justify-center sm:px-6 sm:py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex items-center justify-center gap-2">
            <Oxelia51Icon />
            <PlusIcon size={12} className="ml-1" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/huggingface-logo.svg"
              alt="Hugging Face Logo"
              width={36}
              height={36}
            />
          </div>
          <h2 className="text-primary mt-4 text-center text-2xl leading-9 font-bold tracking-tight">
            Hugging Face 上的 Oxelia51
          </h2>
        </div>

        <div className="bg-background mt-14 px-6 py-10 shadow-sm sm:mx-auto sm:w-full sm:max-w-[480px] sm:rounded-lg sm:px-10">
          <div className="space-y-8">
            <CodeView content={deploymentDomain} title="HF Space 主机" />

            <Button className="w-full" asChild>
              <Link
                href={deploymentDomain}
                target="_blank"
                rel="noopener noreferrer"
              >
                在新标签页中打开
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
