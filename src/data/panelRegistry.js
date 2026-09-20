import AccessLogPanel from "../components/AccessLogPanel.vue";
import QueryPanel from "../components/QueryPanel.vue";
import AlertsPanel from "../components/AlertsPanel.vue";
import EntryInspectorPanel from "../components/EntryInspectorPanel.vue";
import HistoryPanel from "../components/HistoryPanel.vue";
import SourcesTreePanel from "../components/SourcesTreePanel.vue";
import TopTalkersContent from "../components/TopTalkersContent.vue";
import ThroughputContent from "../components/ThroughputContent.vue";
import StatusMixContent from "../components/StatusMixContent.vue";
import MethodMixContent from "../components/MethodMixContent.vue";
import SavedFiltersPanel from "../components/SavedFiltersPanel.vue";

// Every panel a dock can host, keyed by the same id used in panelCatalog
// (src/data/mock.js) and in each dock's `dockTabs` list (store/monitor.js).
export const PANEL_REGISTRY = {
  access: { icon: "ph-table", label: "Access log", component: AccessLogPanel },
  query: { icon: "ph-funnel", label: "Query", component: QueryPanel },
  alerts: { icon: "ph-bell-ringing", label: "Alerts", component: AlertsPanel },
  inspector: { icon: "ph-magnifying-glass-plus", label: "Inspector", component: EntryInspectorPanel },
  history: { icon: "ph-clock-counter-clockwise", label: "History", component: HistoryPanel },
  sources: { icon: "ph-hard-drives", label: "Sources", component: SourcesTreePanel },
  talkers: { icon: "ph-ranking", label: "Top talkers", component: TopTalkersContent },
  throughput: { icon: "ph-pulse", label: "Throughput", component: ThroughputContent },
  mix: { icon: "ph-faders", label: "Status", component: StatusMixContent },
  methods: { icon: "ph-arrows-left-right", label: "Methods", component: MethodMixContent },
  saved: { icon: "ph-bookmark-simple", label: "Saved filters", component: SavedFiltersPanel },
};
