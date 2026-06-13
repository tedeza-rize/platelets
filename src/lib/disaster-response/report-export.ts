import { incidentService } from "@/lib/disaster-response/incident-service";
import { mapService } from "@/lib/disaster-response/map-service";
import type {
  Incident,
  IncidentEvent,
  ResourceRecommendation,
} from "@/lib/disaster-response/types";
import { type AppDictionary, uiText } from "@/lib/i18n";

const REPORT_CONTENT_TYPE = "application/vnd.ms-excel; charset=utf-8";
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

type DashboardSnapshot = Awaited<
  ReturnType<typeof mapService.getDashboardSnapshot>
>;
type CellValue = number | string | null | undefined;
type Worksheet = {
  name: string;
  rows: CellValue[][];
};

export type DisasterReportWorkbook = {
  body: string;
  contentType: string;
  filename: string;
};

type DisasterReportOptions = {
  dictionary: AppDictionary;
  eventsByIncident?: Map<string, IncidentEvent[]>;
  generatedAt?: Date;
  snapshot?: DashboardSnapshot;
};

function reportText(dictionary: AppDictionary, key: string) {
  return uiText(dictionary, `report.export.${key}`);
}

export function escapeSpreadsheetXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeSpreadsheetText(value: CellValue) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
}

function cell(value: CellValue) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  return `<Cell><Data ss:Type="String">${escapeSpreadsheetXml(
    safeSpreadsheetText(value),
  )}</Data></Cell>`;
}

function row(values: CellValue[], isHeader = false) {
  const style = isHeader ? ' ss:StyleID="header"' : "";
  return `<Row${style}>${values.map(cell).join("")}</Row>`;
}

function worksheetName(name: string) {
  return name.replace(/[\]:*?/\\]/g, " ").slice(0, 31);
}

function worksheet(sheet: Worksheet) {
  const [header = [], ...dataRows] = sheet.rows;
  return `<Worksheet ss:Name="${escapeSpreadsheetXml(
    worksheetName(sheet.name),
  )}"><Table>${row(header, true)}${dataRows
    .map((values) => row(values))
    .join("")}</Table></Worksheet>`;
}

function workbook(sheets: Worksheet[]) {
  return `${XML_DECLARATION}
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" />
      <Interior ss:Color="#E2F0D9" ss:Pattern="Solid" />
    </Style>
  </Styles>
  ${sheets.map(worksheet).join("\n  ")}
</Workbook>`;
}

function timestampForFilename(date: Date) {
  return date.toISOString().replace(/\D/g, "").slice(0, 14);
}

function overviewRows(
  dictionary: AppDictionary,
  generatedAt: Date,
  snapshot: DashboardSnapshot,
): CellValue[][] {
  const openIncidents = snapshot.incidents.filter(
    (incident) => incident.status !== "closed",
  ).length;

  return [
    [reportText(dictionary, "field"), reportText(dictionary, "value")],
    [reportText(dictionary, "generatedAt"), generatedAt.toISOString()],
    [reportText(dictionary, "incidentCount"), snapshot.incidents.length],
    [reportText(dictionary, "openIncidentCount"), openIncidents],
    [
      reportText(dictionary, "riskAreaCount"),
      snapshot.riskAreas.filter((area) => area.riskLevel !== "low").length,
    ],
    [
      reportText(dictionary, "resourceRecommendationCount"),
      snapshot.resourceRecommendations.length,
    ],
    [
      reportText(dictionary, "activeIncident"),
      snapshot.activeIncident?.title ?? reportText(dictionary, "none"),
    ],
  ];
}

