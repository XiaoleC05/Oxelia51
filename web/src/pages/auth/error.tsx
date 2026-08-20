import { ErrorPageWithSentry } from "@/src/components/error-page";
import { useRouter } from "next/router";
import Head from "next/head";

export default function AuthError() {
  const router = useRouter();
  const { error } = router.query;
  const errorMessage = error
    ? decodeURIComponent(String(error))
    : "发生身份验证错误，请联系支持。";

  return (
    <>
      <Head>
        <title>身份验证错误 | Oxelia51</title>
      </Head>
      <ErrorPageWithSentry title="身份验证错误" message={errorMessage} />
    </>
  );
}
