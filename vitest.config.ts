import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
    // Redirects DSH_HOME to a throwaway dir so tests can never write the developer's
    // real ~/.dsh (see the incident note in tests/setup-isolation.ts).
    setupFiles: ['tests/setup-isolation.ts'],
  },
})
