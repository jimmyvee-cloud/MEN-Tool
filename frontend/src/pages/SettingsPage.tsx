import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ChevronLeft, Crown, ExternalLink, Globe } from "lucide-react";
import { apiJson } from "@/lib/api";
import { avatarSrc } from "@/lib/branding";
import { AVATAR_MAX_INPUT_BYTES, prepareAvatarUpload } from "@/lib/avatarImage";
import { PROFILE_TIMEZONES, timezoneLabel } from "@/lib/timezones";
import { useUserHeader } from "@/context/UserHeaderContext";

type Me = {
  user: {
    user_id: string;
    email?: string;
    display_name: string;
    avatar_url?: string;
    tier?: string;
    timezone?: string;
  };
};

export function SettingsPage() {
  const { refresh: refreshHeader } = useUserHeader();
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [subNotice, setSubNotice] = useState<string | null>(null);

  useEffect(() => {
    let ok = true;
    apiJson<Me>("/v1/me")
      .then((m) => {
        if (!ok) return;
        setMe(m);
        setDisplayName(m.user.display_name || "");
        setTimezone((m.user.timezone || "").trim());
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, []);

  async function saveProfile(partial: { display_name?: string; timezone?: string; avatar_url?: string }) {
    setErr(null);
    setSaving(true);
    try {
      const u = await apiJson<Me["user"]>("/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      setMe((prev) => (prev ? { ...prev, user: { ...prev.user, ...u } } : prev));
      if (partial.display_name != null) setDisplayName(u.display_name);
      if (partial.timezone != null) setTimezone((u.timezone || "").trim());
      refreshHeader();
    } catch {
      setErr("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setErr(
        `Photo is too large (max ${Math.round(AVATAR_MAX_INPUT_BYTES / (1024 * 1024))}MB). Try another shot or pick a smaller file.`
      );
      return;
    }
    setAvatarBusy(true);
    setErr(null);
    void (async () => {
      try {
        const dataUrl = await prepareAvatarUpload(file);
        await saveProfile({ avatar_url: dataUrl });
      } catch {
        setErr("Could not process this photo. Try JPG or PNG from your gallery.");
      } finally {
        setAvatarBusy(false);
      }
    })();
    e.target.value = "";
  }

  const tier = me?.user.tier || "free";
  const isPremium = tier === "premium" || tier === "admin";
  const email = me?.user.email || "";

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6 pb-10">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-muted p-1" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg font-semibold text-white flex-1">Settings</h1>
      </div>

      {err && (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      )}
      {subNotice && (
        <p className="text-sm text-muted" role="status">
          {subNotice}
        </p>
      )}

      {me && (
        <>
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-28 h-28 rounded-full bg-surface border-2 border-gold/35 overflow-hidden">
                <img
                  src={avatarSrc(me.user.avatar_url)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarBusy}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-black shadow-lg border-2 border-night disabled:opacity-50"
                aria-label="Change profile photo"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarPick}
              />
            </div>
            <p className="text-xs text-muted mt-2 text-center max-w-[260px]">
              Tap the camera icon to change your photo
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted">Display name</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl bg-night border border-white/10 px-3 py-3 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
              />
              <button
                type="button"
                disabled={saving || !displayName.trim() || displayName.trim() === me.user.display_name}
                onClick={() => void saveProfile({ display_name: displayName.trim() })}
                className="shrink-0 px-4 rounded-xl gold-gradient text-black font-semibold text-sm disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-gold" /> Timezone
            </label>
            <select
              className="w-full rounded-xl bg-night border border-white/10 px-3 py-3 text-sm text-white"
              value={timezone || ""}
              onChange={(e) => {
                const v = e.target.value;
                setTimezone(v);
                void saveProfile({ timezone: v });
              }}
            >
              <option value="">Select timezone…</option>
              {PROFILE_TIMEZONES.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              Controls when your &quot;today&quot; resets for check-ins and logs.
              {timezone ? ` Currently: ${timezoneLabel(timezone)}.` : ""}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted">Subscription</label>
            <div className="card space-y-3 border-gold/20">
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-gold shrink-0" />
                <div>
                  <div className="font-semibold text-white">Men-TOOL Premium</div>
                  <div className="text-xs text-muted">
                    {isPremium ? "You have full access." : "Upgrade for premium features."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gold/40 text-gold text-sm font-medium"
                onClick={() =>
                  setSubNotice(
                    "Subscription management will open your billing provider when it is connected for this app."
                  )
                }
              >
                Manage subscription <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {email && (
            <p className="text-center text-xs text-muted pt-2">Signed in as {email}</p>
          )}
        </>
      )}

      {!me && <p className="text-sm text-muted">Loading…</p>}
    </div>
  );
}
