import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  throw new Error("PRIVATE_KEY is not set");
}

const account = privateKeyToAccount(privateKey as `0x${string}`);

console.log(account.address);