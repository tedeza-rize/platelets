import styles from "./management-loading.module.scss";

export function ManagementLoading() {
  return (
    <div aria-busy="true" className={styles.page}>
      <div aria-hidden="true" className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.pill} />
            <div className={styles.line} />
            <div className={styles.shortLine} />
          </div>
          <div className={styles.line} />
        </header>
        <div className={styles.tabs}>
          <div className={styles.tab} />
          <div className={styles.tab} />
          <div className={styles.tab} />
          <div className={styles.tab} />
          <div className={styles.tab} />
        </div>
        <section className={styles.intro}>
          <div className={styles.shortLine} />
          <div className={styles.line} />
        </section>
        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.shortLine} />
            <div className={styles.metric} />
            <div className={styles.line} />
          </div>
          <div className={styles.card}>
            <div className={styles.shortLine} />
            <div className={styles.metric} />
            <div className={styles.line} />
          </div>
          <div className={styles.card}>
            <div className={styles.shortLine} />
            <div className={styles.metric} />
            <div className={styles.line} />
          </div>
          <div className={styles.wideCard}>
            <div className={styles.row} />
            <div className={styles.row} />
            <div className={styles.row} />
          </div>
        </section>
      </div>
    </div>
  );
}
