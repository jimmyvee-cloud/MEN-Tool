import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gift, LogOut, Search, Settings, Shield, User } from "lucide-react";
import { logout } from "@/lib/session";
import type { MeHeader } from "@/context/UserHeaderContext";
import { avatarSrc } from "@/lib/branding";

const itemClass =
  "flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 rounded-lg mx-1";

type Props = {
  me: MeHeader | null;
};

export function ProfileMenuDropdown({ me }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const isAdmin = me?.tier === "admin";

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function onLogout() {
    setOpen(false);
    await logout();
    nav("/login", { replace: true });
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full bg-surface border border-white/10 overflow-hidden flex items-center justify-center text-xl focus:outline-none focus:ring-2 focus:ring-gold/50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <img src={avatarSrc(me?.avatar_url)} alt="" className="w-full h-full object-cover" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-xl bg-[#252830] border border-white/10 shadow-2xl z-[100] py-1"
          role="menu"
        >
          <Link to="/profile" className={itemClass} role="menuitem" onClick={() => setOpen(false)}>
            <User className="w-4 h-4 text-muted" /> Profile
          </Link>
          <Link
            to="/refer"
            className={itemClass}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Gift className="w-4 h-4 text-muted" /> Refer a Friend
          </Link>
          <Link
            to="/find-friend"
            className={itemClass}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Search className="w-4 h-4 text-muted" /> Find a Friend
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className={itemClass}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Shield className="w-4 h-4 text-gold" /> Admin Dashboard
            </Link>
          )}
          <Link
            to="/settings"
            className={itemClass}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Settings className="w-4 h-4 text-muted" /> Settings
          </Link>
          <button type="button" className={`${itemClass} w-[calc(100%-8px)] text-red-400`} onClick={() => void onLogout()}>
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
