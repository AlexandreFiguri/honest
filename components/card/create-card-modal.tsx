"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useRelayerSdk } from "@/components/providers/relayer-provider";
import { useNotification } from "@/components/providers/notification-provider";
import { HONEST_CARD_ADDRESS, HONEST_CARD_ABI } from "@/lib/contract";

// Gender: 0=NotDisclosed, 1=Male, 2=Female, 3=Other
const GENDER_OPTIONS = [
  { value: 0, label: "Prefer not to say" },
  { value: 1, label: "Male" },
  { value: 2, label: "Female" },
  { value: 3, label: "Other" },
];

// Common country codes
const COUNTRY_CODES = [
  { code: "+1", country: "US/CA", flag: "US" },
  { code: "+44", country: "UK", flag: "GB" },
  { code: "+86", country: "CN", flag: "CN" },
  { code: "+81", country: "JP", flag: "JP" },
  { code: "+82", country: "KR", flag: "KR" },
  { code: "+852", country: "HK", flag: "HK" },
  { code: "+886", country: "TW", flag: "TW" },
  { code: "+65", country: "SG", flag: "SG" },
  { code: "+60", country: "MY", flag: "MY" },
  { code: "+61", country: "AU", flag: "AU" },
  { code: "+49", country: "DE", flag: "DE" },
  { code: "+33", country: "FR", flag: "FR" },
  { code: "+39", country: "IT", flag: "IT" },
  { code: "+34", country: "ES", flag: "ES" },
  { code: "+7", country: "RU", flag: "RU" },
  { code: "+91", country: "IN", flag: "IN" },
  { code: "+55", country: "BR", flag: "BR" },
  { code: "+52", country: "MX", flag: "MX" },
  { code: "+966", country: "SA", flag: "SA" },
  { code: "+971", country: "AE", flag: "AE" },
];

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateCardModal({ isOpen, onClose, onSuccess }: CreateCardModalProps) {
  const { address } = useAccount();
  const { instance } = useRelayerSdk();
  const { success, error: showError } = useNotification();

  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState(0);
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+86");
  const [phone, setPhone] = useState("");
  const [socialId, setSocialId] = useState("");
  const [location, setLocation] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Log write errors
  useEffect(() => {
    if (writeError) {
      console.error("[CreateCard] Write error:", writeError);
      showError(writeError.message || "Transaction failed");
    }
  }, [writeError, showError]);

  const handleSubmit = async () => {
    // Force immediate UI update
    setIsEncrypting(true);
    // Wait for UI to update
    await new Promise(r => setTimeout(r, 10));

    if (!instance || !address) {
      showError("Please connect wallet and wait for FHE initialization");
      setIsEncrypting(false);
      return;
    }

    // Validate all required fields
    if (!surname.trim()) {
      showError("Surname is required");
      setIsEncrypting(false);
      return;
    }
    if (!fullName.trim()) {
      showError("Full Name is required");
      setIsEncrypting(false);
      return;
    }
    if (!phone.trim()) {
      showError("Phone is required");
      setIsEncrypting(false);
      return;
    }
    if (!socialId.trim()) {
      showError("Social is required");
      setIsEncrypting(false);
      return;
    }
    if (!location.trim()) {
      showError("Location is required");
      setIsEncrypting(false);
      return;
    }

    try {
      console.log("[CreateCard] Starting encryption...");
      console.log("[CreateCard] Contract:", HONEST_CARD_ADDRESS);
      console.log("[CreateCard] User:", address);

      // Create encrypted input
      const input = instance.createEncryptedInput(HONEST_CARD_ADDRESS, address);
      console.log("[CreateCard] Input created");

      // Encode fullName to number
      let fullNameNum = BigInt(0);
      if (fullName) {
        const bytes = new TextEncoder().encode(fullName.slice(0, 7));
        let hex = "";
        bytes.forEach(b => { hex += b.toString(16).padStart(2, "0"); });
        fullNameNum = BigInt("0x" + hex || "0");
      }

      // Add encrypted values
      const genderNum = BigInt(gender);
      // Phone: combine country code + number, strip non-digits
      const fullPhone = countryCode + phone;
      const phoneNum = fullPhone ? BigInt(fullPhone.replace(/\D/g, "") || "0") : BigInt(0);
      
      // Encode socialId string to number (max 15 chars for uint128)
      let socialNum = BigInt(0);
      if (socialId) {
        const bytes = new TextEncoder().encode(socialId.slice(0, 15));
        let hex = "";
        bytes.forEach(b => { hex += b.toString(16).padStart(2, "0"); });
        socialNum = BigInt("0x" + hex || "0");
      }
      
      // Encode location string to number (max 31 chars for uint256)
      let locationNum = BigInt(0);
      if (location) {
        const bytes = new TextEncoder().encode(location.slice(0, 31));
        let hex = "";
        bytes.forEach(b => { hex += b.toString(16).padStart(2, "0"); });
        locationNum = BigInt("0x" + hex || "0");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input as any).add8(genderNum);
      input.add64(phoneNum);
      input.add64(fullNameNum);
      input.add128(socialNum);
      input.add256(locationNum);

      console.log("[CreateCard] Encrypting...");
      const encrypted = await input.encrypt();
      console.log("[CreateCard] Encrypted, handles:", encrypted.handles);
      setIsEncrypting(false);

      // Convert handles to hex strings
      const toHex = (handle: unknown): `0x${string}` => {
        if (typeof handle === "string") {
          return handle.startsWith("0x") ? handle as `0x${string}` : `0x${handle}`;
        }
        if (typeof handle === "bigint") {
          return `0x${handle.toString(16).padStart(64, "0")}`;
        }
        if (handle instanceof Uint8Array) {
          return `0x${Array.from(handle).map(b => b.toString(16).padStart(2, "0")).join("")}`;
        }
        return `0x${String(handle)}`;
      };

      // Call contract
      console.log("[CreateCard] Calling contract...");
      console.log("[CreateCard] handles:", encrypted.handles);
      console.log("[CreateCard] inputProof type:", typeof encrypted.inputProof);
      writeContract({
        address: HONEST_CARD_ADDRESS as `0x${string}`,
        abi: HONEST_CARD_ABI,
        functionName: "createCard",
        args: [
          surname,
          toHex(encrypted.handles[0]), // gender
          toHex(encrypted.handles[1]), // phone
          toHex(encrypted.handles[2]), // fullName
          toHex(encrypted.handles[3]), // socialId
          toHex(encrypted.handles[4]), // location
          toHex(encrypted.inputProof),
        ],
      });
    } catch (err) {
      setIsEncrypting(false);
      console.error("Create card error:", err);
      showError(err instanceof Error ? err.message : "Failed to create card");
    }
  };

  // Handle success
  const hasHandledSuccess = useRef(false);
  useEffect(() => {
    if (isSuccess && !hasHandledSuccess.current) {
      hasHandledSuccess.current = true;
      success("Card created successfully!");
      onSuccess?.();
      onClose();
    }
  }, [isSuccess, success, onSuccess, onClose]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      hasHandledSuccess.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLoading = isEncrypting || isPending || isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md modal-backdrop" onClick={isLoading ? undefined : onClose} />

      {/* Modal */}
      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 border border-white/50 modal-content">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200/50">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Create Your Card</h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="space-y-5">
          {/* Section: Public */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Public Info</h3>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Surname</label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="Enter your surname"
                className="w-full px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-300 transition-all bg-white/80 text-gray-900 input-glow placeholder:text-gray-400"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Section: Encrypted */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Encrypted Info</h3>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] rounded-full font-medium">FHE Protected</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all bg-white/80 text-gray-900 input-glow"
                  disabled={isLoading}
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all bg-white/80 text-gray-900 input-glow placeholder:text-gray-400"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-28 px-3 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all bg-white/80 text-gray-900 text-sm input-glow"
                  disabled={isLoading}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} {c.country}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="flex-1 px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all bg-white/80 text-gray-900 input-glow placeholder:text-gray-400"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Social</label>
              <input
                type="text"
                value={socialId}
                onChange={(e) => setSocialId(e.target.value)}
                placeholder="X / Telegram / Discord"
                className="w-full px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all bg-white/80 text-gray-900 input-glow placeholder:text-gray-400"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or address"
                className="w-full px-4 py-3 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-300 transition-all bg-white/80 text-gray-900 input-glow placeholder:text-gray-400"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !surname.trim() || !fullName.trim() || !phone.trim() || !socialId.trim() || !location.trim()}
            className="w-full px-4 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-200/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 btn-press"
          >
            {isLoading && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isEncrypting ? "Encrypting..." : isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Create Card"}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Encrypted fields are only visible after mutual exchange
          </p>
        </div>
      </div>
    </div>
  );
}