function incidentRows(
  dictionary: AppDictionary,
  incidents: Incident[],
): CellValue[][] {
  return [
    [
      reportText(dictionary, "incidentId"),
      reportText(dictionary, "title"),
      reportText(dictionary, "type"),
      reportText(dictionary, "riskLevel"),
      reportText(dictionary, "status"),
      reportText(dictionary, "address"),
      reportText(dictionary, "occurredAt"),
      reportText(dictionary, "createdAt"),
      reportText(dictionary, "latitude"),
      reportText(dictionary, "longitude"),
      reportText(dictionary, "description"),
    ],
    ...incidents.map((incident) => [
      incident.id,
      incident.title,
      incident.type,
      incident.riskLevel,
      incident.status,
      incident.address,
      incident.occurredAt,
      incident.createdAt,
      incident.latitude,
      incident.longitude,
      incident.description,
    ]),
  ];
}

function historyRows(
  dictionary: AppDictionary,
  incidents: Incident[],
  eventsByIncident: Map<string, IncidentEvent[]>,
): CellValue[][] {
  return [
    [
      reportText(dictionary, "incidentId"),
      reportText(dictionary, "eventType"),
      reportText(dictionary, "fromStatus"),
      reportText(dictionary, "toStatus"),
      reportText(dictionary, "message"),
      reportText(dictionary, "createdAt"),
    ],
    ...incidents.flatMap((incident) =>
      (eventsByIncident.get(incident.id) ?? []).map((event) => [
        event.incidentId,
        event.type,
        event.fromStatus ?? "",
        event.toStatus ?? "",
        event.message,
        event.createdAt,
      ]),
    ),
  ];
}

function resourceRows(
  dictionary: AppDictionary,
  recommendations: ResourceRecommendation[],
): CellValue[][] {
  return [
    [
      reportText(dictionary, "areaId"),
      reportText(dictionary, "areaName"),
      reportText(dictionary, "priority"),
      reportText(dictionary, "riskScore"),
      reportText(dictionary, "fireEngines"),
      reportText(dictionary, "ambulances"),
      reportText(dictionary, "rescueTrucks"),
      reportText(dictionary, "timeWindow"),
      reportText(dictionary, "message"),
      reportText(dictionary, "reasons"),
    ],
    ...recommendations.map((recommendation) => [
      recommendation.areaId,
      recommendation.areaName,
      recommendation.priority,
      recommendation.riskScore,
      recommendation.recommendedFireEngines,
      recommendation.recommendedAmbulances,
      recommendation.recommendedRescueTrucks,
      recommendation.timeWindow,
      recommendation.message,
      recommendation.reasons.join("\n"),
    ]),
  ];
}

async function loadIncidentEvents(
  incidents: Incident[],
  provided?: Map<string, IncidentEvent[]>,
) {
  if (provided) {
    return provided;
  }

  const entries = await Promise.all(
    incidents.map(
      async (incident) =>
        [
          incident.id,
          await incidentService.listIncidentEvents(incident.id),
        ] as const,
    ),
  );

  return new Map(entries);
}

export async function buildDisasterReportWorkbook({
  dictionary,
  eventsByIncident,
  generatedAt = new Date(),
  snapshot,
}: DisasterReportOptions): Promise<DisasterReportWorkbook> {
  const resolvedSnapshot =
    snapshot ?? (await mapService.getDashboardSnapshot());
  const resolvedEvents = await loadIncidentEvents(
    resolvedSnapshot.incidents,
    eventsByIncident,
  );
  const sheets: Worksheet[] = [
    {
      name: reportText(dictionary, "sheetOverview"),
      rows: overviewRows(dictionary, generatedAt, resolvedSnapshot),
    },
    {
      name: reportText(dictionary, "sheetIncidents"),
      rows: incidentRows(dictionary, resolvedSnapshot.incidents),
    },
    {
      name: reportText(dictionary, "sheetHistory"),
      rows: historyRows(dictionary, resolvedSnapshot.incidents, resolvedEvents),
    },
    {
      name: reportText(dictionary, "sheetResources"),
      rows: resourceRows(dictionary, resolvedSnapshot.resourceRecommendations),
    },
  ];

  return {
    body: workbook(sheets),
    contentType: REPORT_CONTENT_TYPE,
    filename: `platelets-disaster-report-${timestampForFilename(
      generatedAt,
    )}.xls`,
  };
}
