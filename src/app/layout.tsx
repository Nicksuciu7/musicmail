import { connection } from "next/server";
import type { Metadata } from "next";
import "./globals.css";
import { initialTheme } from "@/lib/server/theme";
import { ThemeProvider } from "@/components/theme-provider";
export const metadata: Metadata = {
  title: "MusicMail — Your next connection",
  description:
    "Discover the music industry. Build meaningful relationships. Make your next move.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const theme = await initialTheme();
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
