import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Crown,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Share2,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api";
import { DashboardHeader } from "@/components/DashboardHeader";

type U = {
  user_id: string;
  email: string;
  display_name: string;
  tier: string;
  created_at: string;
  invite_code: string;
  is_active?: boolean;
};

type GlobalPreset = {
  preset_id: string;
  title: string;
  category: string;
  preset_entity: string;
  duration_seconds?: number;
  youtube_url?: string;
  description?: string;
  becomehim_stage?: string;
};

function GlobalPresetRow({
  preset,
  onReload,
  onError,
  busy,
  setBusy,
}: {
  preset: GlobalPreset;
  onReload: () => void;
  onError: (msg: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [title, setTitle] = useState(preset.title);
  const [category, setCategory] = useState(preset.category);
  const [entity, setEntity] = useState(preset.preset_entity);
  const [durationSeconds, setDurationSeconds] = useState(String(preset.duration_seconds ?? 0));
  const [youtubeUrl, setYoutubeUrl] = useState(preset.youtube_url ?? "");
  const [description, setDescription] = useState(preset.description ?? "");
  const [stage, setStage] = useState(preset.becomehim_stage ?? "");

  useEffect(() => {
    setTitle(preset.title);
    setCategory(preset.category);
    setEntity(preset.preset_entity);
    setDurationSeconds(String(preset.duration_seconds ?? 0));
    setYoutubeUrl(preset.youtube_url ?? "");
    setDescription(preset.description ?? "");
    setStage(preset.becomehim_stage ?? "");
  }, [preset]);

  async function save() {
    setBusy(true);
    onError("");
    try {
      const dur = Math.max(0, Math.min(86400, parseInt(durationSeconds, 10) || 0));
      const res = await apiFetch(`/v1/admin/presets/global/${preset.preset_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim(),
          preset_entity: entity,
          duration_seconds: dur,
          youtube_url: youtubeUrl.trim(),
          description: description.trim(),
          becomehim_stage: stage.trim(),
        }),
      });
      if (!res.ok) {
        onError((await res.text()) || `${res.status}`);
        return;
      }
      await onReload();
    } catch {
      onError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete global preset “${preset.title}”? Links to /relievers/preset/${preset.preset_id} will break.`)) {
      return;
    }
    setBusy(true);
    onError("");
    try {
      const res = await apiFetch(`/v1/admin/presets/global/${preset.preset_id}`, { method: "DELETE" });
      if (!res.ok) {
        onError((await res.text()) || `${res.status}`);
        return;
      }
      await onReload();
    } catch {
      onError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted font-mono">{preset.preset_id}</p>
          <p className="text-xs text-muted">
            Type: <span className="text-white/80">{preset.preset_entity}</span>
            {preset.preset_entity === "relief" && (
              <>
                {" · "}
                <Link to={`/relievers/preset/${preset.preset_id}`} className="text-gold hover:underline">
                  Open runner
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            className="text-xs px-3 py-2 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
            onClick={() => void save()}
          >
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-xs px-3 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1"
            onClick={() => void remove()}
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-muted">Title</span>
        <input
          className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-muted">Category</span>
        <input
          className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-muted">Preset entity</span>
        <select
          className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
          value={entity === "stressor" ? "stressor" : "relief"}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="relief">Relief (Relievers)</option>
          <option value="stressor">Stressor</option>
        </select>
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-muted">Duration (seconds)</span>
        <input
          type="number"
          min={0}
          max={86400}
          className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
          value={durationSeconds}
          onChange={(e) => setDurationSeconds(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-muted">YouTube URL</span>
        <input
          className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2 font-mono text-xs"
          placeholder="watch, youtu.be, or /embed/… URL"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-muted">Description</span>
        <textarea
          className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2 min-h-[72px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-muted">BecomHim stage (optional)</span>
        <input
          className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        />
      </label>
    </div>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<"users" | "referrals" | "presets">("users");
  const [users, setUsers] = useState<U[]>([]);
  const [referrals, setReferrals] = useState<
    { referred_user_id: string; referrer_user_id: string; email: string }[]
  >([]);
  const [globalPresets, setGlobalPresets] = useState<GlobalPreset[]>([]);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyPreset, setBusyPreset] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newEntity, setNewEntity] = useState<"relief" | "stressor">("relief");
  const [newDuration, setNewDuration] = useState("600");
  const [newYoutube, setNewYoutube] = useState("");
  const [newDesc, setNewDesc] = useState("");

  async function load() {
    setErr("");
    try {
      const u = await apiJson<{ users: U[] }>("/v1/admin/users");
      setUsers(u.users);
      const r = await apiJson<{ referrals: typeof referrals }>("/v1/admin/referrals");
      setReferrals(r.referrals);
    } catch {
      setErr("Admin access denied or error");
    }
  }

  async function loadPresets() {
    setErr("");
    try {
      const r = await apiJson<{ presets: GlobalPreset[] }>("/v1/admin/presets/global");
      setGlobalPresets(r.presets);
    } catch {
      setErr("Could not load global presets");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab === "presets") void loadPresets();
  }, [tab]);

  async function patchUser(uid: string, body: { tier?: string; is_active?: boolean }) {
    setBusyId(uid);
    setErr("");
    try {
      const res = await apiFetch(`/v1/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `${res.status} ${res.statusText}`);
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(uid: string, email: string) {
    const pw = window.prompt(`New password for ${email} (min 8 characters):`);
    if (pw === null) return;
    if (pw.length < 8) {
      setErr("Password must be at least 8 characters");
      return;
    }
    setBusyId(uid);
    setErr("");
    try {
      const res = await apiFetch(`/v1/admin/users/${uid}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: pw }),
      });
      if (!res.ok) {
        setErr((await res.text()) || `${res.status}`);
        return;
      }
      setErr("");
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  async function createPreset() {
    const title = newTitle.trim();
    const category = newCategory.trim();
    if (!title || !category) {
      setErr("Title and category are required");
      return;
    }
    setBusyPreset(true);
    setErr("");
    try {
      const dur = Math.max(0, Math.min(86400, parseInt(newDuration, 10) || 0));
      const res = await apiFetch("/v1/admin/presets/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset_entity: newEntity,
          title,
          category,
          duration_seconds: dur,
          youtube_url: newYoutube.trim() || null,
          description: newDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        setErr((await res.text()) || `${res.status}`);
        return;
      }
      setNewTitle("");
      setNewCategory("");
      setNewDuration("600");
      setNewYoutube("");
      setNewDesc("");
      await loadPresets();
    } catch {
      setErr("Network error");
    } finally {
      setBusyPreset(false);
    }
  }

  function tierLabel(t: string) {
    if (t === "admin") return "Admin";
    if (t === "premium") return "Premium";
    return "Free";
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-10">
      <DashboardHeader />
      <div className="flex items-center gap-2">
        <Link to="/" className="text-muted p-1 rounded-lg hover:bg-white/5" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <header className="flex items-center gap-2 text-gold flex-1">
          <Shield className="w-6 h-6" />
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
        </header>
      </div>
      <div className="flex rounded-full bg-surface p-1 border border-white/10 gap-0.5">
        <button
          type="button"
          className={`flex-1 py-2 rounded-full text-xs sm:text-sm flex items-center justify-center gap-1 ${
            tab === "users" ? "bg-night text-gold" : "text-muted"
          }`}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          type="button"
          className={`flex-1 py-2 rounded-full text-xs sm:text-sm flex items-center justify-center gap-1 ${
            tab === "referrals" ? "bg-night text-gold" : "text-muted"
          }`}
          onClick={() => setTab("referrals")}
        >
          <Share2 className="w-4 h-4 shrink-0" /> <span className="truncate">Referrals</span>
        </button>
        <button
          type="button"
          className={`flex-1 py-2 rounded-full text-xs sm:text-sm flex items-center justify-center gap-1 ${
            tab === "presets" ? "bg-night text-gold" : "text-muted"
          }`}
          onClick={() => setTab("presets")}
        >
          <Layers className="w-4 h-4 shrink-0" /> <span className="truncate">Presets</span>
        </button>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {tab === "users" && (
        <>
          <div className="flex justify-between items-center text-sm text-muted">
            <span>{users.length} users</span>
            <button type="button" onClick={() => void load()} aria-label="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {users.map((u) => {
              const active = u.is_active !== false;
              const loading = busyId === u.user_id;
              return (
                <div
                  key={u.user_id}
                  className={`card space-y-3 relative ${!active ? "opacity-75 border-red-500/30" : ""}`}
                >
                  {!active ? (
                    <span className="absolute top-3 right-3 text-[10px] text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full font-medium">
                      Banned
                    </span>
                  ) : u.tier === "admin" ? (
                    <span className="absolute top-3 right-3 text-[10px] text-gold border border-gold/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3" /> admin
                    </span>
                  ) : u.tier === "premium" ? (
                    <span className="absolute top-3 right-3 text-[10px] text-gold border border-gold/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3" /> premium
                    </span>
                  ) : null}
                  <div className={u.tier === "admin" || u.tier === "premium" || !active ? "pr-16" : ""}>
                    <p className="font-semibold text-white">{u.display_name}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                    <p className="text-xs text-muted">Joined {u.created_at?.slice(0, 10)}</p>
                    <p className="text-xs text-muted font-mono">Code: {u.invite_code}</p>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-white/5">
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-muted">Access tier</span>
                      <select
                        className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2 disabled:opacity-50"
                        value={["free", "premium", "admin"].includes(u.tier) ? u.tier : "free"}
                        disabled={loading || !active}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === u.tier) return;
                          void patchUser(u.user_id, { tier: next });
                        }}
                      >
                        <option value="free">Free — no elevated access</option>
                        <option value="premium">Premium</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <p className="text-[11px] text-muted">
                      Current: <span className="text-white/90">{tierLabel(u.tier)}</span> — change above
                      to grant or revoke Premium / Admin.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading || !active}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
                      onClick={() => void resetPassword(u.user_id, u.email)}
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset password
                    </button>
                    {active ? (
                      <button
                        type="button"
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        onClick={() => {
                          if (confirm(`Deactivate account for ${u.email}? They cannot log in until reactivated.`)) {
                            void patchUser(u.user_id, { is_active: false });
                          }
                        }}
                      >
                        <UserX className="w-3.5 h-3.5" /> Ban / deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                        onClick={() => void patchUser(u.user_id, { is_active: true })}
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Reactivate account
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === "referrals" && (
        <ul className="space-y-2 text-sm">
          {referrals.map((r) => (
            <li key={r.referred_user_id} className="card">
              {r.email} ← {r.referrer_user_id.slice(0, 8)}…
            </li>
          ))}
        </ul>
      )}
      {tab === "presets" && (
        <>
          <div className="flex justify-between items-center text-sm text-muted">
            <span>{globalPresets.length} global presets</span>
            <button type="button" onClick={() => void loadPresets()} aria-label="Refresh presets">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted">
            These appear for all users in your tenant. Relief presets with a YouTube URL show the embed on the timer
            page.
          </p>
          <div className="space-y-4">
            {globalPresets.map((p) => (
              <GlobalPresetRow
                key={p.preset_id}
                preset={p}
                onReload={loadPresets}
                onError={setErr}
                busy={busyPreset}
                setBusy={setBusyPreset}
              />
            ))}
          </div>
          <div className="card space-y-3 border border-gold/20">
            <div className="flex items-center gap-2 text-gold text-sm font-medium">
              <Plus className="w-4 h-4" /> Add global preset
            </div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted">Title</span>
              <input
                className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Box breathing"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted">Category</span>
              <input
                className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. breathwork"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted">Entity</span>
              <select
                className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
                value={newEntity}
                onChange={(e) => setNewEntity(e.target.value as "relief" | "stressor")}
              >
                <option value="relief">Relief</option>
                <option value="stressor">Stressor</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted">Duration (seconds)</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted">YouTube URL (optional)</span>
              <input
                className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2 font-mono text-xs"
                value={newYoutube}
                onChange={(e) => setNewYoutube(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted">Description (optional)</span>
              <textarea
                className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2 min-h-[64px]"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busyPreset}
              className="w-full py-2.5 rounded-xl bg-gold/20 border border-gold/50 text-gold text-sm font-medium hover:bg-gold/30 disabled:opacity-50"
              onClick={() => void createPreset()}
            >
              Create preset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
