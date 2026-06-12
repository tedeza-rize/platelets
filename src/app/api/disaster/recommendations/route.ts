import { fireStationService } from "@/lib/disaster-response/fire-station-service";
import { hospitalService } from "@/lib/disaster-response/hospital-service";
import { incidentService } from "@/lib/disaster-response/incident-service";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const incidentId = url.searchParams.get("incidentId");
  const incident = incidentId
    ? await incidentService.getIncident(incidentId)
    : (await incidentService.listIncidents())[0];

  if (!incident) {
    return noStoreJson(
      { error: "사고 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return noStoreJson({
    dispatchRecommendation:
      await fireStationService.recommendForIncident(incident),
    hospitalRecommendations: await hospitalService.recommendHospitals(incident),
    incident,
  });
}
