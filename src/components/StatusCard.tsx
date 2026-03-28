"use client";

interface StatusCardProps {
  label: string;
  status: "online" | "offline" | "unknown";
  detail?: string;
}

export default function StatusCard({ label, status, detail }: StatusCardProps) {
  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
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
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "online"
                ? "bg-success animate-pulse-dot"
                : status === "offline"
                  ? "bg-danger"
                  : "bg-muted"
            }`}
          />
          {status === "online" ? "Online" : status === "offline" ? "Offline" : "Unknown"}
        </span>
      </div>
      {detail && (
        <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
          {detail}
        </p>
      )}
    </div>
  );
}
