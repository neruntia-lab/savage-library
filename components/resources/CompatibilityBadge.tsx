import type { CompatibilityStatus } from "../../lib/domain/resource";

const labels: Record<CompatibilityStatus, string> = {
  verified: "Verified",
  compatible: "Compatible",
  untested: "Untested",
  outdated: "Outdated",
  unsupported: "Unsupported",
};

export function CompatibilityBadge({
  status,
}: {
  status: CompatibilityStatus;
}) {
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
