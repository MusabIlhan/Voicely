"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/calls", label: "Calls" },
  { href: "/app/meetings", label: "Meetings" },
  { href: "/app/integrations", label: "Integrations" },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <>
      <nav className="border-b border-card-border/50 bg-card/80 backdrop-blur-lg px-6 py-4 sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/app" className="flex items-center gap-3 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent transition-transform group-hover:scale-110">
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
            <span className="text-xl font-bold tracking-tight text-foreground">
              Voisli
            </span>
          </Link>
          <div className="flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive =
                href === "/app" ? pathname === "/app" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/app/demo"
              className={`text-sm font-medium transition-colors ${
                pathname === "/app/demo"
                  ? "text-accent-light border-b border-accent-light pb-0.5"
                  : "text-accent-light hover:text-accent"
              }`}
            >
              Demo
            </Link>
            <div className="ml-2 flex items-center gap-2 border-l border-card-border/50 pl-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-muted">{user?.email}</span>
                  <button
                    onClick={() => {
                      logout();
                      router.push("/");
                    }}
                    className="text-sm font-medium text-muted hover:text-foreground transition-colors"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-muted hover:text-foreground transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-accent-light hover:scale-105 active:scale-95"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </>
  );
}
