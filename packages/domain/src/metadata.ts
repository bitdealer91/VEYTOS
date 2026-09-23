import { CID } from "multiformats/cid";
import { z } from "zod";

const bytes = (value: string) => new TextEncoder().encode(value).length;
const text = (max: number) => z.string().min(1).refine((value) => bytes(value) <= max, `Must fit ${max} UTF-8 bytes`);

export function isIpfsUri(value: string): boolean {
  if (!value.startsWith("ipfs://") || bytes(value) > 512) return false;
  const [cid, ...segments] = value.slice(7).split("/");
  try {
    CID.parse(cid!);
    return segments.every((segment) => {
      const decoded = decodeURIComponent(segment);
      return decoded.length > 0 && ![".", ".."].includes(decoded) && !/[\\/?#\x00-\x1f]/.test(decoded);
    });
  } catch { return false; }
}

export const ipfsUriSchema = z.string().refine(isIpfsUri, "Use a valid immutable ipfs:// URI");
const attributeSchema = z.object({
  trait_type: text(128),
  value: z.union([text(512), z.number().finite().refine((v) => !Number.isInteger(v) || Number.isSafeInteger(v), "Integer attribute exceeds safe precision"), z.boolean()]),
}).strict();

export const tokenMetadataSchema = z.object({
  name: text(128),
  description: z.string().refine((value) => bytes(value) <= 2048, "Description too long"),
  image: ipfsUriSchema,
  attributes: z.array(attributeSchema).max(100).default([]),
}).strict().superRefine((metadata, ctx) => {
  const seen = new Set<string>();
  for (const attribute of metadata.attributes) {
    if (seen.has(attribute.trait_type)) ctx.addIssue({ code: "custom", message: "Duplicate attribute name" });
    seen.add(attribute.trait_type);
  }
});

const manifestSchema = z.object({
  version: z.literal(1),
  tokens: z.array(z.object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    metadataUri: ipfsUriSchema,
    metadata: tokenMetadataSchema,
  }).strict()).min(1),
}).strict();

/** Structural validation only. Upload verification must prove URI content matches. */
export function validateManifest(input: unknown, supply: number) {
  if (!Number.isSafeInteger(supply) || supply <= 0) throw new Error("Supply must be a positive safe integer");
  const manifest = manifestSchema.parse(input);
  if (manifest.tokens.length !== supply) throw new Error("Metadata count must equal supply");
  const ids = new Set<number>();
  const names = new Set<string>();
  for (const token of manifest.tokens) {
    if (ids.has(token.id)) throw new Error("Duplicate token ID");
    if (token.id > supply) throw new Error("Token IDs must cover 1 through supply");
    if (names.has(token.metadata.name)) throw new Error("Duplicate token name");
    ids.add(token.id);
    names.add(token.metadata.name);
  }
  return { ...manifest, tokens: [...manifest.tokens].sort((a, b) => a.id - b.id) };
}
