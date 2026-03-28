import type { Metadata } from "next";
import "./globals.css";
import { MusicProvider } from "@/lib/MusicContext";
import { ThemeProvider } from "@/lib/ThemeContext";

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
        <ThemeProvider>
          <MusicProvider>{children}</MusicProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
