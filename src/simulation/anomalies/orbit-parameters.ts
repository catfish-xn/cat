import { freezeContent } from '../content/freeze';
/** 项目约定：raw exposes missile -1.95rad/s and width50, but not Lua radius/re-hit rules.
 * Official14.24 says significantly faster. The discrete32tick revolution is deliberately
 * faster than the extracted missile's ~64.4tick revolution; it is not claimed as native Lua. */
export const ORBIT_PARAMETERS = freezeContent({
  classification: '项目约定',
  rawAngularVelocityMilliRadiansPerSecond: -1950,
  rawMissileWidth: 50,
  phaseSteps: 96,
  phaseStepsPerTick: -3,
  revolutionTicks: 32,
  initialRadiusMilliHexes: 1000,
  maxRadiusMilliHexes: 10000,
  radiusChangeMilliHexesPerTick: 250,
  hitRadiusMilliHexes: 500,
  sweepStepMilliHexes: 250,
  sameStarTargetHitIntervalTicks: 4,
});
