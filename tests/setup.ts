import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement structuredClone in older Node/jsdom combos.
if (typeof structuredClone === 'undefined') {
  // @ts-expect-error - polyfill
  global.structuredClone = (obj: unknown) => JSON.parse(JSON.stringify(obj));
}

// jsdom has no IndexedDB implementation; component tests that touch photo
// storage mock lib/photoStore directly instead of relying on a global here.
