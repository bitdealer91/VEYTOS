import {expect, test} from 'vitest';
import {render, screen} from '@testing-library/react';
import {VeytosLaunchTag} from '../src/components/ui';

test('uses one concise brand tag without the native implementation label', () => {
  render(<VeytosLaunchTag/>);
  expect(screen.getByText('Launched on VEYTOS')).toBeTruthy();
  expect(screen.queryByText(/native/i)).toBeNull();
});
