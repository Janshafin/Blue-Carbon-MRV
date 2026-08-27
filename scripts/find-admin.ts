import hre from "hardhat";

async function main() {
  const address =
    "0x815F9122D29471e161D66068Eef9a508EC079442" as `0x${string}`;

  const conn = await hre.network.connect();

  const contract = await conn.viem.getContractAt(
    "BlueCarbonCredit",
    address
  );

  const publicClient = await conn.viem.getPublicClient();

  const currentBlock = await publicClient.getBlockNumber();

  console.log("Contract:", address);
  console.log("Current block:", currentBlock);
  console.log("\nSearching RoleGranted events...\n");

  const events = await publicClient.getContractEvents({
    address,
    abi: contract.abi,
    eventName: "RoleGranted",
    fromBlock: 0n,
    toBlock: currentBlock,
  });

  for (const event of events) {
    console.log("RoleGranted:");
    console.log("  role:   ", event.args.role);
    console.log("  account:", event.args.account);
    console.log("  sender: ", event.args.sender);
    console.log("  block:  ", event.blockNumber);
    console.log("");
  }

  if (events.length === 0) {
    console.log("No RoleGranted events found.");
  }
}

await main();