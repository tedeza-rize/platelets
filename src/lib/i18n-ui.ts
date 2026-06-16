import { enUiCore } from "@/lib/i18n-ui-en-core";
import { enUiOperations } from "@/lib/i18n-ui-en-operations";
import { enUiOutput } from "@/lib/i18n-ui-en-output";
import { koUiCore } from "@/lib/i18n-ui-ko-core";
import { koUiOperations } from "@/lib/i18n-ui-ko-operations";
import { koUiOutput } from "@/lib/i18n-ui-ko-output";

export const koUi = {
  ...koUiCore,
  ...koUiOperations,
  ...koUiOutput,
} satisfies Record<string, string>;

export const enUi = {
  ...koUi,
  ...enUiCore,
  ...enUiOperations,
  ...enUiOutput,
} satisfies Record<string, string>;
