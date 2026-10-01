import { defineConfig, devices } from '@playwright/test';

const cartaPort = Number.parseInt(process.env.CARTA_PORT ?? '3102', 10);
if (!Number.isInteger(cartaPort) || cartaPort < 1 || cartaPort > 65535) {
    throw new Error(`Invalid CARTA_PORT: ${process.env.CARTA_PORT}`);
}
const cartaUrl = `http://localhost:${cartaPort}`;
const backendCommand = (port: number) =>
    `/Users/kchou/bz/carta_build/carta-backend-dev1/build/carta_backend /Users/kchou/bz/carta_build/e2e-lite/test_data --top_level_folder /Users/kchou/bz --frontend_folder /Users/kchou/bz/carta_build/carta-frontend-dev2/build --no_browser --port ${port} --debug_no_auth --omp_threads 8`;
const backendServer = (url: string, port: number) => ({
    command: backendCommand(port),
    url: `${url}/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
});

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
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: 2,
    /* Limit concurrent WebGL contexts while allowing independent tests to overlap. */
    workers: 8,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('')`. */
        baseURL: cartaUrl,
        viewport: { width: 1920, height: 1080 },

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
    },

    /* Run Moment Map after the other specs, alone on the shared backend. */
    projects: [
        {
            name: 'test-group1',
            testMatch: ['**/Animator.spec.ts', '**/Catalog.spec.ts', '**/ChannelMap.spec.ts', '**/Contours.spec.ts', '**/CursorInfo.spec.ts', '**/Histogram.spec.ts'],
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
            },
        },
        {
            name: 'test-group2',
            testMatch: ['**/ImageFitting.spec.ts', '**/ImageLayer.spec.ts', '**/ImageViewer.spec.ts', '**/Layout.spec.ts', '**/LoadingFiles.spec.ts', '**/OnlineDataQuery.spec.ts'],
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
            },
        },
        {
            name: 'test-group3',
            testMatch: ['**/Profilers.spec.ts', '**/PVImage.spec.ts', '**/Regions.spec.ts', '**/Snippets.spec.ts', '**/Statistics.spec.ts', '**/Stokes.spec.ts', '**/TimeSeries.spec.ts', 'VectorOverlay.spec.ts'],
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
            },
        },
        {
            name: 'moment-map',
            testMatch: '**/MomentMap.spec.ts',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
            },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: backendServer(cartaUrl, cartaPort),
});
