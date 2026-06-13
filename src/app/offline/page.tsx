import { headers } from "next/headers";
import { getDictionary, resolveLocale, uiText } from "@/lib/i18n";
import styles from "./offline.module.css";

export const dynamic = "force-dynamic";

export default async function OfflinePage() {
  const headerList = await headers();
  const dictionary = getDictionary(
    resolveLocale(headerList.get("accept-language")),
  );

  return (
    <main
      className={styles.page}
      aria-label={uiText(dictionary, "pwa.offline.aria")}
    >
      <section className={styles.card}>
        <span className={styles.badge}>Platelets</span>
        <h1>{uiText(dictionary, "pwa.offline.title")}</h1>
        <p>{uiText(dictionary, "pwa.offline.description")}</p>
        <a href="/" className={styles.link}>
          {uiText(dictionary, "pwa.offline.retry")}
        </a>
      </section>
    </main>
  );
}
