import type { Metadata } from 'next';
import { brand } from '@veytos/config';
import { network } from '@/lib/config';
import { AptosCurrency } from '@/components/aptos-symbol';

export const metadata: Metadata = {
  title: 'Platform Terms',
  description: `Terms governing access to and use of ${brand.name}.`,
};

export default function TermsPage() {
  return <article className="policy-page legal-page">
    <span className="eyebrow">LEGAL · PUBLIC BETA</span>
    <h1>Platform Terms</h1>
    <p className="legal-updated">Last updated October 14, 2026</p>
    <p>These Platform Terms (“Terms”) govern your access to and use of {brand.name}, including its launchpad, marketplace, websites, smart-contract interfaces, and related services (the “Platform”), operated by NICO Studio (“we,” “us,” or “our”). By accessing or using the Platform, you agree to these Terms. If you do not agree, do not use the Platform.</p>

    <h2>Eligibility</h2>
    <p>You must be at least 18 years old and legally capable of entering into these Terms. You may not use the Platform if doing so would violate a law, sanction, court order, contractual restriction, or other obligation applicable to you. You are responsible for determining whether your use is lawful in your location.</p>

    <h2>Public beta</h2>
    <p>{brand.name} currently runs on Aptos {network}. Testnet assets and test <AptosCurrency /> have no real-world value. Beta software may contain errors, interruptions, incomplete features, or material security vulnerabilities. The contracts have not completed an independent external audit and are not represented as ready for real-value trading.</p>

    <h2>Your wallet and transactions</h2>
    <p>You control and remain responsible for your wallet, private keys, recovery phrase, devices, network selection, and every transaction you approve. We do not custody or recover wallet credentials. Marketplace smart contracts may hold an NFT in escrow while a listing is active, as disclosed in the transaction flow. Blockchain transactions are public and generally irreversible; we cannot cancel, reverse, or restore a transaction after confirmation.</p>

    <h2>Smart contracts and third-party infrastructure</h2>
    <p>The Platform depends on Aptos, wallet software, nodes, indexers, hosting providers, gateways, and decentralized or third-party storage systems. We do not control their availability, security, fees, rules, or continued support. An interface label or database record is provided for convenience and does not replace the authoritative on-chain state. You should independently review transaction payloads and contract addresses before signing.</p>

    <h2>Collections, content, and creator responsibilities</h2>
    <p>Creators remain responsible for every collection, artwork, name, description, link, metadata file, royalty setting, claim, and other material they submit or cause to be published. By submitting content, you represent that you have all rights and permissions necessary to use it and to authorize the Platform to host, cache, index, display, reproduce, and link to it for operating and promoting the collection and Platform.</p>
    <p>You must clearly disclose material collection terms and must not publish content that is unlawful, fraudulent, deceptive, infringing, malicious, or designed to manipulate users. Launch review, a verification mark, inclusion in a curated cohort, or visibility on {brand.name} is not an endorsement, guarantee of identity, promise of value, or certification that content is lawful.</p>

    <h2>Ownership and licenses</h2>
    <p>Purchasing or minting an NFT does not automatically transfer copyright, trademark rights, commercial rights, or other intellectual-property rights in the associated media. Those rights depend on terms provided by the relevant creator or rights holder. The Platform, its branding, interface, and original software and content remain protected by applicable intellectual-property laws and may not be copied or exploited except as expressly permitted.</p>

    <h2>Fees, royalties, and taxes</h2>
    <p>Applicable prices, platform fees, creator royalties, storage reimbursements, and estimated network costs are displayed before wallet approval where the protocol and available data permit. Network fees may change, and wallet or infrastructure providers may charge separate fees. You are solely responsible for taxes, reporting, withholding, and other obligations arising from your activity. Creator royalties may be enforced by a particular marketplace flow but may not be enforceable across all transfers or third-party platforms.</p>

    <h2>Digital-asset risks</h2>
    <p>NFTs and cryptocurrencies may be volatile, illiquid, technically unsupported, duplicated, incorrectly attributed, or subject to third-party claims. Metadata and media can change, disappear, or become inaccessible. Smart contracts, wallets, bridges, token standards, and marketplaces can contain defects or be exploited. You accept these risks and should not transact with assets you cannot afford to lose. {brand.name} does not provide financial, investment, legal, or tax advice and does not guarantee value, authenticity, provenance, liquidity, or future availability.</p>

    <h2>Acceptable use</h2>
    <p>You may not use the Platform to violate law or another person’s rights; evade sanctions or restrictions; launder proceeds; manipulate markets or platform metrics; impersonate others; distribute malware; scrape or overload the service in a harmful manner; probe or exploit vulnerabilities without authorization; bypass access controls or safety checks; interfere with another user; or misrepresent a collection, transaction, affiliation, or expected return.</p>

    <h2>Moderation and access</h2>
    <p>We may refuse a launch, hide or label content, restrict interface access, delist an item from discovery, or suspend a feature when reasonably necessary for safety, legal compliance, intellectual-property claims, technical integrity, or enforcement of these Terms. Interface moderation does not remove an asset or transaction from Aptos or from third-party storage, and it may not prevent direct interaction with an on-chain contract.</p>

    <h2>Feedback and security reports</h2>
    <p>If you provide product feedback, you permit us to use it without restriction or compensation. Security research must follow the project’s published security-reporting instructions. Do not disclose an exploitable vulnerability publicly before we have had a reasonable opportunity to investigate and remediate it.</p>

    <h2>Availability and changes</h2>
    <p>We may change, pause, restrict, or discontinue any part of the Platform, including supported networks, collections, fees, or features. We do not promise continuous availability or continued support for any asset. We may update these Terms by posting a revised version and date. Your continued use after an update constitutes acceptance of the revised Terms.</p>

    <h2>Disclaimers</h2>
    <p>To the maximum extent permitted by law, the Platform is provided “as is” and “as available,” without warranties of any kind, whether express, implied, or statutory, including warranties of title, non-infringement, merchantability, fitness for a particular purpose, security, accuracy, availability, or uninterrupted operation. We do not warrant that smart contracts or third-party content are free from defects or that a transaction will achieve your intended result.</p>

    <h2>Limitation of liability</h2>
    <p>To the maximum extent permitted by law, NICO Studio and its contributors will not be liable for indirect, incidental, special, exemplary, punitive, or consequential damages; loss of profits, revenue, data, goodwill, tokens, NFTs, or other assets; or damages arising from wallet compromise, user error, smart-contract behavior, network events, third-party services, unauthorized access, or unavailable metadata. Nothing in these Terms excludes liability that cannot lawfully be excluded.</p>

    <h2>Indemnity</h2>
    <p>To the extent permitted by law, you agree to defend, indemnify, and hold harmless NICO Studio and its contributors from claims, liabilities, damages, losses, and reasonable costs arising from your content, collections, use of the Platform, violation of these Terms, or infringement of another person’s rights.</p>

    <h2>General terms</h2>
    <p>If a provision is unenforceable, the remaining provisions will remain in effect. A failure to enforce a provision is not a waiver. You may not transfer your rights under these Terms without our consent; we may transfer these Terms as part of a reorganization or transfer of the Platform. These Terms, together with the Privacy Policy and any launch-specific terms shown before a transaction, form the agreement governing your use of the Platform.</p>

    <h2>Contact</h2>
    <p>Questions about these Terms can be sent through the official NICO Studio contact channel published at <a href="https://nicolab.studio/" target="_blank" rel="noreferrer">nicolab.studio</a>. Never send private keys, seed phrases, or wallet recovery credentials.</p>
  </article>;
}
