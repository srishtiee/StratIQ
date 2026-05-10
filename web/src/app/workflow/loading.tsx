import { RouteLoadingState } from "@/components/route-loading-state";

export default function WorkflowLoading() {
  return (
    <RouteLoadingState
      label="Loading workflow"
      title="Preparing the decision workspace."
      message="We are assembling the ask lane, evidence lane, and approval lane for operator review."
    />
  );
}
