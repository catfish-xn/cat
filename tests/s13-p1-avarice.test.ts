import {expect,it} from 'vitest';
import {ANOMALY_DEFINITIONS} from '../src/simulation/content/anomalies';
it('keeps the incomplete live-economy Avarice prototype outside the production choice catalog',()=>{
 expect(Object.hasOwn(ANOMALY_DEFINITIONS,'avarice-incarnate')).toBe(false);
});
