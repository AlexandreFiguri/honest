"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBalance, useAccount } from "wagmi";

export function WalletConnectButton() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });

  const formatBalance = (bal: typeof balance) => {
    if (!bal) return "";
    const value = parseFloat(bal.formatted);
    return value.toFixed(4) + " " + bal.symbol;
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-200"
            >
              Connect Wallet
            </button>
          );
        }

        if (chain?.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2.5 text-sm font-medium text-white hover:from-red-600 hover:to-rose-600 transition-all duration-300 shadow-lg shadow-red-200"
            >
              Wrong Network
            </button>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              onClick={openChainModal}
              className="inline-flex items-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white transition-all duration-300 border border-white/50 shadow-sm"
            >
              {chain?.hasIcon && chain.iconUrl && (
                <img src={chain.iconUrl} alt={chain.name ?? ""} className="h-5 w-5 rounded-full" />
              )}
              {chain?.name ?? "Unknown"}
            </button>
            <button
              onClick={openAccountModal}
              className="inline-flex items-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white transition-all duration-300 border border-white/50 shadow-sm"
            >
              <span className="text-emerald-600 font-semibold">{formatBalance(balance)}</span>
              <span className="border-l border-gray-200 pl-2">{account?.displayName}</span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
