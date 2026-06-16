import {
  ArrowLeft,
  Check,
  Database,
  FileCheck2,
  KeyRound,
  Languages,
  type LucideIcon,
  Moon,
  ServerCog,
  ShieldAlert,
  Sun,
  UserCog,
  Users,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { SetupDictionary, SetupDictionaryKey } from "@/lib/setup-i18n";
import { ContinueIcon } from "./setup-wizard-controls";
import styles from "./setup-wizard-shell.module.css";
import type { ThemeMode } from "./setup-wizard-types";

type SetupStep = {
  icon: LucideIcon;
  id: "admin" | "api" | "environment" | "finish" | "license" | "start" | "sudo";
  labelKey: SetupDictionaryKey;
};

type Translator = (
  key: SetupDictionaryKey,
  values?: Record<string, string | number>,
) => string;

export const setupSteps = [
  { icon: ShieldAlert, id: "start", labelKey: "step.start" },
  { icon: FileCheck2, id: "license", labelKey: "step.license" },
  { icon: ServerCog, id: "environment", labelKey: "step.environment" },
  { icon: UserCog, id: "sudo", labelKey: "step.sudo" },
  { icon: Users, id: "admin", labelKey: "step.admin" },
  { icon: KeyRound, id: "api", labelKey: "step.api" },
  { icon: Database, id: "finish", labelKey: "step.finish" },
] as const satisfies readonly SetupStep[];

export function SetupSidebar({
  copy,
  stepIndex,
  t,
}: {
  copy: SetupDictionary;
  stepIndex: number;
  t: Translator;
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <ShieldAlert aria-hidden="true" size={22} strokeWidth={2.6} />
          </span>
          <div>
            <strong>{copy["brand.name"]}</strong>
            <span>{copy["brand.subtitle"]}</span>
          </div>
        </div>
      </div>

      <ol className={styles.steps}>
        {setupSteps.map((step, index) => {
          const Icon = step.icon;
          const isDone = index < stepIndex;
          const isActive = index === stepIndex;

          return (
            <li
              className={isActive ? styles.stepActive : styles.step}
              key={step.id}
            >
              <span className={isDone ? styles.stepDone : styles.stepMark}>
                {isDone ? (
                  <Check aria-hidden="true" size={16} />
                ) : (
                  <Icon aria-hidden="true" size={16} />
                )}
              </span>
              <span>{copy[step.labelKey]}</span>
            </li>
          );
        })}
      </ol>

      <span className={styles.stepCount}>
        {t("status.step", {
          current: stepIndex + 1,
          total: setupSteps.length,
        })}
      </span>
    </aside>
  );
}

export function SetupTopControls({
  copy,
  locale,
  onLocaleChange,
  onThemeChange,
  theme,
}: {
  copy: SetupDictionary;
  locale: Locale;
  onLocaleChange: (nextLocale: Locale) => void;
  onThemeChange: (nextTheme: ThemeMode) => void;
  theme: ThemeMode;
}) {
  return (
    <div className={styles.controls}>
      <fieldset
        aria-label={copy["controls.language"]}
        className={styles.segmented}
      >
        <button
          aria-label={copy["language.ko"]}
          aria-pressed={locale === "ko"}
          onClick={() => onLocaleChange("ko")}
          title={copy["controls.language"]}
          type="button"
        >
          <Languages aria-hidden="true" size={15} />
          <span>{copy["language.ko"]}</span>
        </button>
        <button
          aria-label={copy["language.en"]}
          aria-pressed={locale === "en"}
          onClick={() => onLocaleChange("en")}
          title={copy["controls.language"]}
          type="button"
        >
          <Languages aria-hidden="true" size={15} />
          <span>{copy["language.en"]}</span>
        </button>
      </fieldset>
      <fieldset
        aria-label={copy["controls.theme"]}
        className={styles.segmented}
      >
        <button
          aria-label={copy["theme.light"]}
          aria-pressed={theme === "light"}
          onClick={() => onThemeChange("light")}
          title={copy["theme.light"]}
          type="button"
        >
          <Sun aria-hidden="true" size={15} />
        </button>
        <button
          aria-label={copy["theme.dark"]}
          aria-pressed={theme === "dark"}
          onClick={() => onThemeChange("dark")}
          title={copy["theme.dark"]}
          type="button"
        >
          <Moon aria-hidden="true" size={15} />
        </button>
      </fieldset>
    </div>
  );
}

export function SetupFooter({
  copy,
  isBusy,
  isHydrated,
  isLastStep,
  onBack,
  onContinue,
  stepIndex,
}: {
  copy: SetupDictionary;
  isBusy: boolean;
  isHydrated: boolean;
  isLastStep: boolean;
  onBack: () => void;
  onContinue: () => void;
  stepIndex: number;
}) {
  return (
    <footer className={styles.footer}>
      <button
        className={styles.backButton}
        disabled={!isHydrated || stepIndex === 0 || isBusy}
        onClick={onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={17} /> {copy["nav.back"]}
      </button>
      <button
        className={styles.primaryButton}
        disabled={!isHydrated || isBusy}
        onClick={onContinue}
        type="button"
      >
        <ContinueIcon busy={isBusy} lastStep={isLastStep} />
        {isLastStep ? copy["nav.install"] : copy["nav.continue"]}
      </button>
    </footer>
  );
}
