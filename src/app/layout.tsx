import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MusicMail — Your next connection",
  description:
    "Discover the music industry. Build meaningful relationships. Make your next move.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
