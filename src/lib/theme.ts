export type ThemePref = "dark" | "light" | "system";

export function applyTheme(pref: ThemePref) {
  if (typeof document === "undefined") return;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = pref === "system" ? systemDark : pref === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

export function readStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem("myai-theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function storeTheme(pref: ThemePref) {
  try {
    localStorage.setItem("myai-theme", pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
}
