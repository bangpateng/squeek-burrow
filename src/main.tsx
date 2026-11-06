import React from "react";
import ReactDOM from "react-dom/client";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import App from "./App";
import "./styles.css";
import { wagmiConfig } from "./web3/config";

const queryClient = new QueryClient();
const theme = darkTheme({ accentColor: "#FFB02E", accentColorForeground: "#120A00", borderRadius: "medium", overlayBlur: "small" });
theme.colors.modalBackground = "#110F17";
theme.colors.modalBorder = "rgba(255,255,255,0.12)";
theme.fonts.body = "Inter, system-ui, sans-serif";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} initialChain={sepolia} modalSize="wide" appInfo={{ appName: "Squeek Burrow", disclaimer: () => null }}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
