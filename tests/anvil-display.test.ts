import { afterEach, expect, it, vi } from 'vitest';
import { anvilIconUrl, armorySecondsLeft, forgetServerNow, isAnvilArmory, noteServerNow } from '../src/presentation/anvil-display';
import { isShopChoice } from '../src/presentation/choice-fallback';
afterEach(() => { forgetServerNow(); vi.restoreAllMocks(); });
it.each(['Component', 'Completed'])('keeps the %s anvil own icon and shop-row identity', kind => {
  const id = `TFT_ArmoryKey${kind}`;
  expect(anvilIconUrl(id)).toContain(`${id.toLowerCase()}.png`);
  const choice = { kind: 'forge', payload: { source: 'anvil-unit' } };
  expect(isAnvilArmory(choice)).toBe(true); expect(isShopChoice(choice)).toBe(true);
  expect(anvilIconUrl('maddie')).toBeNull();
});
it('reads the server deadline for exactly this choice generation, including resume, without selecting locally', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
  noteServerNow(10000);
  const state = { pendingChoice: { choiceId: 'anvil', generation: 2 }, choiceDeadline: { choiceId: 'anvil', generation: 2, endsAt: 40000 } };
  expect(armorySecondsLeft(state)).toBe(30);
  now.mockReturnValue(11500); expect(armorySecondsLeft(state)).toBe(20);
  expect(armorySecondsLeft({ ...state, pendingChoice: { choiceId: 'anvil', generation: 1 } })).toBeNull();
  expect(armorySecondsLeft({ ...state, pendingChoice: null })).toBeNull();
  noteServerNow(20500); expect(armorySecondsLeft(state)).toBe(20);
  now.mockReturnValue(50000); expect(armorySecondsLeft(state)).toBe(0);
  forgetServerNow(); expect(armorySecondsLeft(state)).toBeNull();
});
it('accepts each own portrait from the optional configured root without borrowing a different anvil', async () => {
  vi.resetModules();
  const { registerRootUiAssets } = await import('../src/presentation/s13-assets');
  const { anvilIconUrl } = await import('../src/presentation/anvil-display');
  registerRootUiAssets('https://assets.example.test/', { assets: ['Component', 'Completed'].map(kind => ({ kind: 'champion', id: `TFT_ArmoryKey${kind}`, path: `ui/${kind}.png` })) });
  expect(anvilIconUrl('TFT_ArmoryKeyComponent')).toBe('https://assets.example.test/ui/Component.png');
  expect(anvilIconUrl('TFT_ArmoryKeyCompleted')).toBe('https://assets.example.test/ui/Completed.png');
  vi.resetModules();
});
