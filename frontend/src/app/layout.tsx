import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { Web3Provider } from "@/components/Web3Provider";

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
    >
      <body suppressHydrationWarning>
        <Web3Provider>
          <div className="min-h-full flex flex-col">{children}</div>
        </Web3Provider>
      </body>
    </html>
  );
}
