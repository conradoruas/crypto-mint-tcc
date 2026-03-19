import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Web3Provider } from "@/components/Web3Provider";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NFT Marketplace | TCC",
  description: "Marketplace profissional de NFTs desenvolvido para o TCC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        <Web3Provider>
          <div className="min-h-full flex flex-col">{children}</div>
        </Web3Provider>
      </body>
    </html>
  );
}
