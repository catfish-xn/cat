import {expect,it} from 'vitest';
import {ANOMALY_DEFINITIONS,anomalyCandidates} from '../src/simulation/content/anomalies';
it('offers Avarice in both modes after authoritative online live-bank wiring',()=>{
 expect(Object.hasOwn(ANOMALY_DEFINITIONS,'avarice-incarnate')).toBe(true);
 expect(anomalyCandidates(false)).toContain('avarice-incarnate');
 expect(anomalyCandidates(true)).toContain('avarice-incarnate');
 expect(anomalyCandidates(false)).toHaveLength(56);
 expect(anomalyCandidates(true)).toHaveLength(56);
});
