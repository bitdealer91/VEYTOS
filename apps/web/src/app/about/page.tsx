import type { Metadata } from 'next';
import { AptosCurrency } from '@/components/aptos-symbol';
import { network } from '@/lib/config';

export const metadata: Metadata = {
  title: 'About VEYTOS',
  description: 'VEYTOS is the Aptos-native home for launching, discovering, collecting, and trading NFTs.',
};

export default function AboutPage() {
  return <article className="policy-page">
    <span className="eyebrow">THE HOME OF APTOS NFTs</span>
    <h1>One home for the complete Aptos NFT lifecycle.</h1>
    <p>VEYTOS is an Aptos-native launchpad and marketplace built to reconnect creators, collections, and collectors in one actively maintained product. We bring established Token V1 collections and modern Digital Asset / Token V2 collections into the same experience, while giving new projects a direct path from launch to secondary trading.</p>

    <h2>Why VEYTOS</h2>
    <p>Aptos NFT infrastructure has become fragmented. Creators often need separate tools for contracts, metadata, minting, discovery, and trading, while holders of historical collections can lose access to a marketplace that understands their assets. VEYTOS is rebuilding that lifecycle around Aptos itself—not treating the network as a secondary integration.</p>

    <h2>What makes us different</h2>
    <p>VEYTOS combines a native launchpad, support for both generations of Aptos NFTs, and fixed-price secondary trading. Established collections can return with their history intact, while new collections can launch into the same marketplace where they will continue to be discovered and traded. Our planned no-code Studio will extend this path so creators can prepare, validate, deploy, and publish a collection without assembling separate infrastructure.</p>

    <h2>Built for trust, not shortcuts</h2>
    <p>Ownership, launch terms, prices, fees, royalties, and settlement are verified on Aptos. The VEYTOS database and interface improve discovery but do not authorize custody or trading. Assets that cannot pass the required ownership, provenance, royalty, or withdrawal-safety checks fail closed instead of being presented as safe to trade.</p>

    <h2>Our path forward</h2>
    <p>We are launching the core launchpad and marketplace before the Studio. The first mainnet phase is designed to onboard established Aptos collections and a curated group of founding creator launches, prove demand through real minting and secondary activity, and then expand creator tooling based on observed needs.</p>

    <h2>Public beta</h2>
    <p>This deployment runs on Aptos {network}. Testnet assets and test <AptosCurrency /> have no real-world value. The contracts have passed automated Move tests and real Aptos testnet acceptance, but have not completed an independent external audit. Mainnet release remains subject to security review, remediation, operational controls, and a reviewed deployment process.</p>

    <h2>Fees and supported assets</h2>
    <p>VEYTOS currently applies a 5% primary launchpad fee and a 2% secondary marketplace fee. Creator royalties and applicable Aptos storage costs are shown before wallet approval where the protocol exposes them. Token V1 and Token V2 assets are supported only when their individual configuration passes the platform’s safety checks; an unsupported asset may remain visible without being eligible for trading.</p>

    <h2>Who is building VEYTOS</h2>
    <p>VEYTOS is built by NICO Studio, a two-person, family-run product studio combining product strategy, UX/UI design, motion, and full-stack Web3 engineering. Our team previously delivered an NFT launchpad, quest-gated airdrop mechanics, a lootbox experience, and Somnia Odyssey.</p>
  </article>;
}
