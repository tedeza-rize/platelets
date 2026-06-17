import type { ReactNode } from "react";

import styles from "@/components/dashboard/disaster-dashboard-styles";

export type MapLegendItem = {
  id: string;
  label: ReactNode;
  markerClassName: string;
};

type MapLegendProps = {
  items: MapLegendItem[];
};

export function MapLegend({ items }: MapLegendProps) {
  return (
    <div className={styles.mapLegend}>
      {items.map((item) => (
        <span key={item.id}>
          <i className={item.markerClassName} /> {item.label}
        </span>
      ))}
    </div>
  );
}
