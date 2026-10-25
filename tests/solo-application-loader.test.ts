import { expect, it, vi } from 'vitest';
import type { MatchSession } from '../src/rendering/match-session';
import type { MatchApplication } from '../src/m6/application';

it('keeps solo application unloaded until requested and waits before allowing construction', async () => {
  const constructed = vi.fn();
  let finish!: () => void;
  const ready = new Promise<void>(resolve => { finish = resolve; });
  const imported = vi.fn();
  vi.doMock('../src/m6/application', async () => {
    imported();
    await ready;
    return { MatchApplication: class { constructor(...args: unknown[]) { constructed(...args); } } };
  });
  try {
    const { loadSoloApplication, createSoloApplication } = await import('../src/m6/application-loader');
    const session = {} as MatchSession;
    const hooks = {} as ConstructorParameters<typeof MatchApplication>[1];
    expect(imported).not.toHaveBeenCalled();
    expect(() => createSoloApplication(session, hooks)).toThrow('must be loaded');
    const pending = loadSoloApplication();
    expect(loadSoloApplication()).toBe(pending);
    expect(() => createSoloApplication(session, hooks)).toThrow('must be loaded');
    finish();
    await pending;
    createSoloApplication(session, hooks);
    expect(imported).toHaveBeenCalledTimes(1);
    expect(constructed).toHaveBeenCalledExactlyOnceWith(session, hooks);
  } finally { vi.doUnmock('../src/m6/application'); }
});
