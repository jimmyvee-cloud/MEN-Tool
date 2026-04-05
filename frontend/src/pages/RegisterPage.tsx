import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiJson, setTokens } from "@/lib/api";
import { safeReturnPath } from "@/lib/safeReturnPath";
import { AuthBranding } from "@/components/AuthBranding";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function RegisterPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const returnUrl = params.get("returnUrl");
  const next = safeReturnPath(returnUrl) ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState(params.get("invite") || "");
  const [err, setErr] = useState("");
  const inviteRef = useRef(invite);
  inviteRef.current = invite;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const data = await apiJson<{
        access_token: string;
        refresh_token: string;
      }>("/v1/auth/register", {
        method: "POST",
        skipAuth: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: name,
          invite_code: invite || null,
        }),
      });
      setTokens(data.access_token, data.refresh_token);
      nav("/", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Registration failed");
    }
  }

  return (
    <AuthBranding subtitle="Create your account">
      <form onSubmit={submit} className="w-full space-y-4">
        <input
          className="w-full rounded-xl bg-surface border border-white/10 px-4 py-3"
          placeholder="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl bg-surface border border-white/10 px-4 py-3"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-xl bg-surface border border-white/10 px-4 py-3"
          placeholder="Password (min 8)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="w-full rounded-xl bg-surface border border-white/10 px-4 py-3"
          placeholder="Invite code (optional)"
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
        />
        {err && <p className="text-red-400 text-sm break-all">{err}</p>}
        <button
          type="submit"
          className="w-full gold-gradient text-black font-semibold rounded-xl py-3"
        >
          Register
        </button>
      </form>
      <GoogleSignInButton inviteCodeRef={inviteRef} returnPath={returnUrl} />
      <Link
        to={
          returnUrl
            ? `/login?returnUrl=${encodeURIComponent(returnUrl)}`
            : "/login"
        }
        className="mt-6 text-gold text-sm"
      >
        Back to login
      </Link>
    </AuthBranding>
  );
}
