import { z } from "zod";

export const brand = Object.freeze({
  name: "VEYTOS",
  tagline: "The home of Aptos NFTs.",
  marketingLine: "Launch. Collect. Trade.",
  metadata: Object.freeze({ title: "VEYTOS — The home of Aptos NFTs.", description: "Discover Aptos NFTs, launch collections and collect native digital assets." }),
  // No invented social handles or support destinations.
  socialLinks: Object.freeze({ x: null, discord: null }),
  supportLinks: Object.freeze({ help: null, security: null }),
});
export const feeDisplay = Object.freeze({
  primaryDefaultBps: 500,
  primaryMaximumBps: 1000,
  secondaryTargetBps: 200,
  secondaryStatus: "testnet-verified" as const,
});
export const networkSchema = z.enum(["devnet", "testnet", "mainnet"]);
export type AptosNetwork = z.infer<typeof networkSchema>;

const optionalAddress = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().regex(/^0x[0-9a-fA-F]{1,64}$/).transform((value) => {
    if (BigInt(value) === 0n) throw new Error("The launchpad address must be nonzero");
    return `0x${value.slice(2).toLowerCase().padStart(64, "0")}`;
  }).optional(),
);

const publicSchema = z.object({
  NEXT_PUBLIC_APTOS_NETWORK: networkSchema.default("testnet"),
  NEXT_PUBLIC_LAUNCHPAD_ADDRESS: optionalAddress,
  NEXT_PUBLIC_MARKETPLACE_ADDRESS: optionalAddress,
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_IPFS_GATEWAY: z.url().default("https://ipfs.io/ipfs/"),
  NEXT_PUBLIC_ARWEAVE_GATEWAY: z.url().default("https://arweave.net/"),
  NEXT_PUBLIC_APTOS_FULLNODE_URL: z.url().optional(),
  NEXT_PUBLIC_APTOS_INDEXER_URL: z.url().optional(),
  NEXT_PUBLIC_FEEDBACK_URL: z.url().optional(),
});

export function readPublicConfig(env: Record<string, string | undefined>) {
  const config = publicSchema.parse(env);
  if (env.APTOS_NETWORK && env.APTOS_NETWORK !== config.NEXT_PUBLIC_APTOS_NETWORK) {
    throw new Error("Server and browser Aptos networks must match");
  }
  if (config.NEXT_PUBLIC_APTOS_NETWORK === "mainnet") {
    if (!config.NEXT_PUBLIC_LAUNCHPAD_ADDRESS) throw new Error("Mainnet requires a published launchpad address");
    if (new URL(config.NEXT_PUBLIC_APP_URL).protocol !== "https:") throw new Error("Mainnet requires an HTTPS origin");
  }
  return config;
}
