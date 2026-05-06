import Link from "next/link";
import React from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({ page, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "2rem", justifyContent: "center" }}>
      {page > 1 ? (
        <Link href={`${basePath}?page=${page - 1}`} className="button-secondary">
          Previous
        </Link>
      ) : (
        <span className="button-secondary" style={{ opacity: 0.5, pointerEvents: "none" }}>
          Previous
        </span>
      )}

      <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        Page {page} of {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={`${basePath}?page=${page + 1}`} className="button-secondary">
          Next
        </Link>
      ) : (
        <span className="button-secondary" style={{ opacity: 0.5, pointerEvents: "none" }}>
          Next
        </span>
      )}
    </div>
  );
}
