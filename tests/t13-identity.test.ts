import {expect,it} from 'vitest';
import {CONTENT_DIGEST} from '../src/simulation/content';
import {LOOT_REPLAY_DIGEST} from '../src/simulation/loot-freeze';
import {M8_VERSION} from '../src/simulation/m8/version';
import baseline from './t13-content-baseline.json';
import old from './t12-content-baseline.json';
it('T13 binds one combined release and preserves the prior T12 identity as an export-only baseline',()=>{
 expect(CONTENT_DIGEST).toBe(baseline.contentDigest);expect(LOOT_REPLAY_DIGEST).toBe(baseline.lootReplayDigest);
 expect(baseline.previousContentDigest).toBe(old.contentDigest);expect(baseline.previousLootReplayDigest).toBe(old.lootReplayDigest);
 expect(M8_VERSION).toMatchObject({schemaVersion:7,saveFormatVersion:3,replayFormatVersion:3,commandProtocolVersion:3});
 expect(CONTENT_DIGEST).not.toBe(old.contentDigest);expect(LOOT_REPLAY_DIGEST).not.toBe(old.lootReplayDigest);
});
