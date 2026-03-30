/** Spartan shield logo — served from `public/mentool-logo.png` */
export const LOGO_SRC = "/mentool-logo.png";

/** Use stored avatar URL or the default MEN-Tool logo. */
export function avatarSrc(url?: string | null): string {
  const u = url?.trim();
  return u ? u : LOGO_SRC;
}
