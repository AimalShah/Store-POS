import { defineConfig } from '@playwright/test';

// End-to-end tests run the real Electron app (which boots the Express API on
// :8001 and loads the Vite renderer on :5173) and drive the renderer with
// Playwright. The `webServer` block starts Vite; Electron then loads it.
//
// Linux CI needs a virtual display — run via `npm run e2e:linux` (xvfb-run).
// On Windows (the primary target) `npm run e2e` runs natively.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: 'npx vite --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
