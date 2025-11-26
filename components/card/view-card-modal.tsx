"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWalletClient } from "wagmi";
import { useRelayerSdk } from "@/components/providers/relayer-provider";
import { useNotification } from "@/components/providers/notification-provider";
import { HONEST_CARD_ADDRESS, HONEST_CARD_ABI } from "@/lib/contract";

const GENDER_LABELS = ["Not Disclosed", "Male", "Female", "Other"];

interface DecryptedData {
  gender: string;
  phone: string;
  fullName: string;
  social: string;
  location: string;
}

interface ViewCardModalProps {
  address: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ViewCardModal({ address: targetAddress, isOpen, onClose }: ViewCardModalProps) {
  const { address: myAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { instance } = useRelayerSdk();
  const { error: showError, success: showSuccess } = useNotification();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<DecryptedData | null>(null);

  // Get public info
  const { data: publicInfo } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "getPublicInfo",
    args: [targetAddress as `0x${string}`],
    query: { enabled: isOpen && !!targetAddress },
  });

  // Check if exchange is completed
  const { data: exchangeCompleted } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "hasCompletedExchange",
    args: myAddress && targetAddress ? [myAddress, targetAddress as `0x${string}`] : undefined,
    query: { enabled: isOpen && !!myAddress && !!targetAddress },
  });

  // Get encrypted handles (only works after exchange)
  const { data: encryptedHandles } = useReadContract({
    address: HONEST_CARD_ADDRESS as `0x${string}`,
    abi: HONEST_CARD_ABI,
    functionName: "getEncryptedHandles",
    args: [targetAddress as `0x${string}`],
    account: myAddress,
    query: { enabled: isOpen && !!myAddress && !!targetAddress && !!exchangeCompleted },
  });

  const surname = (publicInfo as [string, boolean] | undefined)?.[0] || "-";

  // Decrypt helper
  const decryptHandles = async (handles: string[]): Promise<Record<string, bigint>> => {
    if (!instance || !walletClient || !myAddress) throw new Error("Not ready");
    
    const keypair = instance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "1";

    const eip712 = instance.createEIP712(
      keypair.publicKey,
      [HONEST_CARD_ADDRESS],
      startTimeStamp,
      durationDays
    );

    const signature = await walletClient.signTypedData({
      account: walletClient.account!,
      domain: eip712.domain as Record<string, unknown>,
      types: eip712.types as Record<string, unknown>,
      primaryType: "UserDecryptRequestVerification",
      message: eip712.message as Record<string, unknown>,
    });

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
      myAddress,
      startTimeStamp,
      durationDays
    );

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
    if (!instance || !walletClient) {
      showError("Wallet or FHE not ready");
      return;
    }
    if (!exchangeCompleted) {
      showError("Exchange not completed yet");
      return;
    }
    if (!encryptedHandles) {
      showError("Cannot access encrypted data");
      return;
    }

    setIsDecrypting(true);
    try {
      const [genderHandle, phoneHandle, fullNameHandle, socialIdHandle, locationHandle] = encryptedHandles as [string, string, string, string, string];
      
      const decrypted = await decryptHandles([genderHandle, phoneHandle, fullNameHandle, socialIdHandle, locationHandle]);
      
      const genderValue = decrypted[genderHandle];
      const phoneValue = decrypted[phoneHandle];
      const fullNameValue = decrypted[fullNameHandle];
      const socialValue = decrypted[socialIdHandle];
      const locationValue = decrypted[locationHandle];

      const bigintToString = (val: bigint | number): string => {
        const n = BigInt(val);
        if (n === BigInt(0)) return "-";
        try {
          const hex = n.toString(16);
          const bytes = hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)).filter(b => b > 0) || [];
          if (bytes.length > 0 && bytes.every(b => b >= 32 && b <= 126)) {
            return String.fromCharCode(...bytes);
          }
        } catch {}
        return n.toString();
      };

      const formatPhone = (val: bigint | number): string => {
        const n = BigInt(val);
        if (n === BigInt(0)) return "-";
        const str = n.toString();
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

      showSuccess("Card decrypted!");
    } catch (err) {
      console.error("[Decrypt] Error:", err);
      showError(err instanceof Error ? err.message : "Failed to decrypt");
    } finally {
      setIsDecrypting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md modal-backdrop" onClick={onClose} />
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto border border-white/50 modal-content">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-200/50">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">View Card</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Address */}
        <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-100/50">
          <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">Wallet Address</div>
          <div className="text-sm font-mono text-gray-700 break-all">{targetAddress}</div>
        </div>

        {/* Card Content */}
        <div className="space-y-4">
          {/* Public Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Public</h3>
            </div>
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl px-4 py-3 border border-gray-100/50">
              <div className="text-xs text-gray-400 mb-0.5">Surname</div>
              <div className="text-sm font-medium text-gray-900">{surname}</div>
            </div>
          </div>

          {/* Encrypted Info */}
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
                  {decryptedData?.gender || "***"}
                </div>
              </div>
              <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
                <div className="text-xs text-gray-400 mb-0.5">Full Name</div>
                <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                  {decryptedData?.fullName || "***"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
                <div className="text-xs text-gray-400 mb-0.5">Phone</div>
                <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                  {decryptedData?.phone || "***"}
                </div>
              </div>
              <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
                <div className="text-xs text-gray-400 mb-0.5">Social</div>
                <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                  {decryptedData?.social || "***"}
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 rounded-xl px-4 py-3 border border-emerald-100/30">
              <div className="text-xs text-gray-400 mb-0.5">Location</div>
              <div className={`text-sm ${decryptedData ? "font-medium text-gray-900" : "font-mono text-gray-400"}`}>
                {decryptedData?.location || "***"}
              </div>
            </div>
          </div>
        </div>

        {/* Decrypt Button */}
        <button
          onClick={handleDecrypt}
          disabled={isDecrypting}
          className="w-full mt-6 px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all duration-300 shadow-lg shadow-indigo-200/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 btn-press"
        >
          {isDecrypting ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Decrypting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Decrypt Card
            </>
          )}
        </button>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Accept the exchange request to unlock decryption
          </p>
        </div>
      </div>
    </div>
  );
}
