import { z } from "zod";
export const themeSchema = z.enum(["system", "light", "dark"]);
export type Theme = z.infer<typeof themeSchema>;
export function parseTheme(v: unknown): Theme {
  const r = themeSchema.safeParse(v);
  return r.success ? r.data : "system";
}
