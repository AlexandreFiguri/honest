"use client";

import { useState } from "react";
import { WalletConnectButton } from "@/components/wallet/connect-button";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi";
import { useRelayerSdk } from "@/components/providers/relayer-provider";
import { useNotification } from "@/components/providers/notification-provider";
import { CardIcon, ExchangeIcon } from "@/components/icons";
import { CreateCardModal } from "@/components/card/create-card-modal";
import { MyCardDisplay } from "@/components/card/my-card-display";
import { ViewCardModal } from "@/components/card/view-card-modal";
import { HONEST_CARD_ADDRESS, HONEST_CARD_ABI } from "@/lib/contract";

export default function Home() {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const isLoading = isConnecting || isReconnecting;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/60 border-b border-white/30 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="gradient-text">Honest</span><span className="text-indigo-600">.</span>
          </h1>
          <WalletConnectButton />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-20 animate-fade-up">
            <div className="inline-block w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Loading...</p>
          </div>
        ) : !isConnected ? (
          <div className="text-center py-20 animate-fade-up">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center float-animation">
              <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Welcome to Honest</h2>
            <p className="text-gray-500 mb-6">Connect your wallet to get started</p>
            <WalletConnectButton />
          </div>
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
}

function Dashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { sdk, loading: sdkLoading, instance, instanceLoading } = useRelayerSdk();
  const { success, error: showError } = useNotification();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetAddress, setTargetAddress] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [viewCardAddress, setViewCardAddress] = useState<string | null>(null);

  // Check if user has card
  const { data: hasCard, refetch: refetchHasCard } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "hasCard",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Get pending requests
  const { data: pendingRequests, refetch: refetchRequests } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "getAllPendingForUser",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  }) as { data: [readonly `0x${string}`[], readonly `0x${string}`[]] | undefined; refetch: () => void };

  const outgoingRequests = pendingRequests?.[0] || [];
  const incomingRequests = pendingRequests?.[1] || [];

  // Get completed connections
  const { data: connections } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "getConnections",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  }) as { data: readonly `0x${string}`[] | undefined };

  const { writeContract, data: exchangeHash, isPending: exchangePending } = useWriteContract();
  const { isLoading: exchangeConfirming, isSuccess: exchangeSuccess } = useWaitForTransactionReceipt({ hash: exchangeHash });

  // Handle exchange request
  const handleRequestExchange = async () => {
    if (!targetAddress.trim()) {
      showError("Please enter an address");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
      showError("Invalid address format");
      return;
    }
    if (!publicClient) {
      showError("Client not ready");
      return;
    }
    setIsRequesting(true);
    try {
      // Check if target has card
      const targetHasCard = await publicClient.readContract({
        address: HONEST_CARD_ADDRESS as `0x${string}`,
        abi: HONEST_CARD_ABI,
        functionName: "hasCard",
        args: [targetAddress as `0x${string}`],
      });
      if (!targetHasCard) {
        showError("Target address has not created a card");
        setIsRequesting(false);
        return;
      }
      writeContract({
        address: HONEST_CARD_ADDRESS as `0x${string}`,
        abi: HONEST_CARD_ABI,
        functionName: "requestExchange",
        args: [targetAddress as `0x${string}`],
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to request exchange");
      setIsRequesting(false);
    }
  };

  // Reset on success
  if (exchangeSuccess && isRequesting) {
    success("Exchange request sent!");
    setTargetAddress("");
    setIsRequesting(false);
    refetchRequests();
  }

  // Reset on cancel/fail (pending ended without success)
  if (isRequesting && !exchangePending && !exchangeConfirming && !exchangeSuccess && !exchangeHash) {
    setIsRequesting(false);
  }

  // Accept incoming request
  const handleAcceptRequest = async (from: string) => {
    try {
      writeContract({
        address: HONEST_CARD_ADDRESS as `0x${string}`,
        abi: HONEST_CARD_ABI,
        functionName: "requestExchange",
        args: [from as `0x${string}`],
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to accept request");
    }
  };

  // Format address for display
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="space-y-6">
      {/* Init Status - compact */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl px-5 py-3.5 border border-white/60 shadow-sm flex items-center gap-5 text-sm animate-fade-up">
        <span className="text-gray-600 font-semibold uppercase text-xs tracking-wider">Status</span>
        <div className="h-4 w-px bg-gray-200" />
        <StatusDot label="Wallet" ok={isConnected} />
        <StatusDot label="SDK" ok={!sdkLoading && !!sdk} loading={sdkLoading} />
        <StatusDot label="FHE" ok={!instanceLoading && !!instance} loading={instanceLoading} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {/* Create Card */}
          <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/60 card-hover stagger-item">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200/50 group-hover:shadow-indigo-300/50 transition-shadow duration-300">
                <CardIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Create Card</h2>
            </div>
            <p className="text-gray-500 mb-4">Create your business card to start exchanging.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-200/50 btn-press"
            >
              Create Card
            </button>
          </div>

          {/* Request Exchange */}
          <div className="flex-1 group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/60 card-hover stagger-item">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200/50 group-hover:shadow-emerald-300/50 transition-shadow duration-300">
                <ExchangeIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Request Exchange</h2>
            </div>
            <p className="text-gray-500 mb-4">Enter an address to request card exchange.</p>
            <div className="space-y-3">
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all bg-white/80 text-gray-900 disabled:bg-gray-100/50 input-glow placeholder:text-gray-400"
                disabled={!hasCard || isRequesting || exchangePending || exchangeConfirming}
              />
              <button
                onClick={handleRequestExchange}
                disabled={!hasCard || isRequesting || exchangePending || exchangeConfirming || !targetAddress.trim()}
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all duration-300 shadow-lg shadow-emerald-200/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 btn-press"
              >
                {(isRequesting || exchangePending || exchangeConfirming) && (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {exchangeConfirming ? "Confirming..." : exchangePending ? "Confirm in wallet..." : "Request Exchange"}
              </button>
            </div>
          </div>
        </div>

        {/* My Card Display */}
        <MyCardDisplay />
      </div>

      {/* Exchange Requests - Two Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Outgoing Requests */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/60 card-hover stagger-item">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
              <ExchangeIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Sent Requests</h2>
            {outgoingRequests.length > 0 && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">{outgoingRequests.length}</span>
            )}
          </div>
          {outgoingRequests.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">No outgoing requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {outgoingRequests.map((addr) => (
                <div key={addr} className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl px-4 py-3 border border-amber-100/50">
                  <span className="text-sm font-mono text-gray-700">{formatAddress(addr)}</span>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-600 text-xs rounded-lg font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Requests */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/60 card-hover stagger-item">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-200/50">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Received Requests</h2>
            {incomingRequests.length > 0 && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold animate-pulse">{incomingRequests.length}</span>
            )}
          </div>
          {incomingRequests.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">No incoming requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incomingRequests.map((addr) => (
                <div key={addr} className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl px-4 py-3 border border-emerald-100/50">
                  <span className="text-sm font-mono text-gray-700">{formatAddress(addr)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewCardAddress(addr)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-200 transition-all btn-press"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleAcceptRequest(addr)}
                      disabled={exchangePending || exchangeConfirming}
                      className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm rounded-lg font-medium hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-50 btn-press"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My Connections */}
      <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/60 card-hover stagger-item">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Completed Exchanges</h2>
          {connections && connections.length > 0 && (
            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-semibold">{connections.length}</span>
          )}
        </div>
        {!connections || connections.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No connections yet</p>
            <p className="text-gray-400 text-xs mt-1">Complete an exchange to add contacts</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {connections.map((addr) => (
              <div key={addr} className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl px-4 py-3 border border-indigo-100/50 hover:shadow-md transition-all duration-200">
                <span className="text-sm font-mono text-gray-700">{formatAddress(addr)}</span>
                <button
                  onClick={() => setViewCardAddress(addr)}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm rounded-lg font-medium hover:from-indigo-700 hover:to-blue-700 transition-all btn-press"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Card Modal */}
      <CreateCardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => refetchHasCard()}
      />

      {/* View Card Modal */}
      {viewCardAddress && (
        <ViewCardModal
          address={viewCardAddress}
          isOpen={!!viewCardAddress}
          onClose={() => setViewCardAddress(null)}
        />
      )}
    </div>
  );
}

function StatusDot({ label, ok, loading }: { label: string; ok: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${loading ? "bg-amber-400 animate-pulse" : ok ? "bg-emerald-500 status-glow" : "bg-gray-300"}`} />
      <span className={`font-medium transition-colors duration-300 ${ok ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
    </div>
  );
}
