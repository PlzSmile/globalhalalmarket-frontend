import { defineConfig } from 'vitest/config';

// Merged into the Angular unit-test builder's own Vitest config.
export default defineConfig({
  test: {
    // The first test in a file compiles its Material components from cold; 5 s (the default) is too tight on a busy machine.
    testTimeout: 15_000,
  },
});
