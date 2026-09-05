import { useState, useEffect, useCallback } from "react";

// Minimal Ethereum window provider typing
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function useWallet() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load from local storage if previously connected
  useEffect(() => {
    const saved = localStorage.getItem("blue_carbon_wallet");
    if (saved && /^0x[a-fA-F0-9]{40}$/.test(saved)) {
      setWalletAddress(saved);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

        if (accounts && accounts.length > 0) {
          const addr = accounts[0];
          setWalletAddress(addr);
          localStorage.setItem("blue_carbon_wallet", addr);
        } else {
          setError("No Ethereum accounts found.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "User rejected wallet connection.";
        setError(msg);
      } finally {
        setIsConnecting(false);
      }
    } else {
      setIsConnecting(false);
      setError("No Web3 wallet extension found. You can still paste your address manually.");
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletAddress("");
    localStorage.removeItem("blue_carbon_wallet");
  }, []);

  const setManualWallet = useCallback((address: string) => {
    setWalletAddress(address);
    if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
      localStorage.setItem("blue_carbon_wallet", address);
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs && accs.length > 0) {
        setWalletAddress(accs[0]);
        localStorage.setItem("blue_carbon_wallet", accs[0]);
      } else {
        disconnectWallet();
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [disconnectWallet]);

  return {
    walletAddress,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    setManualWallet,
    hasInjectedProvider: typeof window !== "undefined" && !!window.ethereum,
  };
}
