import { fireStationService } from "@/lib/disaster-response/fire-station-service";
import { hospitalService } from "@/lib/disaster-response/hospital-service";
import { incidentService } from "@/lib/disaster-response/incident-service";
import { resourceRecommendationService } from "@/lib/disaster-response/resource-recommendation-service";
import { riskPredictionService } from "@/lib/disaster-response/risk-prediction-service";

export class MapService {
  async getDashboardSnapshot() {
    const [fireStations, hospitals, incidents, infrastructureContext] =
      await Promise.all([
        fireStationService.listFireStations(),
        hospitalService.listHospitals(),
        incidentService.listIncidents(),
        riskPredictionService.buildInfrastructureContext(),
      ]);
    const riskAreas = riskPredictionService.calculateRiskAreas(
      incidents,
      new Date(),
      infrastructureContext,
    );
    const activeIncident =
      incidents.find((incident) => incident.status !== "closed") ??
      incidents[0] ??
      null;

    return {
      activeIncident,
      dispatchRecommendation: activeIncident
        ? await fireStationService.recommendForIncident(activeIncident)
        : null,
      fireStations,
      hospitalRecommendations: activeIncident
        ? await hospitalService.recommendHospitals(activeIncident)
        : [],
      hospitals,
      incidents,
      resourceRecommendations:
        resourceRecommendationService.buildRecommendations(riskAreas),
      riskAreas,
    };
  }
}

export const mapService = new MapService();
