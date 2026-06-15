"use client";

import {
  Check,
  Languages,
  Moon,
  Settings2,
  Sun,
  SunMoon,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type AppDictionary, type Locale, uiText } from "@/lib/i18n";
import type { ThemeMode } from "@/lib/preferences";
import styles from "./preference-control.module.css";

const THEME_ICONS = { dark: Moon, light: Sun, system: SunMoon } as const;

async function persistPreference(preference: {
  locale?: Locale;
  theme?: ThemeMode;
}) {
  const response = await fetch("/api/preferences", {
    body: JSON.stringify(preference),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error("preference-save-failed");
}

function applyTheme(theme: ThemeMode) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = theme;
}

type PreferenceControlProps = {
  dictionary: AppDictionary;
  initialLocale: Locale;
  initialTheme: ThemeMode;
};

export function PreferenceControl({
  dictionary,
  initialLocale,
  initialTheme,
}: PreferenceControlProps) {
  const router = useRouter();
  const controlRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [locale, setLocale] = useState(initialLocale);
  const [theme, setTheme] = useState(initialTheme);
  const t = (key: string) => uiText(dictionary, key);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!controlRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  async function selectLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    await persistPreference({ locale: nextLocale });
    router.refresh();
  }

  async function selectTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    await persistPreference({ theme: nextTheme });
  }

  return (
    <div className={styles.control} ref={controlRef}>
      <button
        aria-expanded={isOpen}
        aria-label={t("preferences.open")}
        className={styles.trigger}
        onClick={() => setIsOpen((open) => !open)}
        title={t("preferences.open")}
        type="button"
      >
        {isOpen ? <X aria-hidden="true" /> : <Settings2 aria-hidden="true" />}
      </button>
      {isOpen ? (
        <section aria-label={t("preferences.title")} className={styles.panel}>
          <h2>{t("preferences.title")}</h2>
          <fieldset>
            <legend>
              <Languages aria-hidden="true" />
              {t("preferences.language")}
            </legend>
            <div className={styles.segmented}>
              {(["ko", "en"] as const).map((option) => (
                <button
                  aria-pressed={locale === option}
                  key={option}
                  onClick={async () => selectLocale(option)}
                  type="button"
                >
                  {locale === option ? <Check aria-hidden="true" /> : null}
                  {t(`preferences.language.${option}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t("preferences.theme")}</legend>
            <div className={styles.themeOptions}>
              {(["system", "light", "dark"] as const).map((option) => {
                const Icon = THEME_ICONS[option];
                const label = t(`preferences.theme.${option}`);
                return (
                  <button
                    aria-label={label}
                    aria-pressed={theme === option}
                    key={option}
                    onClick={async () => selectTheme(option)}
                    title={label}
                    type="button"
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>
      ) : null}
    </div>
  );
}
