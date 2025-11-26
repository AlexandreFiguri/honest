import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/providers/wallet-provider";
import { RelayerProvider } from "@/components/providers/relayer-provider";
import { RelayerScriptLoader } from "@/components/providers/relayer-script-loader";
import { NotificationProvider } from "@/components/providers/notification-provider";

export const metadata: Metadata = {
  title: "Honest",
  description: "Privacy-first business card exchange",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <RelayerScriptLoader />
        <WalletProvider>
          <RelayerProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </RelayerProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
