const LiveNotification = () => (
  <div
    className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-xl border border-black/[0.04] rounded-full px-4 py-2 elevation-1"
    style={{ animation: "breathing 4s ease-in-out infinite" }}
  >
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-60" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
    </span>
    <span className="font-mono text-violet-600 font-medium text-[10px] uppercase tracking-ultra">Active</span>
    <span className="w-px h-3 bg-black/10" />
    <span className="text-foreground/70 font-body text-xs font-medium">1,247 conversations right now</span>
  </div>
);

export default LiveNotification;
