import hre from "hardhat";
import { keccak256, toHex } from "viem";

async function main() {
  const address = process.env.BLUE_CARBON_CREDIT_ADDRESS as `0x${string}`;

  if (!address) {
    throw new Error("Set BLUE_CARBON_CREDIT_ADDRESS");
  }

  const conn = await hre.network.connect();

  const contract = await conn.viem.getContractAt(
    "BlueCarbonCredit",
    address
  );

  const publicClient = await conn.viem.getPublicClient();

  const [wallet] = await conn.viem.getWalletClients();

  const verifierRole = keccak256(toHex("VERIFIER_ROLE"));
  const disputerRole = keccak256(toHex("DISPUTER_ROLE"));

  const defaultAdminRole =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  console.log("Contract:", address);
  console.log("Current wallet:", wallet.account.address);

  console.log("\nRole hashes:");
  console.log("DEFAULT_ADMIN_ROLE:", defaultAdminRole);
  console.log("VERIFIER_ROLE:", verifierRole);
  console.log("DISPUTER_ROLE:", disputerRole);

  console.log("\nCurrent wallet roles:");

  console.log(
    "DEFAULT_ADMIN_ROLE:",
    await contract.read.hasRole([
      defaultAdminRole,
      wallet.account.address,
    ])
  );

  console.log(
    "VERIFIER_ROLE:",
    await contract.read.hasRole([
      verifierRole,
      wallet.account.address,
    ])
  );

  console.log(
    "DISPUTER_ROLE:",
    await contract.read.hasRole([
      disputerRole,
      wallet.account.address,
    ])
  );

  console.log("\nRole admins:");

  console.log(
    "VERIFIER_ROLE admin:",
    await contract.read.getRoleAdmin([verifierRole])
  );

  console.log(
    "DISPUTER_ROLE admin:",
    await contract.read.getRoleAdmin([disputerRole])
  );
}

await main();