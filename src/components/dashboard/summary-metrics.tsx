import type { ReactNode } from "react";

import styles from "@/components/dashboard/disaster-dashboard.module.scss";

export type SummaryMetric = {
  icon: ReactNode;
  id: string;
  label: ReactNode;
  value: ReactNode;
};

type SummaryMetricsProps = {
  ariaLabel: string;
  items: SummaryMetric[];
};

export function SummaryMetrics({ ariaLabel, items }: SummaryMetricsProps) {
  return (
    <section className={styles.summaryGrid} aria-label={ariaLabel}>
      {items.map((item) => (
        <article className={styles.metric} key={item.id}>
          {item.icon}
          <span>{item.value}</span>
          <small>{item.label}</small>
        </article>
      ))}
    </section>
  );
}
