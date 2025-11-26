"use client";

import { useAccount, useReadContract, useWalletClient } from "wagmi";
import { HONEST_CARD_ADDRESS, HONEST_CARD_ABI } from "@/lib/contract";
import { CardIcon } from "@/components/icons";
import { useState } from "react";
import { useRelayerSdk } from "@/components/providers/relayer-provider";
import { useNotification } from "@/components/providers/notification-provider";

const GENDER_LABELS = ["Not Disclosed", "Male", "Female", "Other"];

interface DecryptedData {
  gender: string;
  phone: string;
  fullName: string;
  social: string;
  location: string;
}

export function MyCardDisplay() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { instance } = useRelayerSdk();
  const { error: showError, success: showSuccess } = useNotification();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<DecryptedData | null>(null);

  // All hooks must be called unconditionally at the top
  const { data: hasCard, isLoading: checkingCard } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "hasCard",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: publicInfo, isLoading: loadingPublic } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "getPublicInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!hasCard },
  });

  const { data: encryptedHandles, error: handlesError } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "getEncryptedHandles",
    args: address ? [address] : undefined,
    account: address,
    query: { enabled: !!address && !!hasCard },
  });

  // Debug: Log handles error
  if (handlesError) {
    console.error("[MyCard] getEncryptedHandles error:", handlesError);
  }

  const isLoading = checkingCard || loadingPublic;
  const [surname] = (publicInfo as [string, boolean]) || [""];

  // Helper: decrypt multiple handles with one signature
  const decryptHandles = async (handles: string[]): Promise<Record<string, bigint>> => {
    if (!instance || !walletClient || !address) throw new Error("Not ready");
    
    // Generate keypair
    const keypair = instance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "1";

    // Create EIP712 typed data
    const eip712 = instance.createEIP712(
      keypair.publicKey,
      [HONEST_CARD_ADDRESS],
      startTimeStamp,
      durationDays
    );

    // Sign with wallet (only one signature needed!)
    const signature = await walletClient.signTypedData({
      account: walletClient.account!,
      domain: eip712.domain as Record<string, unknown>,
      types: eip712.types as Record<string, unknown>,
      primaryType: "UserDecryptRequestVerification",
      message: eip712.message as Record<string, unknown>,
    });

    // Call userDecrypt with all handles at once
    const handleContractPairs = handles.map(h => ({ handle: h, contractAddress: HONEST_CARD_ADDRESS }));
    const userDecryptFn = instance.userDecrypt as unknown as (
      handleContractPairs: Array<{ handle: string; contractAddress: string }>,
      privateKey: string,
      publicKey: string,
      signature: string,
      contractAddresses: string[],
      userAddress: string,
      startTimeStamp: string,
      durationDays: string
    ) => Promise<Record<string, bigint | string>>;

    const result = await userDecryptFn(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      [HONEST_CARD_ADDRESS],
      address,
      startTimeStamp,
      durationDays
    );

    // Convert all results to bigint
    const output: Record<string, bigint> = {};
    for (const h of handles) {
      const v = result[h];
      output[h] = v !== null && v !== undefined 
        ? (typeof v === "bigint" ? v : BigInt(v))
        : BigInt(0);
    }
    return output;
  };

  const handleDecrypt = async () => {
    console.log("[Decrypt] Check:", { instance: !!instance, walletClient: !!walletClient, address, encryptedHandles });
    if (!instance) {
      showError("FHE instance not ready");
      return;
    }
    if (!walletClient) {
      showError("Wallet not connected");
      return;
    }
    if (!address) {
      showError("Address not found");
      return;
    }
    if (!encryptedHandles) {
      showError("Encrypted handles not loaded");
      return;
    }

    setIsDecrypting(true);
    try {
      const [genderHandle, phoneHandle, fullNameHandle, socialIdHandle, locationHandle] = encryptedHandles as [string, string, string, string, string];
      
      console.log("[Decrypt] Starting decryption...");
      console.log("[Decrypt] Handles:", { genderHandle, phoneHandle, fullNameHandle, socialIdHandle, locationHandle });

      // Decrypt all fields with one signature
      const decrypted = await decryptHandles([genderHandle, phoneHandle, fullNameHandle, socialIdHandle, locationHandle]);
      
      const genderValue = decrypted[genderHandle];
      const phoneValue = decrypted[phoneHandle];
      const fullNameValue = decrypted[fullNameHandle];
      const socialValue = decrypted[socialIdHandle];
      const locationValue = decrypted[locationHandle];

      console.log("[Decrypt] Decrypted values:", { genderValue, phoneValue, fullNameValue, socialValue, locationValue });

      // Convert bigint to readable format
      const bigintToString = (val: bigint | number): string => {
        const n = BigInt(val);
        if (n === BigInt(0)) return "-";
        // Try to decode as UTF-8 bytes
        try {
          const hex = n.toString(16);
          const bytes = hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)).filter(b => b > 0) || [];
          if (bytes.length > 0 && bytes.every(b => b >= 32 && b <= 126)) {
            return String.fromCharCode(...bytes);
          }
        } catch {}
        return n.toString();
      };

      // Format phone: +XX XXXXXXXX
      const formatPhone = (val: bigint | number): string => {
        const n = BigInt(val);
        if (n === BigInt(0)) return "-";
        const str = n.toString();
        // Common country codes: 1 (US), 7 (RU), 86 (CN), 852 (HK), etc.
        if (str.startsWith("86") && str.length > 2) return `+86 ${str.slice(2)}`;
        if (str.startsWith("852") && str.length > 3) return `+852 ${str.slice(3)}`;
        if (str.startsWith("886") && str.length > 3) return `+886 ${str.slice(3)}`;
        if (str.startsWith("44") && str.length > 2) return `+44 ${str.slice(2)}`;
        if (str.startsWith("81") && str.length > 2) return `+81 ${str.slice(2)}`;
        if (str.startsWith("82") && str.length > 2) return `+82 ${str.slice(2)}`;
        if (str.startsWith("91") && str.length > 2) return `+91 ${str.slice(2)}`;
        if (str.startsWith("1") && str.length > 1) return `+1 ${str.slice(1)}`;
        if (str.startsWith("7") && str.length > 1) return `+7 ${str.slice(1)}`;
        return `+${str}`;
      };

      setDecryptedData({
        gender: GENDER_LABELS[Number(genderValue)] || "-",
        phone: formatPhone(phoneValue),
        fullName: bigintToString(fullNameValue),
        social: bigintToString(socialValue),
        location: bigintToString(locationValue),
      });

      showSuccess("Data decrypted successfully!");
    } catch (err) {
      console.error("[Decrypt] Error:", err);
      showError(err instanceof Error ? err.message : "Failed to decrypt");
    } finally {
      setIsDecrypting(false);
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/60 stagger-item">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <CardIcon className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">My Card</h2>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-1/3"></div>
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-1/2"></div>
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-2/3"></div>
        </div>
      </div>
    );
  }


  return (
    <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/60 card-hover stagger-item">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200/50 group-hover:shadow-indigo-300/50 transition-shadow duration-300">
            <CardIcon className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">My Card</h2>
        </div>
        {hasCard && (
          <span className="px-2.5 py-1 bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 text-xs rounded-full font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full status-glow" />
            Active
          </span>
        )}
      </div>

      {/* Card Content */}
      <div className="space-y-4">
        {/* Section: Public Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Public</h3>
          </div>
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl px-4 py-3 border border-gray-100/50">
            <div className="text-xs text-gray-400 mb-0.5">Surname</div>
            <div className="text-sm font-medium text-gray-900">{surname || "-"}</div>
          </div>
        </div>

        {/* Section: Encrypted Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Encrypted</h3>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] rounded-full font-medium">FHE</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
              <div className="text-xs text-gray-400 mb-0.5">Gender</div>
              <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                {hasCard ? (decryptedData?.gender || "***") : "-"}
              </div>
            </div>
            <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
              <div className="text-xs text-gray-400 mb-0.5">Full Name</div>
              <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                {hasCard ? (decryptedData?.fullName || "***") : "-"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
              <div className="text-xs text-gray-400 mb-0.5">Phone</div>
              <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                {hasCard ? (decryptedData?.phone || "***") : "-"}
              </div>
            </div>
            <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
              <div className="text-xs text-gray-400 mb-0.5">Social</div>
              <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                {hasCard ? (decryptedData?.social || "***") : "-"}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
            <div className="text-xs text-gray-400 mb-0.5">Location</div>
            <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
              {hasCard ? (decryptedData?.location || "***") : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Decrypt Button */}
      <button
        onClick={handleDecrypt}
        disabled={isDecrypting || !hasCard}
        className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 rounded-xl font-medium hover:from-gray-200 hover:to-slate-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-press border border-gray-200/50"
      >
        {isDecrypting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Decrypting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Decrypt My Data
          </>
        )}
      </button>
    </div>
  );
}
