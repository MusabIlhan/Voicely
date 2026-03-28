"use client";

interface StatusCardProps {
  label: string;
  status: "online" | "offline" | "unknown" | "unconfigured";
  detail?: string;
  error?: string;
  latencyMs?: number;
}

export default function StatusCard({ label, status, detail, error, latencyMs }: StatusCardProps) {
  const statusConfig = {
    online: { bg: "bg-success/8 text-success", dot: "bg-success animate-pulse-dot", text: "Online" },
    offline: { bg: "bg-danger/8 text-danger", dot: "bg-danger", text: "Offline" },
    unknown: { bg: "bg-muted/8 text-muted", dot: "bg-muted", text: "Unknown" },
    unconfigured: { bg: "bg-warning/8 text-warning", dot: "bg-warning", text: "Not Configured" },
  };

  const cfg = statusConfig[status];

  return (
    <div className="glass-card rounded-2xl p-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.text}
        </span>
      </div>
      {detail && (
        <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
          {detail}
        </p>
      )}
      {latencyMs !== undefined && status === "online" && (
        <p className="mt-1 text-xs text-muted/70">{latencyMs}ms latency</p>
      )}
      {error && (
        <div className="mt-2 rounded-xl bg-danger/5 border border-danger/15 px-3 py-2">
          <p className="text-xs text-danger break-words">{error}</p>
        </div>
      )}
    </div>
  );
}
