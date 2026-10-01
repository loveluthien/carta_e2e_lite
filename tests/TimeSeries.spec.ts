import { expect, test } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const images = [
    'J0423-0120_2015-05-24.fits',
    'J0423-0120_2020-03-17.fits',
    'J0423-0120_2024-08-13.fits',
];

test('Loads a dated image series and steps through its viewer and profile', async ({
    page,
}) => {
    test.setTimeout(90_000);
    const carta = new PlaywrightDevPage(page);
    await carta.goto();

    const browser = page.getByTestId('file-browser-dialog');
    await browser.locator('.edit-path-button').click();
    const path = browser.getByPlaceholder(
        'Input directory path with respect to the top level folder',
    );
    await path.fill('/carta_build/e2e-lite/test_data/time_series');
    await path.press('Enter');

    await browser.getByText(images[2], { exact: true }).click();
    await expect(
        browser.getByTestId('file-browser-load-as-time-series-button'),
    ).toBeHidden();
    await browser.getByText(images[0], { exact: true }).click({
        modifiers: ['ControlOrMeta'],
    });
    await browser.getByText(images[1], { exact: true }).click({
        modifiers: ['ControlOrMeta'],
    });
    await expect(
        browser.getByTestId('file-browser-load-as-time-series-button'),
    ).toBeEnabled();
    await browser
        .getByTestId('file-browser-load-as-time-series-button')
        .click();
    await expect(browser).toBeHidden();

    const series = () =>
        page.evaluate(() => {
            const app = (window as any).app;
            return {
                files: app.timeSeriesStore.elements.map(
                    (element: any) => element.frame.filename,
                ),
                dates: app.timeSeriesStore.elements.map((element: any) =>
                    element.isoUtc.slice(0, 10),
                ),
                active: app.activeFrame?.filename,
                index: app.timeSeriesStore.currentIndex,
                matched: app.frames.map(
                    (frame: any) => frame.spatialReference?.filename ?? null,
                ),
            };
        });
    await expect.poll(series).toMatchObject({
        files: images,
        dates: ['2015-05-24', '2020-03-17', '2024-08-13'],
        active: images[0],
        index: 0,
        matched: [null, images[2], images[2]],
    });
    await expect(page.getByTestId('animator-time-series-slider')).toBeVisible();
    await expect(page.getByTestId('animator-time-series-mode')).toBeChecked();
    await page.evaluate(() =>
        (window as any).app.widgetsStore.setImageMultiPanelEnabled(false),
    );
    const viewer = page.getByTestId('viewer-div');
    const plot = page.locator('.spatial-profiler-widget .profile-plot').first();
    const image = page
        .locator('.region-stage > .konvajs-content > canvas')
        .first();
    await expect(viewer).toBeVisible();
    await expect(page.getByTestId('image-view-header-title')).toContainText(
        images[0],
    );
    await image.hover({ position: { x: 300, y: 200 } });
    await expect(page.getByTestId('x-profiler-info')).toContainText('Data:');
    const firstProfileInfo = await page
        .getByTestId('x-profiler-info')
        .textContent();
    const firstViewer = await viewer.screenshot();
    const firstPlot = await plot.screenshot();

    await page.getByTestId('animator-next-button').click();
    await expect.poll(series).toMatchObject({ active: images[1], index: 1 });
    await page.getByTestId('animator-last-button').click();
    await expect.poll(series).toMatchObject({ active: images[2], index: 2 });
    await expect(page.getByTestId('image-view-header-title')).toContainText(
        images[2],
    );
    await image.hover({ position: { x: 300, y: 200 } });
    await expect(page.getByTestId('x-profiler-info')).toContainText('Data:');
    expect(await page.getByTestId('x-profiler-info').textContent()).not.toBe(
        firstProfileInfo,
    );
    expect((await viewer.screenshot()).equals(firstViewer)).toBe(false);
    expect((await plot.screenshot()).equals(firstPlot)).toBe(false);
    await page.getByTestId('animator-first-button').click();
    await expect.poll(series).toMatchObject({ active: images[0], index: 0 });
});
