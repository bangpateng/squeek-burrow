import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet, injectedWallet, metaMaskWallet, okxWallet, phantomWallet, rabbyWallet, rainbowWallet, trustWallet, walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, fallback, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { RPCS } from "./reader";

// A free Reown (WalletConnect) project id from https://cloud.reown.com. Without it, wallets installed
// in the browser still connect; mobile deep links and QR codes need it.
export const projectId: string = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
export const hasWalletConnect = projectId.length > 0;

const app = { appName: "Squeek Burrow", appDescription: "Hamster kart racing on the live Squeekchain wheel", appUrl: "https://squeekburrow.site" };

const connectors = connectorsForWallets(
  hasWalletConnect
    ? [
        { groupName: "Popular", wallets: [metaMaskWallet, okxWallet, rabbyWallet, coinbaseWallet, phantomWallet] },
        { groupName: "More", wallets: [trustWallet, rainbowWallet, walletConnectWallet] },
      ]
    : [{ groupName: "Wallets", wallets: [injectedWallet, coinbaseWallet] }],
  { ...app, projectId: projectId || "missing" },
);

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: { [sepolia.id]: fallback(RPCS.map((u) => http(u))) },
  multiInjectedProviderDiscovery: true,
  ssr: false,
});
