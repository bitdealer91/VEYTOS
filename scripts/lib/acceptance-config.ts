import { isAbsolute, relative, sep } from "node:path";

const TESTNET_FULLNODES = new Set([
  "https://api.testnet.aptoslabs.com/v1",
  "https://fullnode.testnet.aptoslabs.com/v1",
]);
export const TESTNET_FULLNODE = (process.env.APTOS_FULLNODE_URL || "https://api.testnet.aptoslabs.com/v1").replace(/\/$/, "");

export function validateAcceptanceEnvironment(env: NodeJS.ProcessEnv) {
  for (const key of ["APTOS_NETWORK", "NEXT_PUBLIC_APTOS_NETWORK"]) {
    if (env[key] && env[key] !== "testnet") throw new Error(`${key} must be testnet for Gate A`);
  }
  const requestedFullnode = (env.APTOS_FULLNODE_URL || "https://api.testnet.aptoslabs.com/v1").replace(/\/$/, "");
  if (!TESTNET_FULLNODES.has(requestedFullnode)) {
    throw new Error("Gate A uses an official Aptos testnet fullnode; remove conflicting APTOS_FULLNODE_URL");
  }
  const path = env.MINTOS_TESTNET_ACCOUNTS_FILE;
  if (!path || !isAbsolute(path)) throw new Error("Set MINTOS_TESTNET_ACCOUNTS_FILE to an absolute path outside the repository");
  return path;
}

/** Call on real paths so symlinks cannot disguise a key file inside the checkout. */
export function assertOutsideRepository(repository: string, file: string) {
  const location = relative(repository, file);
  if (!location || (!location.startsWith(`..${sep}`) && location !== ".." && !isAbsolute(location))) {
    throw new Error("Private keys must be stored outside the repository");
  }
}

/** A 404 permits only re-submission of the SAME signed bytes, never re-signing. */
export function shouldResubmit(lookupStatus: number) {
  if (lookupStatus === 404) return true;
  if (lookupStatus === 200) return false;
  throw new Error(`Transaction lookup HTTP ${lookupStatus}; stop and reconcile, do not re-sign`);
}
