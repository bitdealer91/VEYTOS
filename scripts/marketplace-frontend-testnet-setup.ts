import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, realpath, stat } from 'node:fs/promises';
import { Account, AccountAddress, Aptos, AptosConfig, Ed25519PrivateKey, Network, type InputEntryFunctionData } from '@aptos-labs/ts-sdk';
import { assertOutsideRepository, validateAcceptanceEnvironment } from './lib/acceptance-config.js';

const packageAddress = process.env.MARKETPLACE_ADDRESS;
const veytosCollection = process.env.VEYTOS_V2_REVIEWED_COLLECTION;
assert(packageAddress && /^0x[0-9a-f]{64}$/.test(packageAddress), 'MARKETPLACE_ADDRESS is required');
assert(veytosCollection && /^0x[0-9a-f]{64}$/.test(veytosCollection), 'VEYTOS_V2_REVIEWED_COLLECTION is required');
const accountsPath = await realpath(validateAcceptanceEnvironment(process.env));
const root = await realpath(process.cwd());
assertOutsideRepository(root, accountsPath);
assert.equal((await stat(accountsPath)).mode & 0o077, 0);
const secrets = JSON.parse(await readFile(accountsPath, 'utf8')) as Record<string, { address: string; privateKey: string }>;
const canonicalPackage = AccountAddress.from(packageAddress).toStringLong();
const record = Object.values(secrets).find((candidate) => AccountAddress.from(candidate.address).toStringLong() === canonicalPackage);
assert(record, `Marketplace publisher ${canonicalPackage} is unavailable in the protected testnet account file`);
const admin = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(record.privateKey) });
const fullnode = (process.env.APTOS_FULLNODE_URL || 'https://api.testnet.aptoslabs.com/v1').replace(/\/$/, '');
assert(['https://api.testnet.aptoslabs.com/v1', 'https://fullnode.testnet.aptoslabs.com/v1'].includes(fullnode), 'Use an official Aptos testnet fullnode');
const apiKey = process.env.APTOS_API_KEY;
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET, fullnode, ...(apiKey ? { fullnodeConfig: { HEADERS: { Authorization: `Bearer ${apiKey}` } } } : {}) }));

async function submit(name: string, data: InputEntryFunctionData) {
  const transaction = await aptos.transaction.build.simple({ sender: admin.accountAddress, data, options: { maxGasAmount: 100_000 } });
  const [simulation] = await aptos.transaction.simulate.simple({ signerPublicKey: admin.publicKey, transaction });
  assert(simulation?.success, `${name} simulation failed: ${simulation?.vm_status}`);
  const pending = await aptos.signAndSubmitTransaction({ signer: admin, transaction });
  const result = await aptos.waitForTransaction({ transactionHash: pending.hash });
  assert(result.success, `${name} failed`);
  console.log(`${name}: ${result.hash}`);
}

let v2Initialized = true;
try {
  await aptos.getAccountResource({ accountAddress: packageAddress, resourceType: `${packageAddress}::settlement_v2::Escrows` });
} catch { v2Initialized = false; }
if (!v2Initialized) await submit('initialize-v2', { function: `${packageAddress}::settlement_v2::initialize`, functionArguments: [] });
const [policy] = await aptos.view<[boolean, number]>({ payload: { function: `${packageAddress}::marketplace::v2_collection_policy`, functionArguments: [veytosCollection] } });
if (!policy) await submit('approve-veytos-collection', { function: `${packageAddress}::marketplace::set_v2_collection_reviewed`, functionArguments: [veytosCollection, 1, true] });
console.log(`Marketplace frontend testnet setup ready at ${packageAddress}`);
