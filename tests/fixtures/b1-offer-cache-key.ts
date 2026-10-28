// Pure metadata shared with route fixtures that also run outside Vitest.
let currentPriorities: readonly string[] = [];
/** Route caches must not publish scripted states as naturally drawn fixtures. */
export const b1OfferCacheKey = (): readonly string[] => currentPriorities;
export function setB1OfferCacheKey(priorities: readonly string[]): void {
  currentPriorities = Object.freeze([...priorities]);
}
