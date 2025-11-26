import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { cookieStorage, createStorage, http } from "wagmi";
import { sepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (!projectId) {
  throw new Error("NEXT_PUBLIC_WC_PROJECT_ID is not set");
}

const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";

export const SEPOLIA_CHAIN_ID = sepolia.id;
export const SEPOLIA_RPC_URL = sepoliaRpcUrl;

export const wagmiConfig = getDefaultConfig({
  appName: "Honest",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
});
