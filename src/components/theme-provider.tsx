"use client";
import { createContext, useContext, useState } from "react";
import { request } from "@/lib/client";
import type { Theme } from "@/lib/theme";
const ThemeContext = createContext<{
  theme: Theme;
  change: (theme: Theme) => Promise<void>;
}>({ theme: "system", change: async () => {} });
export function ThemeProvider({
  initial,
  children,
}: {
  initial: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initial);
  async function change(next: Theme) {
    const previous = theme;
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      await request("/api/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch (error) {
      document.documentElement.dataset.theme = previous;
      setTheme(previous);
      throw error;
    }
  }
  return (
    <ThemeContext.Provider value={{ theme, change }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function Appearance() {
  const { theme, change } = useContext(ThemeContext);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <h3>Appearance</h3>
      <p>Choose what’s comfortable. System follows your device.</p>
      <fieldset className="appearance-options">
        <legend className="sr-only">Appearance</legend>
        {(["system", "light", "dark"] as const).map((value) => (
          <label
            key={value}
            className={`appearance-option ${theme === value ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="appearance"
              value={value}
              checked={theme === value}
              disabled={busy}
              onChange={async () => {
                setBusy(true);
                setError("");
                try {
                  await change(value);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <span>{value[0].toUpperCase() + value.slice(1)}</span>
          </label>
        ))}
      </fieldset>
      {busy && <p role="status">Saving appearance…</p>}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </section>
  );
}
