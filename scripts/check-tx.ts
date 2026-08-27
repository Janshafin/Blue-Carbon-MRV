import hre from "hardhat";

async function main() {
  const connection = await hre.network.getOrCreate("default");
  const publicClient = await connection.viem.getPublicClient();

  const hash =
    "0xd6d28413724d2147013cdf28b9f2fac07022f765ab9af017294a060adb49fdea" as `0x${string}`;

  try {
    const tx = await publicClient.getTransaction({ hash });

    console.log("TRANSACTION FOUND");
    console.log("Hash:", tx.hash);
    console.log("Block:", tx.blockNumber?.toString());
    console.log("From:", tx.from);
    console.log("To:", tx.to);
  } catch (error) {
    console.log("TRANSACTION NOT FOUND");
    console.error(error);
  }
}

main().catch(console.error);