import structureStyles from "./disaster-dashboard.module.scss";
import listStyles from "./disaster-dashboard-lists.module.scss";
import mapStyles from "./disaster-dashboard-map.module.scss";
import overlayStyles from "./disaster-dashboard-overlays.module.scss";

const styles = {
  ...structureStyles,
  ...mapStyles,
  ...overlayStyles,
  ...listStyles,
};

export default styles;
