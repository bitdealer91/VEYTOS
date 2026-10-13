import type { Metadata } from 'next';
import { brand } from '@mintos/config';
import { network } from '@/lib/config';
import { AptosCurrency } from '@/components/aptos-symbol';

export const metadata: Metadata = { title: 'Platform Terms' };

export default function TermsPage() {
  return <article className="policy-page legal-page">
    <span className="eyebrow">LEGAL · PUBLIC BETA</span>
    <h1>Platform Terms</h1>
    <p className="legal-updated">Last updated October 13, 2026</p>
    <p>These terms govern access to {brand.name}, an Aptos-native launchpad and fixed-price NFT marketplace operated by Nico Studio. By using the platform, you agree to these terms.</p>

    <h2>Public beta</h2>
    <p>{brand.name} currently runs on Aptos {network}. Testnet assets and test <AptosCurrency /> have no real-world value. The software is provided for evaluation and may contain errors, interruptions, or incomplete features.</p>

    <h2>Your wallet and transactions</h2>
    <p>You remain responsible for your wallet, private keys, recovery phrase, network selection, and every transaction you approve. Blockchain transactions are public and generally cannot be reversed. Review all wallet prompts before signing.</p>

    <h2>Fees and digital assets</h2>
    <p>Applicable platform fees, creator royalties, prices, and network costs are shown before approval where the protocol makes them available. Digital assets may be volatile, illiquid, unsupported, or subject to third-party rights. {brand.name} does not provide financial, investment, tax, or legal advice.</p>

    <h2>Acceptable use</h2>
    <p>Do not use the platform to violate law, infringe intellectual-property rights, mislead other users, interfere with the service, distribute malicious code, or attempt unauthorized access. You must have the rights required for any collection, artwork, metadata, or other content you publish.</p>

    <h2>Availability and changes</h2>
    <p>Nico Studio may change, suspend, or discontinue beta features and may update these terms as the product develops. Continued use after an update means you accept the revised terms.</p>

    <h2>Disclaimer</h2>
    <p>To the extent permitted by law, the platform is provided “as is” and “as available,” without warranties of uninterrupted operation, fitness for a particular purpose, or the value, authenticity, or availability of any digital asset.</p>
  </article>;
}
