import { expect, test } from '@playwright/test';
import { LayoutName, PlaywrightDevPage } from '../utilities';

test('histogram widget follows the image channel', async ({ page }) => {
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
            };
        });
    await expect
        .poll(histogram)
        .toMatchObject({ channel: 0, binCount: 16, count: 255 });
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
