import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiJson, formatApiError, setTokens } from "@/lib/api";
import { AuthBranding } from "@/components/AuthBranding";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const data = await apiJson<{
        access_token: string;
        refresh_token: string;
      }>("/v1/auth/login", {
        method: "POST",
        skipAuth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setTokens(data.access_token, data.refresh_token);
      nav("/", { replace: true });
    } catch (ex) {
      setErr(formatApiError(ex));
    }
  }

  return (
    <AuthBranding subtitle="Sign in">
      <form onSubmit={submit} className="w-full space-y-4">
        <input
          className="w-full rounded-xl bg-surface border border-white/10 px-4 py-3 text-white"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-xl bg-surface border border-white/10 px-4 py-3 text-white"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button
          type="submit"
          className="w-full gold-gradient text-black font-semibold rounded-xl py-3"
        >
          Login
        </button>
      </form>
      <GoogleSignInButton />
      <Link to="/register" className="mt-6 text-gold text-sm">
        Create account
      </Link>
    </AuthBranding>
  );
}
