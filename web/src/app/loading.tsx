import { RouteLoadingState } from "@/components/route-loading-state";

export default function Loading() {
  return (
    <RouteLoadingState
      label="Loading workspace"
      title="Preparing the StratIQ operating view."
      message="We are gathering workflow context, account signals, and approval-ready surfaces."
    />
  );
}
