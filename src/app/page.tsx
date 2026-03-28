import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 text-white"
            >
              <path
                fillRule="evenodd"
                d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">Voisli</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-card-border/60 bg-card/60 px-4 py-1.5 text-sm text-muted backdrop-blur-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse-dot" />
            Powered by Gemini Live
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
            Your AI
            <br />
            <span className="text-accent-light">Voice Assistant</span>
          </h1>

          <p className="text-lg text-muted max-w-md mx-auto leading-relaxed">
            Voisli answers calls, joins meetings, and takes action — so you
            never miss what matters.
          </p>

          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:scale-[1.02] active:scale-[0.98]"
            >
              Open Dashboard
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
            <Link
              href="/app/demo"
              className="inline-flex items-center rounded-lg border border-card-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-card/80"
            >
              Try Demo
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          <div className="glass-card rounded-xl p-6 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent-light">
                <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Smart Calls</h3>
            <p className="text-sm text-muted leading-relaxed">
              AI answers and handles inbound calls with natural conversation.
            </p>
          </div>

          <div className="glass-card rounded-xl p-6 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent-light">
                <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Meeting Notes</h3>
            <p className="text-sm text-muted leading-relaxed">
              Joins meetings, records transcripts, and summarizes key points.
            </p>
          </div>

          <div className="glass-card rounded-xl p-6 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent-light">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1">Integrations</h3>
            <p className="text-sm text-muted leading-relaxed">
              Connects with Twilio, Google Calendar, and more out of the box.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-sm text-muted">
        Voisli &mdash; AI Voice Assistant
      </footer>
    </div>
  );
}
