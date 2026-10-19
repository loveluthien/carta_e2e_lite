import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { LayoutName, PlaywrightDevPage } from '../utilities';

test('Histogram widget follows the image channel', async ({
    page,
}, testInfo) => {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.loadImage('cube.fits');
    await carta.applyLayout(LayoutName.Default);
    await carta.selectMenuItem('Widgets', 'Histogram Widget');

    const widget = page.locator('.histogram-widget');
    const plot = widget.locator('.histogram-plot');
    await expect(plot).toBeVisible();

    const histogram = () =>
        page.evaluate(() => {
            const app = (window as any).app;
            const frame = app.activeFrame;
            const data = app.regionHistograms
                .get(frame.frameInfo.fileId)
                ?.get(-1)
                ?.get(frame.requiredStokes)?.histograms;
            return {
                channel: frame.channel,
                binCount: data?.bins?.length,
                count: data?.bins?.reduce(
                    (sum: number, n: number) => sum + n,
                    0,
                ),
                firstBinCenter: data?.firstBinCenter,
                binWidth: data?.binWidth,
                bins: data?.bins ? Array.from(data.bins) : [],
            };
        });
    const checkBins = async (scale: number) => {
        const data = await histogram();
        expect(data.binWidth).toBeGreaterThan(0);
        const expected = Array<number>(data.binCount).fill(0);
        const lowerEdge = data.firstBinCenter - data.binWidth / 2;
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                if (x === 1 && y === 1) continue;
                const value =
                    (x === 2 ? (scale === 1 ? -2 : 2) : scale) * (1 + y / 16);
                const bin = Math.min(
                    expected.length - 1,
                    Math.floor((value - lowerEdge) / data.binWidth),
                );
                expect(bin).toBeGreaterThanOrEqual(0);
                expected[bin]++;
            }
        }
        expect(data.bins).toEqual(expected);
    };
    await expect
        .poll(histogram)
        .toMatchObject({ channel: 0, binCount: 16, count: 255 });
    await checkBins(1);
    await page.evaluate(() => {
        const frame = (window as any).app.activeFrame;
        frame.setCursorPosition({ x: 8, y: 8 });
        frame.updateCursorRegion({ x: 8, y: 8 });
    });
    await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
        'Velocity: 0.0000 km/s',
    );
    await expect(page.getByTestId('x-profiler-info')).toContainText('Data:');
    const firstProfile = await page
        .getByTestId('x-profiler-info')
        .textContent();
    const firstPlot = await plot.screenshot();

    await page.getByTestId('animator-0-header-title').click();
    await page.getByTestId('animator-last-button').click();
    await expect
        .poll(histogram)
        .toMatchObject({ channel: 4, binCount: 16, count: 255 });
    await expect
        .poll(async () => (await histogram()).firstBinCenter)
        .toBeGreaterThan(0);
    await checkBins(16);
    await testInfo.attach('histogram-last-channel.png', {
        body: await plot.screenshot(),
        contentType: 'image/png',
    });
    expect((await histogram()).firstBinCenter).toBeGreaterThan(0);
    await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
        'Velocity: 4.0000 km/s',
    );
    await expect(page.getByTestId('x-profiler-info')).toContainText('Data:');
    expect(await page.getByTestId('x-profiler-info').textContent()).not.toBe(
        firstProfile,
    );
    expect((await plot.screenshot()).equals(firstPlot)).toBe(false);

    await page.getByTestId('histogram-0-header-settings-button').click();
    const settings = page.locator('.histogram-settings-panel');
    await expect(settings).toBeVisible();
    await settings
        .locator('.bp6-form-group')
        .filter({ hasText: 'Auto pixel bounds' })
        .locator('.bp6-control-indicator')
        .click();
    const min = settings
        .locator('.bp6-form-group')
        .filter({ hasText: 'X min' })
        .getByRole('spinbutton');
    const max = settings
        .locator('.bp6-form-group')
        .filter({ hasText: 'X max' })
        .getByRole('spinbutton');
    const boundsState = () =>
        page.evaluate(() => {
            const store = (window as any).app.widgetsStore.histogramWidgets.get(
                'histogram-0',
            );
            return {
                canGenerate: store.isAbleToGenerate,
                fixedBounds: store.isFixedBounds,
                min: store.minPix,
                max: store.maxPix,
            };
        });
    const validBounds = await boundsState();
    await min.fill(await max.inputValue());
    await min.press('Tab');
    await expect
        .poll(boundsState)
        .toEqual({ ...validBounds, canGenerate: false });

    await max.fill('10');
    await min.fill('2');
    await min.press('Tab');
    await expect
        .poll(boundsState)
        .toEqual({ canGenerate: true, fixedBounds: true, min: 2, max: 10 });
    await expect.poll(histogram).toMatchObject({ channel: 4, count: 16 });
    await settings.getByRole('button', { name: 'Reset config' }).click();
    await expect.poll(histogram).toMatchObject({ channel: 4, count: 255 });
});

