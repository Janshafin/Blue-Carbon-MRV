import { createPublicClient, http, getContract } from "viem";
import { sepolia } from "viem/chains";
import fs from "fs";

const artifact = JSON.parse(
  fs.readFileSync(
    "artifacts/contracts/BlueCarbonCredit.sol/BlueCarbonCredit.json",
    "utf-8"
  )
);

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
});

const contract = getContract({
  address: "0x815F9122D29471e161D66068Eef9a508EC079442",
  abi: artifact.abi,
  client,
});

async function main() {
  const count = await contract.read.getSubmissionCount();

  console.log("Contract address:", "0x815F9122D29471e161D66068Eef9a508EC079442");
  console.log("Submission count:", count.toString());
}

main().catch(console.error);