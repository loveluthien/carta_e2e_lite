import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import {
    activate,
    checkMap,
    control,
    generate,
    getFrames,
    LayoutName,
    open,
    pixel,
    PlaywrightDevPage,
    renderedPixelRgb,
} from '../utilities';

// Fault only this page's transport; never stop the shared backend.
async function connectionFault(page: Page) {
    let client: WebSocketRoute;
    let server: WebSocketRoute;
    let blocked = false;
    let holdMoments = false;
    let attempts = 0;
    let resumes = 0;
    let held = 0;
    await page.routeWebSocket(
        (url) => url.port === (process.env.CARTA_PORT ?? '3102'),
        (ws) => {
            attempts++;
            if (blocked) {
                ws.close({ code: 1013, reason: 'Injected unavailable server' });
                return;
            }
            client = ws;
            server = ws.connectToServer();
            ws.onMessage((message) => {
                const event =
                    Buffer.isBuffer(message) && message.length >= 8
                        ? message.readUInt16LE(0)
                        : undefined;
                // CARTA EventType: RESUME_SESSION=47, MOMENT_REQUEST=61.
                if (event === 47) resumes++;
                if (event === 61 && holdMoments) {
                    held++;
                    return;
                }
                server.send(message);
            });
        },
    );
    return {
        disconnect() {
            client.close({ code: 1012, reason: 'Injected connection loss' });
            server.close();
        },
        block(value: boolean) {
            blocked = value;
        },
        holdMoments(value: boolean) {
            holdMoments = value;
        },
        attempts: () => attempts,
        resumes: () => resumes,
        held: () => held,
    };
}

const retryAlert = (page: Page) => page.getByRole('alertdialog');

async function retry(page: Page) {
    await expect(retryAlert(page)).toContainText(
        'disconnected from the server',
    );
    await retryAlert(page)
        .getByRole('button', { name: 'Retry', exact: true })
        .click();
}

async function resumed(page: Page) {
    await expect(retryAlert(page)).toBeHidden();
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).app;
                return (
                    app.backendService.connectionStatus === 2 &&
                    !app.isResumingSession
                );
            }),
        )
        .toBe(true);
}

async function prepareImage(page: Page) {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.resetAllPreferences();
    await carta.loadImage('cube.fits');
    await page.getByTestId('animator-0-header-title').click();
    await page.getByTestId('animator-next-button').click();
    await page.getByTestId('animator-next-button').click();
    await page.evaluate(() => {
        const app = (window as any).app;
        app.preferenceStore.preferences.set('pixelGridVisible', false);
        const config = app.activeFrame.renderConfig;
        config.setColorMap('gray');
        config.setScaling(0);
        config.setCustomScale(1, 2);
    });
    await expect.poll(() => pixel(page, 8, 8, true)).toBeCloseTo(6, 5);
    return carta;
}

async function checkImageAndProfile(page: Page, name: string) {
    for (const widget of [
        'spatial-profiler-0-content',
        'spatial-profiler-1-content',
    ]) {
        await page
            .getByTestId(widget)
            .getByTestId('region-dropdown')
            .selectOption('0');
    }
    await expect.poll(() => pixel(page, 8, 8, true)).toBeCloseTo(6, 5);
    await expect
        .poll(() => renderedPixelRgb(page, 8, 8))
        .toEqual([255, 255, 255, 255]);
    await expect
        .poll(() => renderedPixelRgb(page, 2, 8))
        .toEqual([0, 0, 0, 255]);
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).app;
                const frame = app.activeFrame;
                const profile = app.spatialProfiles.get(
                    `${frame.frameInfo.fileId}-0`,
                );
                return profile?.x === 8 && profile?.y === 8
                    ? Array.from(profile.getProfile('x')?.values ?? [])
                    : [];
            }),
        )
        .toEqual(Array.from({ length: 16 }, (_, x) => (x === 2 ? 0 : 6)));
    await page.mouse.move(0, 0);
    await expect(page.locator('.image-ratio-popup')).toHaveCSS('opacity', '0');
    await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
        `${name}-viewer.png`,
    );
    await expect(
        page.locator('.spatial-profiler-widget .profile-plot').first(),
    ).toHaveScreenshot(`${name}-profile.png`);
}

