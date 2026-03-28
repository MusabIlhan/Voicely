"use client";

import { useEffect, useState } from "react";

interface ActiveCall {
  id: string;
  twilioCallSid: string;
  status: string;
  startedAt: string;
}

export default function ActiveCalls({ calls }: { calls: ActiveCall[] }) {
  return (
    <div className="rounded-xl border border-card-border bg-card">
      <div className="border-b border-card-border px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">Active Calls</h2>
      </div>
      {calls.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mx-auto h-10 w-10 text-muted/40"
          >
            <path
              fillRule="evenodd"
              d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
              clipRule="evenodd"
            />
          </svg>
          <p className="mt-3 text-sm text-muted">No active calls</p>
          <p className="mt-1 text-xs text-muted/60">
            Calls will appear here when someone dials your Twilio number
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-card-border">
          {calls.map((call) => (
            <CallRow key={call.id} call={call} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CallRow({ call }: { call: ActiveCall }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    function update() {
      const start = new Date(call.startedAt).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, "0")}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [call.startedAt]);

  return (
    <li className="flex items-center justify-between px-5 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          {call.twilioCallSid}
        </p>
        <p className="text-xs text-muted capitalize">{call.status}</p>
      </div>
      <span className="font-mono text-sm text-accent-light">{elapsed}</span>
    </li>
  );
}
