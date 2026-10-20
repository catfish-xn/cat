// Offline conversion budgets, shared by source decoding and GLB sampling.
export const MAX_ANIMATION_FRAMES = 18_000;
export const MAX_ACCESSOR_ELEMENTS = 1_000_000; // Scalar components, including vectors/matrices.
export const MAX_ANIMATION_ELEMENTS = 4_000_000; // Scalar components in one decoded/sampled clip.

export function assertAnimationElements(elements) {
    if (!Number.isSafeInteger(elements) || elements < 0 || elements > MAX_ANIMATION_ELEMENTS)
        throw new Error('animation-elements-budget');
}

export function assertAnimationBudget(frames, componentsPerFrame) {
    if (!Number.isSafeInteger(frames) || frames < 1 || frames > MAX_ANIMATION_FRAMES)
        throw new Error('animation-frame-budget');
    assertAnimationElements(frames * componentsPerFrame);
}
