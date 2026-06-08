import { headers } from "next/headers";
import { MapShell } from "@/components/map-shell";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import styles from "./page.module.css";

export default async function Home() {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get("accept-language"));
  const dictionary = getDictionary(locale);
  const vworldApiKey = process.env.NEXT_PUBLIC_VWORLD_API_KEY ?? "";

  return (
    <div className={styles.page}>
      <nav className={styles.navbar} aria-label={dictionary.navigation.label}>
        <a className={styles.brand} href="/">
          <span className={styles.brandMark} aria-hidden="true" />
          <span>{dictionary.navigation.brand}</span>
        </a>
        <div className={styles.navMeta}>
          <span>{dictionary.navigation.defaultProvider}</span>
        </div>
      </nav>

      <main className={styles.main}>
        <MapShell
          dictionary={dictionary.map}
          initialProvider="vworld"
          vworldApiKey={vworldApiKey}
        />
      </main>
    </div>
  );
}
