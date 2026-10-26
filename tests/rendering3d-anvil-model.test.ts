import { expect, it } from 'vitest';
import { unitModelId } from '../src/rendering/three-mode/unit-model';
it('loads the component anvil by its own 14.24 character manifest key instead of excluding all anvils', () => {
  expect(unitModelId('TFT_ArmoryKeyComponent', true)).toBe('TFT_ArmoryKeyComponent');
  expect(unitModelId('TFT_ArmoryKeyCompleted', true)).toBe('TFT_ArmoryKeyCompleted');
  expect(unitModelId('TFT_ArmoryKeyOrnn', true)).toBeNull();
  expect(unitModelId('maddie', false)).toBe('maddie');
});
