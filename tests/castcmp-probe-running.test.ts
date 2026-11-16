import { describe, expect, it } from 'vitest';
import { installProbes } from '../dev/castcmp/probes';

// The running-systems probe counts the runtime's own running set only: passing sets the runtime builds of the same records
// (new Set(...) calls add) are neither starts nor keep a gone run live (11-14: the play-out branch's slot sets did both).
describe('castcmp running-systems probe', () => {
  it('counts starts and stops on the first set a run record is added to, not on passing sets of the same records', () => {
    const probes = installProbes(() => 0);
    const running = new Set<unknown>();
    const rec = { system: 'fb4ea008', source: 'me', reserved: 1, until: 1, fx: { draws: [] } };
    running.add(rec);
    expect(probes.systems()).toEqual({ live: ['fb4ea008'], started: [{ t: 0, system: 'fb4ea008', source: 'me', action: undefined }] });
    const passing = new Set([rec]); passing.add(rec); passing.delete(rec);
    expect(probes.systems().started).toHaveLength(1);
    expect(probes.systems().live).toEqual(['fb4ea008']);
    running.delete(rec);
    expect(probes.systems().live).toEqual([]);
    expect(new Set([rec]).size).toBe(1);
    expect(probes.systems().live).toEqual([]);
  });
});