async function openRegressionHistogram(page: Page) {
    page.setDefaultTimeout(10_000);
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.setTestPreferences();
    await carta.loadImage('cube.fits');
    await carta.applyLayout(LayoutName.Default);
    await carta.selectMenuItem('Widgets', 'Histogram Widget');
    const plot = page.locator('.histogram-widget .histogram-plot');
    await expect(plot.locator('canvas[role="img"]')).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).app;
                return app.regionHistograms
                    .get(app.activeFrame.frameInfo.fileId)
                    ?.get(-1)
                    ?.get(app.activeFrame.requiredStokes)?.histograms?.bins
                    ?.length;
            }),
        )
        .toBe(16);
    return { carta, plot };
}

async function greenHistogramMarkers(page: Page, png?: string) {
    return page.evaluate(async (png) => {
        let source: HTMLCanvasElement | HTMLImageElement;
        if (png) {
            const image = new Image();
            image.src = `data:image/png;base64,${png}`;
            await image.decode();
            source = image;
        } else {
            source = document.querySelector<HTMLCanvasElement>(
                '.histogram-widget .annotation-stage canvas',
            )!;
        }
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(source, 0, 0);
        const rgba = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
        ).data;
        let left = canvas.width,
            right = -1,
            top = canvas.height,
            bottom = -1,
            count = 0;
        let lineLeft = canvas.width,
            lineRight = -1,
            lineTop = canvas.height,
            lineBottom = -1;
        for (let y = 0; y < canvas.height; y++)
            for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                if (
                    rgba[i + 3] &&
                    rgba[i + 1] - rgba[i] > 10 &&
                    rgba[i + 1] - rgba[i + 2] > 3
                ) {
                    count++;
                    left = Math.min(left, x);
                    right = Math.max(right, x);
                    top = Math.min(top, y);
                    bottom = Math.max(bottom, y);
                    if (
                        rgba[i + 3] > 150 &&
                        rgba[i + 1] - rgba[i] > 30 &&
                        rgba[i + 1] - rgba[i + 2] > 15
                    ) {
                        lineLeft = Math.min(lineLeft, x);
                        lineRight = Math.max(lineRight, x);
                        lineTop = Math.min(lineTop, y);
                        lineBottom = Math.max(lineBottom, y);
                    }
                }
            }
        return {
            count,
            left,
            right,
            top,
            bottom,
            lineLeft,
            lineRight,
            lineTop,
            lineBottom,
        };
    }, png);
}

