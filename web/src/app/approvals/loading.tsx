import { RouteLoadingState } from "@/components/route-loading-state";

export default function ApprovalsLoading() {
  return (
    <RouteLoadingState
      label="Loading approvals"
      title="Collecting governed action requests."
      message="We are assembling owner routing, impact summaries, and execution checkpoints."
    />
  );
}
