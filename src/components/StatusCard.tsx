"use client";

interface StatusCardProps {
  label: string;
  status: "online" | "offline" | "unknown";
  detail?: string;
}

export default function StatusCard({ label, status, detail }: StatusCardProps) {
  const colors = {
    online: "bg-success",
    offline: "bg-danger",
    unknown: "bg-muted",
  };

  const labels = {
    online: "Online",
    offline: "Offline",
    unknown: "Unknown",
  };

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status === "online"
              ? "bg-success/10 text-success"
              : status === "offline"
                ? "bg-danger/10 text-danger"
                : "bg-muted/10 text-muted"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${colors[status]}`} />
          {labels[status]}
        </span>
      </div>
      {detail && (
        <p className="mt-2 text-2xl font-bold text-foreground">{detail}</p>
      )}
    </div>
  );
}
