import { Suspense } from 'react';
import Link from 'next/link';
import { AptosCurrency } from '@/components/aptos-symbol';

const APT_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd';
const APT_MARKET_URL = 'https://www.coingecko.com/en/coins/aptos';

export function formatAptPrice(value: number) {
  const fractionDigits = value >= 100 ? 0 : value >= 1 ? 2 : 4;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

async function AptPrice() {
  let price: number | null = null;
  try {
    const response = await fetch(APT_PRICE_URL, {
      headers: { accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      const payload = await response.json() as { aptos?: { usd?: unknown } };
      if (typeof payload.aptos?.usd === 'number' && Number.isFinite(payload.aptos.usd) && payload.aptos.usd > 0) {
        price = payload.aptos.usd;
      }
    }
  } catch {
    // Market data is non-critical; keep the footer usable when the provider is unavailable.
  }

  return price === null
    ? <span className="site-footer-price" title="Price temporarily unavailable"><AptosCurrency /><strong>—</strong></span>
    : <a className="site-footer-price" href={APT_MARKET_URL} target="_blank" rel="noreferrer" aria-label={`APT price: ${formatAptPrice(price)} in US dollars`} title="APT price · refreshed every 5 minutes"><AptosCurrency /><strong>{formatAptPrice(price)}</strong></a>;
}

function PriceFallback() {
  return <span className="site-footer-price" aria-label="Loading APT price"><AptosCurrency /><strong>—</strong></span>;
}

export function SiteFooter() {
  const currentYear = new Date().getUTCFullYear();
  const copyrightYear = currentYear > 2026 ? `2026–${currentYear}` : '2026';

  return <footer className="site-footer">
    <div className="container site-footer-inner">
      <p className="site-footer-copyright">© {copyrightYear} <a href="https://nicolab.studio/" target="_blank" rel="noreferrer">Nico Studio</a>. All rights reserved.</p>
      <nav className="site-footer-legal" aria-label="Legal">
        <Link href="/terms">Platform Terms</Link>
        <Link href="/privacy">Privacy Policy</Link>
      </nav>
      <div className="site-footer-meta">
        <Suspense fallback={<PriceFallback />}><AptPrice /></Suspense>
        <span className="site-footer-divider" aria-hidden="true" />
        <span className="site-footer-social" aria-label="X — coming soon">X <small>Soon</small></span>
        <span className="site-footer-social" aria-label="Discord — coming soon">Discord <small>Soon</small></span>
      </div>
    </div>
  </footer>;
}
