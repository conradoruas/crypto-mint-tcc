import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Space_Grotesk, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";

import { Web3Provider } from "@/components/Web3Provider";
import { ApolloProvider } from "@/components/ApolloProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClientToaster } from "@/components/ClientToaster";
import { isThemeMode, THEME_COOKIE_NAME } from "@/lib/theme";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme = isThemeMode(cookieTheme) ? cookieTheme : "dark";

  return (
    <html
      lang="pt-br"
      className={`${spaceGrotesk.variable} ${manrope.variable}${initialTheme === "dark" ? " dark" : ""}`}
      data-theme={initialTheme}
      suppressHydrationWarning
    >
      <body
        className="antialiased min-h-screen bg-background text-on-surface"
        suppressHydrationWarning
      >
        <ThemeProvider defaultTheme="dark" initialTheme={initialTheme}>
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
