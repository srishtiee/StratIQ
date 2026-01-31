import { RouteLoadingState } from "@/components/route-loading-state";

export default function CustomerLoading() {
  return (
    <RouteLoadingState
      label="Loading customer"
      title="Preparing the account brief."
      message="We are pulling risk drivers, ownership context, and the recommended next action."
    />
  );
}
