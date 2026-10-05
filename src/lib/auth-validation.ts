import { z } from "zod";
export const passwordRequirements = [
  { label: "10 characters", test: (s: string) => s.length >= 10 },
  { label: "one uppercase letter", test: (s: string) => /[A-Z]/.test(s) },
  { label: "one lowercase letter", test: (s: string) => /[a-z]/.test(s) },
  { label: "one number", test: (s: string) => /[0-9]/.test(s) },
  {
    label: "one symbol",
    test: (s: string) => /[!@#$%^&*()_+\-=\[\]{};'":|<>?,./`~\\]/.test(s),
  },
];
export const strongPassword = z
  .string()
  .max(200)
  .superRefine((value, ctx) => {
    for (const rule of passwordRequirements)
      if (!rule.test(value))
        ctx.addIssue({
          code: "custom",
          message: `Password must contain ${rule.label}.`,
        });
  });
const email = z
  .email()
  .max(254)
  .transform((s) => s.trim().toLowerCase());
const password = z.string().min(1).max(200);
const tokenHash = z
  .string()
  .regex(
    /^(?:pkce_)?[a-f0-9]{32,128}$/i,
    "This link is incomplete or malformed. Open the full link from your latest email.",
  );
const captchaToken = z.string().max(4096).optional();
export const authSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("login"), email, password, captchaToken }),
    z.object({
      action: z.literal("signup"),
      name: z.string().trim().min(1).max(100),
      email,
      password: strongPassword,
      confirmPassword: password,
      captchaToken,
    }),
    z.object({ action: z.literal("forgot"), email, captchaToken }),
    z.object({ action: z.literal("resend"), email, captchaToken }),
    z.object({ action: z.literal("verify"), tokenHash }),
    z.object({
      action: z.literal("reset"),
      tokenHash: tokenHash.optional(),
      password: strongPassword,
      confirmPassword: password,
    }),
    z.object({
      action: z.literal("change"),
      currentPassword: password,
      captchaToken,
      password: strongPassword,
      confirmPassword: password,
    }),
    z.object({ action: z.literal("google") }),
    z.object({ action: z.literal("logout") }),
  ])
  .superRefine((v, ctx) => {
    if ("confirmPassword" in v && v.password !== v.confirmPassword)
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
  });
