import { requireAccessRole } from "@/lib/access-control";
import {
  crawlAssemblyProtests,
  isAssemblyPoliceAgency,
} from "@/lib/assembly-protests";
import { noStoreJson } from "@/lib/http";
import {
  AdminUpdateCooldownError,
  assertAdminUpdateAvailable,
  recordAdminUpdateUsed,
} from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
}

function readDate(value: unknown) {
  const date = String(value || todayKst()).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export async function POST(request: Request) {
  const [, accessError] = await requireAccessRole(request, "sudo");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    agency?: unknown;
    date?: unknown;
    enrichLocations?: unknown;
  } | null;
  const date = readDate(payload?.date);
  const agency = String(payload?.agency ?? "").trim();

  if (!date) {
    return noStoreJson(
      { error: "date must use YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  if (agency && !isAssemblyPoliceAgency(agency)) {
    return noStoreJson({ error: "Unknown agency." }, { status: 400 });
  }
  const selectedAgency =
    agency && isAssemblyPoliceAgency(agency) ? agency : undefined;

  const action = selectedAgency
    ? `assembly-protests:${selectedAgency}:${date}`
    : `assembly-protests:${date}`;

  try {
    await assertAdminUpdateAvailable(action);
    const result = await crawlAssemblyProtests({
      agency: selectedAgency,
      date,
      enrichLocations: payload?.enrichLocations !== false,
    });
    await recordAdminUpdateUsed(action);

    return noStoreJson({ result });
  } catch (error) {
    if (error instanceof AdminUpdateCooldownError) {
      return noStoreJson(
        {
          cooldown: error.cooldown,
          error: "Update cooldown is active.",
        },
        { status: 429 },
      );
    }

    throw error;
  }
}
