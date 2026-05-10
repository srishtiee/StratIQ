"use client";

import Link from "next/link";
import { getLastWorkflowCustomerId, setLastWorkflowCustomerId } from "@/lib/service";

export function WorkflowLink({
  className,
  label,
  fallbackCustomerId,
}: {
  className: string;
  label: string;
  fallbackCustomerId?: string;
}) {
  const remembered = getLastWorkflowCustomerId();
  const customerId = remembered ?? fallbackCustomerId;
  const href = customerId ? `/workflow?customer=${customerId}` : "/workflow";
  return (
    <Link
      className={className}
      href={href}
      onClick={() => {
        if (customerId) {
          setLastWorkflowCustomerId(customerId);
        }
      }}
    >
      {label}
    </Link>
  );
}
