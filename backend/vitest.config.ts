import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // better-sqlite3 est un module natif : les workers « threads » de vitest
    // plantent au chargement sur Windows, on passe par des processus fils.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }
  }
});
