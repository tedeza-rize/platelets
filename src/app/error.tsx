"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { useClientDictionary } from "@/lib/client-locale";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { dictionary } = useClientDictionary();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      dictionary={dictionary}
      digest={error.digest}
      kind="server"
      onRetry={unstable_retry}
    />
  );
}
