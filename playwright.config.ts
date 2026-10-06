import { defineConfig } from '@playwright/test';

// In the cloud sandbox the pre-installed Chromium lives at a fixed path and
// Playwright must not download its own (see CLAUDE.md). Locally CHROMIUM_PATH is unset.
const executablePath = process.env.CHROMIUM_PATH ?? (process.env.CI ? undefined : '/opt/pw-browsers/chromium');

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: {
      executablePath,
      // Software GL so WebGL works in headless containers.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
