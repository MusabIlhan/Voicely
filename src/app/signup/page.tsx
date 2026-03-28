"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignupForm } from "@/components/SignupForm";
import { useAuth } from "@/hooks/useAuth";

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="glass-card rounded-2xl p-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create Account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sign up to get started with Voisli
          </p>

          <div className="mt-6">
            <SignupForm
              onSuccess={(user) => {
                login(user);
                router.push("/");
              }}
            />
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-accent-light hover:text-accent transition-colors"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
