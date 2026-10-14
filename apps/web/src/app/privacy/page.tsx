import type { Metadata } from 'next';
import { brand } from '@veytos/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${brand.name} handles information when you use the platform.`,
};

export default function PrivacyPage() {
  return <article className="policy-page legal-page">
    <span className="eyebrow">LEGAL · PUBLIC BETA</span>
    <h1>Privacy Policy</h1>
    <p className="legal-updated">Last updated October 14, 2026</p>
    <p>This Privacy Policy explains how NICO Studio (“we,” “us,” or “our”) handles information when you visit or use {brand.name}, including its launchpad, marketplace, websites, and related services (the “Platform”).</p>

    <h2>Information we process</h2>
    <p><strong>Public blockchain information.</strong> When you connect a wallet or use the Platform, we may read wallet addresses, asset ownership, collection data, listings, purchases, transaction hashes, and other activity recorded on Aptos. This information is public by design and may be copied, indexed, or retained by anyone. We cannot alter or delete records stored on a public blockchain.</p>
    <p><strong>Information you provide.</strong> If you apply to launch a collection, request support, report an issue, or otherwise contact us, we may process the information you choose to provide, such as your name, contact details, project information, wallet address, and message.</p>
    <p><strong>Product and diagnostic data.</strong> The public beta records a limited vocabulary of events, such as page views and completed product actions, together with page paths, coarse feature properties, receipt time, compact error categories, and technical context. Wallet addresses are not intentionally included in product analytics. Hosting, security, and infrastructure providers may nevertheless process ordinary request information, such as IP address, browser type, device information, and timestamps, in their operational logs.</p>

    <h2>How we use information</h2>
    <p>We use information to provide and secure the Platform; display blockchain and collection activity; recover and verify transaction states; respond to requests; diagnose errors; measure feature performance; prevent fraud, abuse, and security incidents; comply with legal obligations; and improve the launchpad, marketplace, and future creator tools.</p>

    <h2>Wallets and transaction recovery</h2>
    <p>{brand.name} does not receive or store your private keys or recovery phrase. Wallet connections are provided by third-party wallet software. The Platform uses local and session storage to remember interface preferences and to recover pending mint or marketplace transactions. Pending transaction information may include a wallet address, transaction hash, asset identifier, price, quantity, network, and status. It remains in your browser unless the Platform needs to compare it with Aptos or you provide it when requesting support.</p>

    <h2>Cookies and analytics choices</h2>
    <p>The beta does not use advertising cookies. First-party product analytics are disabled when the browser sends a recognized “Do Not Track” signal. You can also clear local browser data or use browser controls to restrict storage, although doing so may interrupt preferences or transaction recovery.</p>

    <h2>How information is shared</h2>
    <p>We may share information with infrastructure and service providers that help us host, secure, monitor, store, index, or operate the Platform; with professional advisers when reasonably necessary; in connection with a reorganization or transfer of the project; or when required to comply with law, protect rights and safety, investigate abuse, or enforce our terms. We do not sell personal information or share it for cross-context behavioral advertising.</p>

    <h2>Third-party services and content</h2>
    <p>The Platform interacts with Aptos nodes and indexers, wallet providers, hosting and storage providers, content-addressed networks such as IPFS or Arweave, and websites linked by creators or collections. These services operate under their own privacy terms. NFT metadata and media may remain publicly available through a blockchain or distributed storage network even if they are no longer displayed by {brand.name}.</p>

    <h2>Retention</h2>
    <p>We retain information only for as long as reasonably necessary for the purposes described above, including security, support, legal, and operational needs. Retention periods vary by data type and provider. Local browser information remains until it expires or you clear it. Public blockchain and distributed-storage records may be permanent and are outside our control.</p>

    <h2>Security</h2>
    <p>We use reasonable technical and organizational safeguards appropriate to the public beta, but no online service, wallet integration, smart contract, or storage system is completely secure. Never send us a private key, seed phrase, password, or other wallet recovery credential.</p>

    <h2>International processing</h2>
    <p>The Platform and its providers may process information in countries other than the one where you live. Those countries may apply different data-protection rules. Where required, we use reasonable measures intended to protect information transferred internationally.</p>

    <h2>Your rights and choices</h2>
    <p>Depending on where you live, you may have rights to request access to, correction of, deletion of, restriction of, or a copy of personal information we control, or to object to certain processing. These rights are subject to legal exceptions and do not extend to public blockchain data we do not control. You may disconnect your wallet, clear browser storage, enable “Do Not Track,” or stop using the Platform at any time.</p>

    <h2>Children</h2>
    <p>The Platform is not directed to children under 18, and we do not knowingly collect personal information from children. If you believe a child has provided information directly to us, contact us so we can review the request.</p>

    <h2>Changes and contact</h2>
    <p>We may update this Policy as the Platform develops. Material revisions will be identified by the date above. Privacy questions or requests can be sent through the official NICO Studio contact channel published at <a href="https://nicolab.studio/" target="_blank" rel="noreferrer">nicolab.studio</a>. Do not include private keys or recovery phrases.</p>
  </article>;
}
