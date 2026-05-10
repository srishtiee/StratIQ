import { RouteLoadingState } from "@/components/route-loading-state";

export default function DashboardLoading() {
  return (
    <RouteLoadingState
      label="Loading dashboard"
      title="Pulling revenue risk and portfolio signals."
      message="We are preparing the executive overview, routing metrics, and boardroom highlights."
    />
  );
}
