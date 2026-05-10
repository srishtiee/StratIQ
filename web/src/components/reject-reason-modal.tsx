"use client";

import { useState } from "react";

export function RejectReasonModal({
  open,
  pending,
  initialValue = "",
  title = "Reject approval",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending?: boolean;
  initialValue?: string;
  title?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<string | null> | string | null;
}) {
  const [reason, setReason] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reject-modal-title">
        <h3 id="reject-modal-title">{title}</h3>
        <p className="muted-copy">Provide a clear reason. This is stored in the audit trail.</p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Example: Evidence is insufficient for execution until sponsor review is complete."
          minLength={8}
        />
        {error ? <p className="muted-copy" style={{ color: "#9a3f3f" }}>{error}</p> : null}
        <div className="button-row">
          <button className="button-secondary" type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            className="button-primary"
            type="button"
            disabled={pending}
            onClick={async () => {
              const trimmed = reason.trim();
              if (trimmed.length < 8) {
                setError("Reason must be at least 8 characters.");
                return;
              }
              const nextError = await onConfirm(trimmed);
              if (nextError) {
                setError(nextError);
              }
            }}
          >
            {pending ? "Saving..." : "Confirm reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
