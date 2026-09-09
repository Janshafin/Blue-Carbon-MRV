import { createPublicClient, http, getContract } from "viem";
import { sepolia } from "viem/chains";
import fs from "fs";
import "dotenv/config";

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
  const adminRole = await contract.read.DEFAULT_ADMIN_ROLE();

  const wallet = "0x8Ee3206D92b70972dBe547F15915420bDd81D235";

  const isAdmin = await contract.read.hasRole([
    adminRole,
    wallet,
  ]);

  console.log("Wallet:", wallet);
  console.log("Has DEFAULT_ADMIN_ROLE:", isAdmin);
}

main().catch(console.error);