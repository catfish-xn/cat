declare const assert: {
  (value: unknown, message?: string): asserts value;
  equal(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
};
export = assert;
