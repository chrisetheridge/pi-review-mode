export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "pi-review-mode-theme";

export function readInitialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Ignore storage access failures and keep the production light default.
  }
  return "light";
}

export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage access failures. The in-memory toggle still works.
  }
}
