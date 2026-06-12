"use client";

import { ArrowLeft, ExternalLink, Map as MapIcon, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DataLicenseEntry } from "@/lib/data-licenses";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./license-browser.module.css";

type LicenseBrowserProps = {
  dictionary: AppDictionary;
  entries: readonly DataLicenseEntry[];
};

export function LicenseBrowser({ dictionary, entries }: LicenseBrowserProps) {
  const t = (key: string) => uiText(dictionary, key);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) {
      return entries;
    }

    return entries.filter((entry) =>
      [
        entry.id,
        entry.license,
        entry.notes,
        entry.provider,
        entry.sourceName,
        entry.sourceUrl,
        ...(entry.sourceUrls ?? []).flatMap((source) => [
          source.label,
          source.url,
        ]),
        entry.usage,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [entries, normalizedQuery]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/">
          <ArrowLeft aria-hidden="true" size={17} strokeWidth={2.5} />
          <span>{t("지도")}</span>
        </Link>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Platelets data registry</span>
          <h1>{t("데이터 출처 및 라이선스")}</h1>
          <p>
            {t(
              "지도 타일, 공공 API, 좌표 데이터, 파생 GeoJSON까지 화면에 쓰이는 외부 출처와 이용 조건을 한곳에서 확인합니다.",
            )}
          </p>
        </div>
        <section className={styles.summaryGrid} aria-label={t("라이선스 요약")}>
          <div>
            <strong>
              {entries.length.toLocaleString(dictionary.formatLocale)}
            </strong>
            <span>{t("등록 출처")}</span>
          </div>
          <div>
            <strong>
              {entries
                .filter((entry) => entry.usage.includes("지도"))
                .length.toLocaleString("ko-KR")}
            </strong>
            <span>{t("지도 관련")}</span>
          </div>
          <div>
            <strong>0</strong>
            <span>{t("키 노출")}</span>
          </div>
        </section>
      </header>

      <section className={styles.toolbar} aria-label={t("라이선스 검색")}>
        <label className={styles.searchBox}>
          <Search aria-hidden="true" size={18} strokeWidth={2.5} />
          <span>{t("출처 검색")}</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("제공기관, 라이선스, 사용처 검색")}
            type="search"
            value={query}
          />
        </label>
        <span className={styles.resultCount}>
          {filteredEntries.length.toLocaleString(dictionary.formatLocale)}
          {t("개 표시")}
        </span>
      </section>

      <section className={styles.list} aria-label={t("데이터 출처 목록")}>
        {filteredEntries.map((entry) => (
          <article className={styles.card} key={entry.id}>
            <div className={styles.cardHeader}>
              <span className={styles.sourceBadge}>
                <MapIcon aria-hidden="true" size={15} strokeWidth={2.4} />
                {entry.id}
              </span>
              <h2>{entry.sourceName}</h2>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>{t("제공기관")}</dt>
                <dd>{entry.provider}</dd>
              </div>
              <div>
                <dt>{t("사용처")}</dt>
                <dd>{entry.usage}</dd>
              </div>
              <div>
                <dt>{t("라이선스")}</dt>
                <dd>{entry.license}</dd>
              </div>
              <div>
                <dt>{t("출처")}</dt>
                <dd>
                  {(
                    entry.sourceUrls ?? [
                      { label: entry.sourceUrl, url: entry.sourceUrl },
                    ]
                  ).map((source) => (
                    <a
                      href={source.url}
                      key={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span>{source.label}</span>
                      <ExternalLink
                        aria-hidden="true"
                        size={14}
                        strokeWidth={2.5}
                      />
                    </a>
                  ))}
                </dd>
              </div>
              <div>
                <dt>{t("비고")}</dt>
                <dd>{entry.notes}</dd>
              </div>
            </dl>
          </article>
        ))}
        {filteredEntries.length === 0 ? (
          <p className={styles.empty}>{t("검색 결과가 없습니다.")}</p>
        ) : null}
      </section>
    </main>
  );
}
