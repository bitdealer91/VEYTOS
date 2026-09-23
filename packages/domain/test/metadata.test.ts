import { test } from "node:test";
import assert from "node:assert/strict";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { isIpfsUri, validateManifest } from "../src/metadata.js";

const cid = CID.createV1(0x55, await sha256.digest(new TextEncoder().encode("test fixture"))).toString();
const uri = `ipfs://${cid}`;
const token = (id: number) => ({ id, metadataUri: `${uri}/${id}.json`, metadata: {
  name: `NFT #${id}`, description: "Test fixture only", image: `${uri}/${id}.png`,
  attributes: [{ trait_type: "Color", value: "Black" }],
} });

test("manifest validates all IDs and sorts their deployment order", () => {
  const result = validateManifest({ version: 1, tokens: [token(2), token(1)] }, 2);
  assert.deepEqual(result.tokens.map((t) => t.id), [1, 2]);
});

test("rejects missing images, malformed attributes, supply gaps and duplicates", () => {
  const missingImage = token(1); missingImage.metadata.image = "";
  const duplicateTrait = token(1); duplicateTrait.metadata.attributes.push({ trait_type: "Color", value: "White" });
  const longName = token(1); longName.metadata.name = "😀".repeat(33);
  for (const tokens of [[token(1), token(1)], [token(1), token(3)], [missingImage], [duplicateTrait], [longName]]) {
    assert.throws(() => validateManifest({ version: 1, tokens }, tokens.length));
  }
  assert.throws(() => validateManifest({ version: 1, tokens: [token(1)] }, 2));
  const badAttribute = { ...token(1), metadata: { ...token(1).metadata, attributes: [{ trait_type: "X", value: {} }] } };
  assert.throws(() => validateManifest({ version: 1, tokens: [badAttribute] }, 1));
});

test("content URIs require a real CID and reject ambiguous paths", () => {
  assert(isIpfsUri(uri));
  assert(isIpfsUri(`${uri}/1.png`));
  for (const bad of ["https://example.com/a.png", "ipfs://fake/1", `${uri}/../1`, `${uri}/%2e%2e/1`, `${uri}/x%2fy`, `${uri}/x?y`, `${uri}/x%00`, `${uri}//1`]) assert.equal(isIpfsUri(bad), false, bad);
});
