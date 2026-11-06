import { ConnectButton } from "@rainbow-me/rainbowkit";

// The standard dApp connect button, styled for Squeek Burrow. RainbowKit picks the right flow per device:
// a modal with installed wallets and QR on desktop, deep links to wallet apps on phones.
export function WalletButton({ compact = false }: { compact?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        if (!ready) return <span className="walletBtn ghostBtn" aria-hidden="true" />;
        if (!account || !chain)
          return (
            <button className="walletBtn" onClick={openConnectModal}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <rect x="3" y="6" width="18" height="13" rx="2.5" />
                <path d="M16 12.5h2M3 9.5h14.5A2.5 2.5 0 0 0 15 7" />
              </svg>
              {compact ? "CONNECT" : "CONNECT WALLET"}
            </button>
          );
        if (chain.unsupported)
          return (
            <button className="walletBtn warn" onClick={openChainModal}>
              SWITCH TO SEPOLIA
            </button>
          );
        return (
          <button className="walletChip" onClick={openAccountModal}>
            <span className="net">Sepolia</span>
            <span>{account.displayName}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