test.describe('Backend Connection', () => {
    test.setTimeout(90_000);
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10_000));

    test('Retry restores the image, channel, region and profiler without reloading', async ({
        page,
    }) => {
        const fault = await connectionFault(page);
        await prepareImage(page);
        await page.getByTestId('rectangle-region-shortcut-button').click();
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        const box = (await canvas.boundingBox())!;
        await canvas.dragTo(canvas, {
            sourcePosition: { x: box.width * 0.35, y: box.height * 0.35 },
            targetPosition: { x: box.width * 0.65, y: box.height * 0.65 },
        });
        const regions = () =>
            page.evaluate(() =>
                (window as any).app.activeFrame.regionSet.regions
                    .filter((region: any) => region.regionId > 0)
                    .map((region: any) => ({
                        id: region.regionId,
                        points: region.controlPoints,
                        type: region.regionType,
                    })),
            );
        await expect.poll(regions).toHaveLength(1);
        const originalRegions = await regions();
        let navigations = 0;
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) navigations++;
        });
        fault.disconnect();
        await expect(retryAlert(page)).toContainText('temporary images');
        await retry(page);
        await expect.poll(fault.resumes).toBe(1);
        await resumed(page);
        expect(navigations).toBe(0);
        await expect.poll(regions).toEqual(originalRegions);
        // Demand fresh channel data after resume instead of accepting cached pixels.
        await page.getByTestId('animator-next-button').click();
        await expect.poll(() => pixel(page, 8, 8, true)).toBeCloseTo(12, 5);
        await page.getByTestId('animator-previous-button').click();
        await checkImageAndProfile(page, 'resumed-session');
    });

    test('Retry clears interrupted generation and temporary maps and allows a new map', async ({
        page,
    }) => {
        const fault = await connectionFault(page);
        await open(page);
        const [temporary] = await generate(page, ['0']);
        await activate(page, 'cube.fits');
        fault.holdMoments(true);
        await control(page, 'generate-button').click();
        await expect.poll(fault.held).toBe(1);
        const progress = page.getByRole('dialog', {
            name: /Generating moments/,
        });
        await expect(progress).toBeVisible();
        fault.disconnect();
        await retry(page);
        await expect.poll(fault.resumes).toBe(1);
        await resumed(page);
        await expect(progress).toBeHidden();
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([
                { filename: 'cube.fits', requesting: false, moments: [] },
            ]);
        expect(await getFrames(page)).toHaveLength(1);
        expect(
            (await getFrames(page)).some((frame) => frame.id === temporary.id),
        ).toBe(false);
        await expect(control(page, 'generate-button')).toBeEnabled();
        fault.holdMoments(false);
        const [map] = await generate(page, ['0']);
        await checkMap(page, map, '0');
        const carta = new PlaywrightDevPage(page);
        await carta.applyLayout(LayoutName.Default);
        await expect.poll(() => pixel(page, 8, 8, true)).toBeCloseTo(46.5, 3);
        await page.mouse.move(0, 0);
        await expect(page.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'retried-moment-viewer.png',
        );
        await expect(
            page.locator('.spatial-profiler-widget .profile-plot').first(),
        ).toHaveScreenshot('retried-moment-profile.png');
    });

    test('An unavailable server keeps Retry usable and recovers when the connection returns', async ({
        page,
    }) => {
        const fault = await connectionFault(page);
        await prepareImage(page);
        fault.block(true);
        fault.disconnect();
        await retry(page);
        await expect.poll(fault.attempts).toBe(2);
        await expect(retryAlert(page)).toContainText(
            'disconnected from the server',
        );
        await expect(
            retryAlert(page).getByRole('button', {
                name: 'Retry',
                exact: true,
            }),
        ).toBeEnabled();
        expect(fault.resumes()).toBe(0);
        expect(await getFrames(page)).toHaveLength(1);
        fault.block(false);
        await retry(page);
        await expect.poll(fault.resumes).toBe(1);
        await resumed(page);
        await page.getByTestId('animator-next-button').click();
        await expect.poll(() => pixel(page, 8, 8, true)).toBeCloseTo(12, 5);
        await page.getByTestId('animator-previous-button').click();
        await checkImageAndProfile(page, 'failed-retry-recovered');
    });
});
