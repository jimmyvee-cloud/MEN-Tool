import { NavLink } from "react-router-dom";
import { Home, MessageCircle, Zap, Leaf } from "lucide-react";

const links = [
  { to: "/", label: "Today", icon: Home },
  { to: "/checkin", label: "Check-in", icon: MessageCircle },
  { to: "/stressors", label: "Stressors", icon: Zap },
  { to: "/relievers", label: "Relievers", icon: Leaf },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-night/95 backdrop-blur px-2 pb-4">
      <div className="flex max-w-lg mx-auto justify-around py-2">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-xs min-w-[72px] relative ${
                isActive ? "text-gold" : "text-muted"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-6 h-6" strokeWidth={1.75} />
                <span>{label}</span>
                {isActive ? (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
