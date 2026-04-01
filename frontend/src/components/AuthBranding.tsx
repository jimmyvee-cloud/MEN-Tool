import type { ReactNode } from "react";
import { LOGO_SRC } from "@/lib/branding";

/** Logo + wordmark above login/register — same type scale as splash title (splash uses white bg) */
export function AuthBranding({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle: string;
}) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-night py-10">
      <div className="flex flex-col items-center w-full max-w-sm">
        <img
          src={LOGO_SRC}
          alt="MEN-Tool"
          width={200}
          height={200}
          className="w-[min(200px,52vw)] h-auto rounded-2xl object-cover border border-gold/30 shadow-[0_16px_48px_rgba(212,166,75,0.12)]"
        />
        <h1 className="text-2xl sm:text-3xl font-bold text-gold mt-5 mb-1 tracking-tight">
          Men-TOOL
        </h1>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-8">
          Mental health app
        </p>
        <p className="text-muted text-sm mb-5 w-full text-center">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
