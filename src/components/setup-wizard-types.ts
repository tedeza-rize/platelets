export type AccountForm = {
  confirmPassword: string;
  email: string;
  fullName: string;
  password: string;
};

export type ApiKeysForm = {
  kakaoMobilityRestApiKey: string;
  kakaoRestApiKey: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  publicDataApiKey: string;
  seoulOpenApiKey: string;
  vworldApiKey: string;
};

export type DatabaseEngine = "mariadb" | "mysql" | "postgresql" | "sqlite";

export type DatabaseForm = {
  connectionString: string;
  engine: DatabaseEngine;
};

export type CheckTextValues = Record<string, number | string>;

export type EnvironmentCheck = {
  detailKey: string;
  detailValues?: CheckTextValues;
  id: string;
  ok: boolean;
  titleKey: string;
};

type NtpServerResult = {
  error: string | null;
  host: string;
  offsetMs: number | null;
  receivedAt: string | null;
  roundTripDelayMs: number | null;
  stratum: number | null;
  valid: boolean;
};

type SetupTimeStatus = {
  checkedAt: string;
  ntp: {
    error: string | null;
    responses: NtpServerResult[];
    selected: NtpServerResult | null;
  };
  ntpServers: string[];
  serverReceivedAt: string;
  serverRespondedAt: string;
  serverTime: string;
  thresholdMs: number;
};

export type StatusPayload = {
  environment: {
    checks: EnvironmentCheck[];
    database: {
      engine: DatabaseEngine;
    };
    databaseCanDelete: boolean;
    databaseExists: boolean;
    ready: boolean;
    time: SetupTimeStatus;
  };
  installed: boolean;
};

export type ThemeMode = "dark" | "light";

export const initialAccount: AccountForm = {
  confirmPassword: "",
  email: "",
  fullName: "",
  password: "",
};

export const initialApiKeys: ApiKeysForm = {
  kakaoMobilityRestApiKey: "",
  kakaoRestApiKey: "",
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  publicDataApiKey: "",
  seoulOpenApiKey: "",
  vworldApiKey: "",
};

export const initialDatabase: DatabaseForm = {
  connectionString: "",
  engine: "sqlite",
};

export const databaseEngineOptions: DatabaseEngine[] = [
  "sqlite",
  "postgresql",
  "mysql",
  "mariadb",
];

export function databaseFromStatus(status: StatusPayload | null): DatabaseForm {
  return {
    connectionString: "",
    engine: status?.environment.database.engine ?? initialDatabase.engine,
  };
}
