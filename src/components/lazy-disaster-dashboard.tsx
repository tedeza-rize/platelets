"use client";

import dynamic from "next/dynamic";
import type { DisasterDashboardProps } from "./disaster-dashboard";
import styles from "./disaster-dashboard.module.css";

function DisasterDashboardLoading() {
  return (
    <div aria-hidden="true" className={styles.loadingPage}>
      <div className={styles.loadingHeader}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.loadingShell}>
        <div className={styles.loadingMap} />
        <div className={styles.loadingPanel}>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

const DynamicDisasterDashboard = dynamic(
  () =>
    import("./disaster-dashboard").then((module) => module.DisasterDashboard),
  { loading: DisasterDashboardLoading },
);

export function LazyDisasterDashboard(props: DisasterDashboardProps) {
  return <DynamicDisasterDashboard {...props} />;
}
