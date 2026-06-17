import { notFound } from "next/navigation";
import { type ErrorKind, ErrorState } from "@/components/feedback/error-state";
import { getDictionary } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-preferences";

export const dynamic = "force-dynamic";

const ERROR_KINDS = new Set<string>([
  "badRequest",
  "conflict",
  "dataUnavailable",
  "forbidden",
  "gatewayTimeout",
  "maintenance",
  "mapLoad",
  "notFound",
  "offline",
  "rateLimited",
  "routeFailed",
  "server",
  "serviceUnavailable",
  "sessionExpired",
  "timeSync",
  "trainingRoom",
  "unauthorized",
]);

type ErrorKindPageProps = {
  readonly params: Promise<{
    readonly kind: string;
  }>;
};

export default async function ErrorKindPage(props: ErrorKindPageProps) {
  const { kind } = await props.params;

  if (!ERROR_KINDS.has(kind)) {
    notFound();
  }

  const dictionary = getDictionary(await getRequestLocale());
  return <ErrorState dictionary={dictionary} kind={kind as ErrorKind} />;
}
