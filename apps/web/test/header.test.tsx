import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/explore' }));
vi.mock('@/components/wallet', () => ({ WalletButton: () => <button>Connect wallet</button> }));

import { AppHeader } from '../src/components/header';

test('primary navigation stays focused on Launchpad and Marketplace', () => {
  render(<AppHeader />);
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
  expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual(['Launchpad', 'Marketplace']);
  expect(within(navigation).queryByText('Activity')).toBeNull();
  expect(within(navigation).queryByText('Profile')).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Search collections' })).toBeTruthy();
});
