import type { Metadata } from "next";
import "./globals.css";
import { MusicProvider } from "@/lib/MusicContext";

export const metadata: Metadata = {
  title: "RapFlow",
  description: "AI-powered rap flow trainer with metronome, lyrics, and breath coaching",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MusicProvider>{children}</MusicProvider>
      </body>
    </html>
  );
}
