import { RouteLoadingState } from "@/components/route-loading-state";

export default function Loading() {
  return (
    <RouteLoadingState
      label="Loading audit"
      title="Preparing workflow and approval history."
      message="We are collecting recent run events, approvals, and action transitions for review."
    />
  );
}
