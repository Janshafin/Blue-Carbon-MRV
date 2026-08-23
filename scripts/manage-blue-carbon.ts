import hre from "hardhat";
import { keccak256, parseEther, toHex } from "viem";

const address = process.env.BLUE_CARBON_CREDIT_ADDRESS as `0x${string}` | undefined;
const action = process.env.BLUE_CARBON_ACTION;

if (!address || !action) {
  throw new Error(
    "Set BLUE_CARBON_CREDIT_ADDRESS and BLUE_CARBON_ACTION before running this script."
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for ${action}`);
  return value;
}

function submissionId(): `0x${string}` {
  const rawId = requireEnv("SUBMISSION_ID");
  if (/^0x[0-9a-fA-F]{64}$/.test(rawId)) return rawId as `0x${string}`;
  return keccak256(toHex(rawId));
}

async function main() {
  const contractAddress = address;
  if (!contractAddress) throw new Error("BLUE_CARBON_CREDIT_ADDRESS is required");
  const conn = await hre.network.getOrCreate("default");
  const contract = await conn.viem.getContractAt("BlueCarbonCredit", contractAddress);
  let hash: `0x${string}`;

  switch (action) {
    case "grant-verifier":
      hash = await contract.write.grantRole([
        keccak256(toHex("VERIFIER_ROLE")),
        requireEnv("ROLE_ACCOUNT") as `0x${string}`,
      ]);
      break;
    case "grant-disputer":
      hash = await contract.write.grantRole([
        keccak256(toHex("DISPUTER_ROLE")),
        requireEnv("ROLE_ACCOUNT") as `0x${string}`,
      ]);
      break;
    case "register":
      hash = await contract.write.registerSubmission([
        submissionId(),
        requireEnv("METADATA_URI"),
        requireEnv("BENEFICIARY_ADDRESS") as `0x${string}`,
        parseEther(requireEnv("CREDIT_AMOUNT")),
      ]);
      break;
    case "release":
      hash = await contract.write.releaseCredits([submissionId()]);
      break;
    case "dispute":
      hash = await contract.write.disputeSubmission([
        submissionId(),
        requireEnv("DISPUTE_REASON"),
      ]);
      break;
    case "resolve":
      hash = await contract.write.resolveDispute([
        submissionId(),
        requireEnv("DISPUTE_APPROVED") === "true",
      ]);
      break;
    default:
      throw new Error(
        "BLUE_CARBON_ACTION must be grant-verifier, grant-disputer, register, release, dispute, or resolve."
      );
  }

  const receipt = await (await conn.viem.getPublicClient()).waitForTransactionReceipt({ hash });
  console.log(
    JSON.stringify({ action, contract: contractAddress, transactionHash: hash, status: receipt.status })
  );
}

await main();
