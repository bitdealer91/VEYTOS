import { Account } from "@aptos-labs/ts-sdk";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import "dotenv/config";
import { dirname } from "node:path";
import { realpath } from "node:fs/promises";
import { validateAcceptanceEnvironment, assertOutsideRepository } from "./lib/acceptance-config.js";

// Testnet-only, disposable acceptance identities. Never log secret key material.
const path = validateAcceptanceEnvironment(process.env);
assertOutsideRepository(await realpath(process.cwd()), path);
const directory = dirname(path);
await mkdir(directory, { recursive: true, mode: 0o700 });
assertOutsideRepository(await realpath(process.cwd()), await realpath(directory));
await chmod(directory, 0o700);
let accounts: Record<string, { address: string; privateKey: string }>;
try {
  assertOutsideRepository(await realpath(process.cwd()), await realpath(path));
  accounts = JSON.parse(await readFile(path, "utf8"));
}
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  accounts = Object.fromEntries(["admin", "creator", "buyer"].map((role) => {
    const account = Account.generate();
    return [role, { address: account.accountAddress.toStringLong(), privateKey: account.privateKey.toString() }];
  }));
  await writeFile(path, JSON.stringify(accounts, null, 2), { mode: 0o600, flag: "wx" });
}
await chmod(path, 0o600);
console.log(JSON.stringify(Object.fromEntries(Object.entries(accounts).map(([role, value]) => [role, value.address])), null, 2));
