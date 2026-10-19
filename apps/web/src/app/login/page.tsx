"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";

type User = { id: string; email: string; name: string; role: "COACH" | "STUDENT" };

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () =>
      apiRequest<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: async (user) => {
      queryClient.setQueryData(["me"], user);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate();
  }

  return (
    <main className="login-screen">
      <div className="login-intro">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>Kingdom <strong>of Chess</strong></span>
        </Link>
        <div className="login-copy">
          <p className="eyebrow">A place to play</p>
          <h1>Make your next move count.</h1>
          <p className="muted">
            Join your academy tournaments, meet a worthy opponent, and play
            every game on a level board.
          </p>
        </div>
        <p className="login-footnote">Thoughtful competition, one move at a time.</p>
      </div>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <p className="eyebrow">Welcome back</p>
          <h2 id="login-title">Sign in to your account</h2>
          <p className="muted">Use the email address linked to your academy account.</p>
          <form className="form-stack" onSubmit={submit}>
            <label className="field">
              <span>Email</span>
              <input
                autoComplete="email"
                autoFocus
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {login.isError && (
              <p className="notice notice-error" role="alert">
                {login.error.message}
              </p>
            )}
            <Button disabled={login.isPending} fullWidth>
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="login-note">
            Need an account? Ask your coach to share your academy login.
          </p>
        </div>
      </section>
    </main>
  );
}
