/**
 * Single-theme app — the colors live in src/styles/tokens.css and never change
 * at runtime. This hook is intentionally a no-op so all existing callers can
 * keep importing it without a refactor.
 */
export function useTheme() {
  return 'intake' as const;
}
