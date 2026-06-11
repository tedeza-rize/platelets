import { incidentService } from "@/lib/disaster-response/incident-service";
import { resourceRecommendationService } from "@/lib/disaster-response/resource-recommendation-service";
import { riskPredictionService } from "@/lib/disaster-response/risk-prediction-service";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const infrastructureContext =
    await riskPredictionService.buildInfrastructureContext();
  const riskAreas = riskPredictionService.calculateRiskAreas(
    await incidentService.listIncidents(),
    new Date(),
    infrastructureContext,
  );

  return noStoreJson({
    recommendations:
      resourceRecommendationService.buildRecommendations(riskAreas),
  });
}
