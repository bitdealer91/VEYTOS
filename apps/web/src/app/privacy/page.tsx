import type { Metadata } from 'next';
import { brand } from '@mintos/config';
import { AptosCurrency } from '@/components/aptos-symbol';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return <article className="policy-page legal-page">
    <span className="eyebrow">LEGAL · PUBLIC BETA</span>
    <h1>Privacy Policy</h1>
    <p className="legal-updated">Last updated October 13, 2026</p>
    <p>This policy explains how Nico Studio handles information when you use {brand.name}.</p>

    <h2>Public blockchain data</h2>
    <p>Wallet addresses, asset ownership, listings, purchases, and other Aptos activity are public blockchain data. {brand.name} reads this information from Aptos nodes and indexers to provide marketplace features. Public blockchain records cannot be deleted or changed by Nico Studio.</p>

    <h2>Product and diagnostic data</h2>
    <p>The beta records limited product events such as page views and completed actions, together with page paths and non-identifying feature properties. It also records compact error categories and technical context when the app fails. Wallet addresses are not intentionally included in product analytics.</p>

    <h2>Browser storage</h2>
    <p>{brand.name} uses local and session storage to remember interface preferences and to safely recover pending marketplace or mint transactions. This data stays in your browser unless a feature needs to verify a transaction against Aptos.</p>

    <h2>Third-party services</h2>
    <p>Your wallet provider, Aptos infrastructure, linked websites, and other third-party services apply their own privacy practices. The footer’s <AptosCurrency />/USD quote is requested by the {brand.name} server from CoinGecko and cached for a short period.</p>

    <h2>Your choices</h2>
    <p>You can use a browser “Do Not Track” signal to disable beta product analytics, clear local browser storage, disconnect your wallet, and stop using the platform. Clearing pending transaction data before confirming its on-chain status may make recovery harder.</p>

    <h2>Updates</h2>
    <p>This policy may change as the beta develops. Material revisions will be reflected by the updated date on this page.</p>
  </article>;
}
