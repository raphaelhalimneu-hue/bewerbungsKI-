import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "../bewerbungski/src/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      // requireAuth reads these at module load; the Supabase client itself is mocked.
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      // parse routes check this at request time; the Anthropic fetch is mocked.
      ANTHROPIC_API_KEY: "test-anthropic-key",
    },
  },
});
