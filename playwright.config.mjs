import { defineConfig, devices } from '@playwright/test';
import { cartaBackendServer, cartaUrl } from './scripts/carta-backend.mjs';
import { defaultWorkers, testGroups } from './scripts/test-projects.mjs';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Retry failed tests. */
    retries: 3,
    /* Limit concurrent WebGL contexts while allowing independent tests to overlap. */
    workers: defaultWorkers,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        ...devices['Desktop Chrome'],
        /* Base URL to use in actions like `await page.goto('')`. */
        baseURL: cartaUrl,
        viewport: { width: 1920, height: 1080 },

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
    },

    projects: testGroups.map(({ name, testMatch }) => ({
        name,
        testMatch,
    })),

    /* Run your local dev server before starting the tests */
    webServer: process.env.CARTA_EXTERNAL_BACKEND
        ? undefined
        : cartaBackendServer,
});
