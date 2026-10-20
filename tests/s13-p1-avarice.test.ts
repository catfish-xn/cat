import {expect,it} from 'vitest';
import {ANOMALY_DEFINITIONS,anomalyCandidates} from '../src/simulation/content/anomalies';
it('keeps the wired solo Avarice and defers online offers until the server samples live bank gold',()=>{
 expect(Object.hasOwn(ANOMALY_DEFINITIONS,'avarice-incarnate')).toBe(true);
 expect(anomalyCandidates(false)).toContain('avarice-incarnate');
 expect(anomalyCandidates(true)).not.toContain('avarice-incarnate');
 expect(anomalyCandidates(false)).toHaveLength(56);
 expect(anomalyCandidates(true)).toHaveLength(55);
});
