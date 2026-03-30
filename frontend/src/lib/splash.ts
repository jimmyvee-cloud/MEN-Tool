/** Remove the static HTML splash shown before React mounts */
export function hideSplash(): void {
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("splash--hidden");
  const remove = () => el.remove();
  el.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 400);
}
