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

function DiscordIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.079.037c-.211.375-.445.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.08.08 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37 19.72 19.72 0 0 0 .11 18.582a19.9 19.9 0 0 0 6.085 3.072.15.15 0 0 0 .187-.074c.469-.641.885-1.32 1.248-2.031a.15.15 0 0 0-.082-.211 13.17 13.17 0 0 1-1.872-.892.15.15 0 0 1-.015-.254c.126-.095.252-.195.371-.295a.15.15 0 0 1 .155-.021c3.927 1.793 8.18 1.793 12.061 0a.15.15 0 0 1 .153.019c.12.098.245.2.373.294a.15.15 0 0 1-.013.254 12.3 12.3 0 0 1-1.873.892.15.15 0 0 0-.08.212c.372.71.788 1.388 1.246 2.03a.15.15 0 0 0 .187.074 19.84 19.84 0 0 0 6.086-3.072A19.49 19.49 0 0 0 20.317 4.37ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419s.955-2.418 2.157-2.418c1.21 0 2.176 1.095 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419s.955-2.418 2.157-2.418c1.21 0 2.176 1.095 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" /></svg>;
}

function XIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" /></svg>;
}

export function FooterSocialLinks() {
  return <nav className="site-footer-socials" aria-label="Social media">
    <a className="site-footer-social" href="https://discord.gg/PxpzHEAzp3" target="_blank" rel="noreferrer" aria-label="Join VEYTOS on Discord" title="Discord"><DiscordIcon /></a>
    <a className="site-footer-social" href="https://x.com/nico_studio_" target="_blank" rel="noreferrer" aria-label="Follow Nico Studio on X" title="X"><XIcon /></a>
  </nav>;
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
        <FooterSocialLinks />
      </div>
    </div>
  </footer>;
}
