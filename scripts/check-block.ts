import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect();
  const publicClient = await connection.viem.getPublicClient();

  const chainId = await publicClient.getChainId();
  const blockNumber = await publicClient.getBlockNumber();

  console.log("Chain ID:", chainId);
  console.log("Block number:", blockNumber.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});