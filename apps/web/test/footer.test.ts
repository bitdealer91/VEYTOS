import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AptosCurrency } from '../src/components/aptos-symbol';
import { FooterSocialLinks, formatAptPrice } from '../src/components/footer';

test('formats APT prices with useful precision', () => {
  expect(formatAptPrice(3.456)).toBe('$3.46');
  expect(formatAptPrice(0.45678)).toBe('$0.4568');
  expect(formatAptPrice(124.4)).toBe('$124');
});

test('keeps the APT ticker readable while the supplied mark stays decorative', () => {
  const view = render(createElement(AptosCurrency));
  expect(screen.getByText('APT')).toBeTruthy();
  expect(view.container.querySelector('.aptos-symbol')?.getAttribute('aria-hidden')).toBe('true');
});

test('footer social icons use the published Discord and X destinations', () => {
  render(createElement(FooterSocialLinks));
  expect(screen.getByRole('link', { name: 'Join VEYTOS on Discord' }).getAttribute('href')).toBe('https://discord.gg/PxpzHEAzp3');
  expect(screen.getByRole('link', { name: 'Follow Nico Studio on X' }).getAttribute('href')).toBe('https://x.com/nico_studio_');
  expect(screen.queryByText('Soon')).toBeNull();
});