test('Histogram mean/RMS markers render vertically, export, refresh and hide', async ({
    page,
}, testInfo) => {
    test.setTimeout(90_000);
    const { carta, plot } = await openRegressionHistogram(page);
    await expect
        .poll(() => greenHistogramMarkers(page).then((value) => value.count))
        .toBe(0);
    await page.getByTestId('histogram-0-header-settings-button').click();
    await page.getByRole('tab', { name: 'Styling', exact: true }).click();
    const toggle = page
        .locator('.histogram-settings-panel .bp6-form-group')
        .filter({ hasText: 'Show mean/RMS' })
        .getByRole('checkbox');
    await expect(toggle).not.toBeChecked();
    await toggle.check({ force: true });
    await carta.closeWidget('histogram-0-floating-settings');
    await expect(page.locator('.histogram-settings-panel')).toBeHidden();
    await page.mouse.move(0, 0);
    await expect
        .poll(() => greenHistogramMarkers(page).then((value) => value.count))
        .toBeGreaterThan(0);
    const onscreen = await greenHistogramMarkers(page);
    expect(onscreen.right - onscreen.left).toBeGreaterThan(10);
    expect(onscreen.lineBottom - onscreen.lineTop).toBeGreaterThan(20);
    expect(onscreen.lineRight - onscreen.lineLeft).toBeLessThanOrEqual(3);
    await expect(plot).toHaveScreenshot('histogram-mean-rms-visible.png');
    await plot.hover();
    const pending = page.waitForEvent('download');
    await plot
        .locator('.profiler-toolbar a')
        .filter({ has: page.locator('[data-icon="floppy-disk"]') })
        .click();
    const download = await pending;
    const output = testInfo.outputPath('histogram-mean-rms-export.png');
    await download.saveAs(output);
    const exported = await greenHistogramMarkers(
        page,
        (await readFile(output)).toString('base64'),
    );
    for (const key of [
        'left',
        'right',
        'top',
        'bottom',
        'lineLeft',
        'lineRight',
    ] as const) {
        expect(
            Math.abs(exported[key] - onscreen[key]),
            key,
        ).toBeLessThanOrEqual(3);
    }
    // Excluding the mean and its entire RMS band must also exclude them from PNG.
    await page.evaluate(() =>
        (window as any).app.widgetsStore.histogramWidgets
            .get('histogram-0')
            .setXBounds(-4, -3),
    );
    await page.mouse.move(0, 0);
    await expect
        .poll(() => greenHistogramMarkers(page).then((value) => value.count))
        .toBe(0);
    await plot.hover();
    const clippedPending = page.waitForEvent('download');
    await plot
        .locator('.profiler-toolbar a')
        .filter({ has: page.locator('[data-icon="floppy-disk"]') })
        .click();
    const clipped = await clippedPending;
    expect(
        (
            await greenHistogramMarkers(
                page,
                (await readFile((await clipped.path())!)).toString('base64'),
            )
        ).count,
    ).toBe(0);
    await page.evaluate(() =>
        (window as any).app.widgetsStore.histogramWidgets
            .get('histogram-0')
            .clearXYBounds(),
    );
    await page.getByTestId('animator-0-header-title').click();
    await page.getByTestId('animator-last-button').click();
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).app;
                return app.regionHistograms
                    .get(app.activeFrame.frameInfo.fileId)
                    ?.get(-1)
                    ?.get(app.activeFrame.requiredStokes)?.histograms?.mean;
            }),
        )
        .toBeGreaterThan(10);
    await expect
        .poll(() => greenHistogramMarkers(page).then((value) => value.count))
        .toBeGreaterThan(0);
    await page.getByTestId('histogram-0-header-settings-button').click();
    await page.getByRole('tab', { name: 'Styling', exact: true }).click();
    await expect(toggle).toBeChecked();
    await toggle.uncheck({ force: true });
    await carta.closeWidget('histogram-0-floating-settings');
    await expect(page.locator('.histogram-settings-panel')).toBeHidden();
    await page.mouse.move(0, 0);
    await expect
        .poll(() => greenHistogramMarkers(page).then((value) => value.count))
        .toBe(0);
    await expect(plot).toHaveScreenshot('histogram-mean-rms-hidden.png');
    await page.getByTestId('viewer-div').screenshot({
        path: testInfo.outputPath('histogram-marker-channel-viewer.png'),
    });
});

test('Histogram exports zero-centered and single selected bins', async ({
    page,
}, testInfo) => {
    test.setTimeout(60_000);
    const { plot } = await openRegressionHistogram(page);
    await page.evaluate(() => {
        const store = (window as any).app.widgetsStore.histogramWidgets.get(
            'histogram-0',
        );
        store.setAutoBounds(false);
        store.setMinPix(-1);
        store.setMaxPix(31);
        store.setAutoBins(false);
        store.setNumBins(16);
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).app;
                const histogram = app.regionHistograms
                    .get(app.activeFrame.frameInfo.fileId)
                    ?.get(-1)
                    ?.get(app.activeFrame.requiredStokes)?.histograms;
                return {
                    center: histogram?.firstBinCenter,
                    width: histogram?.binWidth,
                    bins: histogram?.bins?.length,
                };
            }),
        )
        .toEqual({ center: 0, width: 2, bins: 16 });
    const exportRows = async () => {
        await plot.hover();
        const pending = page.waitForEvent('download');
        await plot
            .locator('.profiler-toolbar a')
            .filter({ has: page.locator('[data-icon="th"]') })
            .click();
        const download = await pending;
        return (await readFile((await download.path())!, 'utf8'))
            .trim()
            .split('\n')
            .filter((line) => !line.startsWith('#'))
            .map((line) => line.split('\t').map(Number));
    };
    const rows = await exportRows();
    expect(rows).toHaveLength(16);
    expect(rows[0][0]).toBe(0);
    expect(rows[0][1]).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row[0])).size).toBe(16);
    await page.mouse.move(0, 0);
    await expect(plot).toHaveScreenshot('histogram-zero-first-bin.png');
    await page.evaluate(() =>
        (window as any).app.widgetsStore.histogramWidgets
            .get('histogram-0')
            .setXBounds(0, 0),
    );
    expect(await exportRows()).toEqual([rows[0]]);
    await page.mouse.move(0, 0);
    await plot.screenshot({
        path: testInfo.outputPath('histogram-single-selected-bin.png'),
    });
    await page.getByTestId('viewer-div').screenshot({
        path: testInfo.outputPath('histogram-zero-bin-viewer.png'),
    });
});
