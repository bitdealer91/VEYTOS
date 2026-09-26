# Privileged roles and retained capabilities

Status: proposal and current-code inventory; no mainnet authority has been configured.

There are **six requested governance role categories**, mapped to fewer current signer authorities. Launchpad admin and primary fee-policy admin are the same stored address. Marketplace admin, secondary fee-policy admin and V2 registry authority are the same stored address. “Signer separation” below is a proposed operational model, not an implemented role split.

## 1. Launchpad admin

Current authority: `launchpad::fee_policy::Config.admin`; initially publishing address. Can set platform pause, per-drop admin pause, primary fee <=1000 bps, treasury recipient, and nominate successor. Cannot clear creator pause, change finalized terms, transfer holder NFTs, bypass paid mint checks or recover a lost admin through a backdoor. Compromise permits denial of mint service and future fee redirection. Needed after launch for pause/rotation; use a dedicated 2-of-3 hardware-backed multisig. No renounce function exists; removal would sacrifice recovery and require a separately reviewed design. Do not set an inaccessible address as an informal substitute.

## 2. Marketplace admin

Current authority: `marketplace_fee_policy::Config.admin`. Can change global/V1/V2 pause, fee <=500 bps, each reimbursement <=10000000 octas, recipient, registry and successor. Cannot reprice/sweep/revive listings or cancel for seller. Compromise can stop trading, redirect future fees and approve unsafe V2 provenance; the latter can enable external creator seizure. Needed after launch; dedicated 2-of-3 hardware-backed multisig. Cannot currently be safely removed while retaining registry/pause operation.

## 3. Fee-policy admin

Not a third independent signer: primary policy uses role 1, secondary policy role 2. Can change only future rate snapshots; current treasury destination is intentionally dynamic for existing drops/listings. Cannot rewrite active fee/royalty snapshots or withdraw private custody. Compromise changes future economics up to caps; existing listings retain rates and reimbursement. Needed for treasury rotation; protected by those multisigs. Splitting fee authority or adding a pause-only key is future contract work requiring review, not part of Phase 3C.

## 4. Treasury

One recipient per package; may be separate treasury addresses. Receives fees and controls its own received APT. Cannot authorize trades, change configuration merely by receiving fees, seize NFTs or undo settlements. Compromise loses treasury balance; admin rotates future destination with `set_recipient`, without moving old funds. Needed after launch; use separate 3-of-5 cold treasury multisig, with signers distinct enough that no operational quorum can also spend treasury funds. Receiver can rotate indefinitely; no contract removal path needed. Removing fees requires an explicit policy decision, not silent disposal of treasury keys.

## 5. V2 reviewed-collection authority

Executed by role 2 through `marketplace::set_v2_collection_reviewed`; no independently stored registry admin. Can approve/revoke canonical Collection objects and mark provenance 1 or 2. Cannot prove absence of external capabilities, overwrite token identity, or stop an existing BUY by revocation alone. Compromise can admit a dangerous collection; use independent technical review plus marketplace multisig approval. Needed while admitting collections; eventual closed registry is possible by policy, but the signer still has this power. Enforced removal/separation needs future audited code.

## 6. Package upgrade authority

Publishing-account signer for each address-published package, initially also initialization signer. Compatible upgrades can change custody logic and expose retained capabilities; signature/layout compatibility is not a security sandbox. It cannot upgrade an immutable package under the reviewed framework rules. Compromise while compatible is a potential total custody compromise. Recommend remove upgrade ability through immutable package policy at mainnet launch, after review. If beta upgrades are chosen, use a separate 3-of-5 cold governance multisig per publisher with reviewed transaction payloads and no hot browser key; policy removal is irreversible. Account key rotation alone does not make package code immutable.

## Other signers/capabilities in the security boundary

- Publishing signer initializes each Config/State/Escrows once. After initialization, rotating operational admin does not rotate the publishing account or remove its upgrade authority.
- Pending admin is an Option<address>, not a signer capability. Current admin nominates; exact nominee must accept. Lost quorum/keys have no hidden recovery path.
- Drop creator signer prepares/appends/finalizes and controls creator pause; buyer signer authorizes mint payments. Compromise affects that creator's unfinished drops, pause and personal funds. Creator is needed until finalization and for creator pause; not a global multisig role requirement.
- Seller/buyer signers authorize exact NFT custody/payment. Marketplace does not store their account signer capabilities.
- Private drop ExtendRef persists per Drop. It cannot be operationally rotated/extracted with current API; needed for minting. No collection/NFT mutator, transfer or burn reference survives construction in launchpad.
- Private V2 ExtendRef exists per active escrow, generates only that unique signer address, and is consumed/dropped on terminal settlement. No ObjectCore shell is retained. Needed while listing is active; no multisig key corresponds to it.
- V1 private linear Token is the custody value, not a broad withdrawal capability. It is moved out exactly once on cancel/buy. Third-party pre-existing WithdrawCapability values are external residual authority; they are not retained by VEYTOS and cannot be enumerated/revoked here.

## Practical signer policy and ceremony

Use separate accounts for launchpad operations (2-of-3), marketplace operations (2-of-3), treasury (3-of-5), and each package publisher (3-of-5 until immutable). Assign security lead, operations lead and independent backup as operational owners, with distinct hardware devices and backups; treasury/governance quorums include finance and independent custodians. No one person, seed or device should satisfy any quorum or control all domains. Multisig account execution must produce the exact account signer expected by these entry functions; validate supported wallet/CLI payload execution on testnet before selecting tooling.

Routine fee/recipient/registry changes: written rationale, decoded entry function/arguments, independent reviewer, simulation, two approvals, committed-event verification. Registry dossier includes creator deployment, capability creation/storage paths, upgrade policy and provenance evidence; unknown capability provenance means deny approval.

Emergency pause: on-call proposes global or adapter pause and another operational signer confirms promptly. No single hot pause key exists in current code; adding one would be new privileged contract behavior. Maintain reachable backups and rehearse quorum latency. Unpause requires incident lead signoff, reproduced cause, tested remediation and two approvals.

Treasury rotation: verify new multisig control on testnet, independently compare full address, submit `set_recipient` for each applicable policy, verify configuration and event through independent reads, then check next accepted payment. Never infer destination from UI labels. Admin rotation uses `propose_admin` then `accept_admin` executed as successor multisig; verify old-admin failure and new-admin control before retiring devices.

Upgrade, if retained: independent audit of diff, public hash/notice and exit window, cold governance approvals, pause new economic activity while preserving seller cancel, payload bytecode/hash verification, commit reconciliation and renewed acceptance. The proposed notice/window is procedural; there is no on-chain timelock enforcement in this repository. Native multisig does not itself implement per-function least privilege. Implement/test the account policy and publish its limitations before mainnet.
