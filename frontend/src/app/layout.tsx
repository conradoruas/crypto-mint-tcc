import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";

import { Web3Provider } from "@/components/Web3Provider";
import { ApolloProvider } from "@/components/ApolloProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClientToaster } from "@/components/ClientToaster";
// Validate required env vars at server startup — throws with a clear message
// if any are missing rather than failing silently later.
import "@/lib/env";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-headline",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CryptoMint | NFT Marketplace",
  description:
    "Marketplace descentralizado para criação e negociação de NFTs — TCC 2026",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-br"
      className={`dark ${spaceGrotesk.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased min-h-screen bg-background text-on-surface">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <ApolloProvider>
            <Web3Provider>
              <ErrorBoundary>
                <div className="min-h-full flex flex-col">{children}</div>
                <ClientToaster />
              </ErrorBoundary>
            </Web3Provider>
          </ApolloProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
