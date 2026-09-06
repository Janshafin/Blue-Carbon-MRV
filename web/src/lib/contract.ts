/**
 * contract.ts — Ethers.js v6 + MetaMask integration for BlueCarbonCredit
 *
 * Provides wallet connection and typed contract interaction functions
 * for the deployed BlueCarbonCredit contract on Sepolia.
 */

import { BrowserProvider, Contract, keccak256, parseEther, toUtf8Bytes } from "ethers";

// ─── Contract Details ───────────────────────────────────────────────────────

export const CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string) ||
  "0x815F9122D29471e161D66068Eef9a508EC079442";

/**
 * Human-readable ABI — ethers v6 parses these automatically.
 * Only includes the functions we actually call from the frontend.
 */
const CONTRACT_ABI = [
  // Write functions
  "function registerSubmission(bytes32 submissionId, string metadataURI, address beneficiary, uint256 creditAmount) external",
  "function releaseCredits(bytes32 submissionId) external",
  "function disputeSubmission(bytes32 submissionId, string reason) external",
  "function resolveDispute(bytes32 submissionId, bool approved) external",
  "function grantRole(bytes32 role, address account) external",

  // Read functions
  "function getSubmission(bytes32 submissionId) external view returns (tuple(bytes32 submissionId, string metadataURI, address beneficiary, uint256 creditAmount, uint256 mintedAt, uint8 status, string disputeReason, address disputedBy))",
  "function getSubmissionCount() external view returns (uint256)",
  "function getSubmissionIdAtIndex(uint256 index) external view returns (bytes32)",
  "function lockedBalance(address) external view returns (uint256)",
  "function unlockedBalanceOf(address account) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function VERIFIER_ROLE() external view returns (bytes32)",
  "function DISPUTER_ROLE() external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function vestingDuration() external view returns (uint256)",

  // Events
  "event SubmissionRegistered(bytes32 indexed submissionId, address indexed beneficiary, uint256 creditAmount, string metadataURI)",
  "event CreditProvisional(bytes32 indexed submissionId, address indexed beneficiary, uint256 amount)",
  "event CreditReleased(bytes32 indexed submissionId, address indexed beneficiary, uint256 amount)",
  "event SubmissionDisputed(bytes32 indexed submissionId, address indexed disputedBy, string reason)",
  "event DisputeResolved(bytes32 indexed submissionId, bool approved, address indexed resolvedBy)",
];

// ─── Wallet Connection ───────────────────────────────────────────────────────

let provider: BrowserProvider | null = null;

export function isMetaMaskAvailable(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum;
}

export async function connectWallet(): Promise<string> {
  if (!isMetaMaskAvailable()) {
    throw new Error("MetaMask is not installed. Please install it to interact with the blockchain.");
  }

  provider = new BrowserProvider((window as any).ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);

  // Request switch to Sepolia (chain ID 11155111 = 0xaa36a7)
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
  } catch (switchError: any) {
    // Chain not added — try to add it
    if (switchError.code === 4902) {
      await provider.send("wallet_addEthereumChain", [
        {
          chainId: "0xaa36a7",
          chainName: "Sepolia Testnet",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ]);
    }
  }

  return accounts[0];
}

export async function getConnectedAddress(): Promise<string | null> {
  if (!isMetaMaskAvailable()) return null;
  provider = new BrowserProvider((window as any).ethereum);
  const accounts = await provider.send("eth_accounts", []);
  return accounts.length > 0 ? accounts[0] : null;
}

// ─── Contract Helpers ────────────────────────────────────────────────────────

function getReadContract(): Contract {
  if (!provider) {
    provider = new BrowserProvider((window as any).ethereum);
  }
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

async function getWriteContract(): Promise<Contract> {
  if (!provider) {
    provider = new BrowserProvider((window as any).ethereum);
  }
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

// ─── Submission ID Hashing ───────────────────────────────────────────────────

/** Convert a UUID or string ID into a bytes32 hash for on-chain use. */
export function toSubmissionHash(id: string): string {
  // If already a 0x-prefixed 64-char hex, use as-is
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) return id;
  return keccak256(toUtf8Bytes(id));
}

// ─── On-chain Write Functions ────────────────────────────────────────────────

export interface TxResult {
  hash: string;
  blockNumber: number;
}

/**
 * Register a submission on-chain and mint provisional (locked) credits.
 */
export async function registerSubmissionOnChain(
  submissionId: string,
  metadataURI: string,
  beneficiaryAddress: string,
  creditAmountEth: string
): Promise<TxResult> {
  const contract = await getWriteContract();
  const hash = toSubmissionHash(submissionId);

  const tx = await contract.registerSubmission(
    hash,
    metadataURI,
    beneficiaryAddress,
    parseEther(creditAmountEth)
  );

  const receipt = await tx.wait();
  return {
    hash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

/**
 * Release credits after vesting period (makes them transferable).
 */
export async function releaseCreditsOnChain(submissionId: string): Promise<TxResult> {
  const contract = await getWriteContract();
  const tx = await contract.releaseCredits(toSubmissionHash(submissionId));
  const receipt = await tx.wait();
  return { hash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Dispute a provisional submission on-chain.
 */
export async function disputeSubmissionOnChain(
  submissionId: string,
  reason: string
): Promise<TxResult> {
  const contract = await getWriteContract();
  const tx = await contract.disputeSubmission(toSubmissionHash(submissionId), reason);
  const receipt = await tx.wait();
  return { hash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Resolve a dispute (approve = return to provisional, reject = burn).
 */
export async function resolveDisputeOnChain(
  submissionId: string,
  approved: boolean
): Promise<TxResult> {
  const contract = await getWriteContract();
  const tx = await contract.resolveDispute(toSubmissionHash(submissionId), approved);
  const receipt = await tx.wait();
  return { hash: receipt.hash, blockNumber: receipt.blockNumber };
}

// ─── On-chain Read Functions ─────────────────────────────────────────────────

export async function getSubmissionOnChain(submissionId: string) {
  const contract = getReadContract();
  return contract.getSubmission(toSubmissionHash(submissionId));
}

export async function getSubmissionCount(): Promise<number> {
  const contract = getReadContract();
  const count = await contract.getSubmissionCount();
  return Number(count);
}

export async function checkVerifierRole(address: string): Promise<boolean> {
  const contract = getReadContract();
  const role = await contract.VERIFIER_ROLE();
  return contract.hasRole(role, address);
}
