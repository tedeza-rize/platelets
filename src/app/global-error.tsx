"use client";

import "./globals.css";
import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { useClientDictionary } from "@/lib/client-locale";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { dictionary, locale, theme } = useClientDictionary();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      data-theme={theme === "system" ? undefined : theme}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <title>{dictionary.metadata.title}</title>
        <ErrorState
          dictionary={dictionary}
          digest={error.digest}
          kind="server"
          onRetry={unstable_retry}
        />
      </body>
    </html>
  );
}
