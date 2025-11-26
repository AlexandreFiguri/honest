"use client";

import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { useWalletClient } from "wagmi";
import { loadRelayerSdk, type RelayerInstance } from "@/lib/relayer-sdk";
import { SEPOLIA_RPC_URL, SEPOLIA_CHAIN_ID } from "@/lib/wagmi";

type RelayerSdkModule = Awaited<ReturnType<typeof loadRelayerSdk>>;

type RelayerContextValue = {
  sdk: RelayerSdkModule | null;
  loading: boolean;
  error: Error | null;
  instance: RelayerInstance | null;
  instanceLoading: boolean;
  instanceError: Error | null;
};

const RelayerContext = createContext<RelayerContextValue>({
  sdk: null,
  loading: true,
  error: null,
  instance: null,
  instanceLoading: false,
  instanceError: null,
});

const createEip1193Provider = (wallet: NonNullable<ReturnType<typeof useWalletClient>["data"]>) => {
  const requestImpl = (args: unknown) => (wallet as unknown as { request: (a: unknown) => Promise<unknown> }).request(args);
  return { request: requestImpl } as { request: (a: unknown) => Promise<unknown> };
};

export function RelayerProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<RelayerContextValue>({
    sdk: null,
    loading: true,
    error: null,
    instance: null,
    instanceLoading: false,
    instanceError: null,
  });
  const { data: walletClient } = useWalletClient();
  const sdk = state.sdk;

  useEffect(() => {
    let cancelled = false;

    loadRelayerSdk()
      .then((sdk) => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, sdk, loading: false, error: null }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            sdk: null,
            loading: false,
            error: error instanceof Error ? error : new Error("Failed to load SDK"),
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!sdk || !walletClient) {
      setState((prev) => ({ ...prev, instance: null, instanceLoading: false, instanceError: null }));
      return;
    }

    const run = async () => {
      try {
        setState((prev) => ({ ...prev, instanceLoading: true, instanceError: null }));

        let chainIdHex: string | null = null;
        try {
          const raw = await (walletClient.request as unknown as (a: unknown) => Promise<unknown>)({ method: "eth_chainId" });
          if (typeof raw === "string") chainIdHex = raw;
        } catch {
          // ignore
        }

        const chainId = chainIdHex ? parseInt(chainIdHex, 16) : SEPOLIA_CHAIN_ID;
        const eip1193Provider = createEip1193Provider(walletClient);

        const config = {
          ...sdk.SepoliaConfig,
          network: SEPOLIA_RPC_URL,
          chainId,
          signer: eip1193Provider,
        };

        const instance = await sdk.createInstance(config as Record<string, unknown>);
        if (!cancelled) {
          setState((prev) => ({ ...prev, instance, instanceLoading: false, instanceError: null }));
        }
      } catch (err) {
        console.error("[Relayer] Failed to create instance", err);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            instance: null,
            instanceLoading: false,
            instanceError: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sdk, walletClient]);

  const value = useMemo(() => state, [state]);

  return <RelayerContext.Provider value={value}>{children}</RelayerContext.Provider>;
}

export function useRelayerSdk() {
  return useContext(RelayerContext);
}
