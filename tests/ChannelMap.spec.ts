import { test, expect, type Locator, type Page } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const widget = (page: Page) => page.locator('.channel-map-control-containers');
const field = (page: Page, label: string) =>
    widget(page).locator('.bp6-form-group').filter({ hasText: label });
const labels = (page: Page) => page.locator('.channel-map-label-span');
const startChannel = (page: Page) =>
    widget(page).getByRole('spinbutton', { name: 'Start channel' });
const spinButtons = (page: Page, label: string) =>
    field(page, label).locator('.bp6-button-group.bp6-vertical button');

async function setNumber(input: Locator, value: number) {
    await input.fill(String(value));
    await input.press('Enter');
    await input.press('Tab');
}

async function toggle(page: Page, label: string) {
    await field(page, label).locator('.bp6-control-indicator').first().click();
}

async function openMap(page: Page) {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.loadImage('cube.fits');
    await carta.selectMenuItem('Widgets', 'Channel Map Control');
    await toggle(page, 'Enable channel map mode');
    await expect(labels(page)).toHaveCount(4);
    return carta;
}

test.describe('Channel Map Widget', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10000));

    test('Shows an empty state without an image', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();
        await carta.selectMenuItem('Widgets', 'Channel Map Control');

        await expect(widget(page)).toContainText('No file loaded');
        await expect(
            page.getByTestId('channel-map-control-0-header-title'),
        ).toBeVisible();
    });

    test('Navigates channels and pages, resizes the grid, and rejects invalid input', async ({
        page,
    }) => {
        const carta = await openMap(page);
        await toggle(page, 'Show channel string');
        const columns = widget(page).getByRole('spinbutton', {
            name: 'Number of columns',
        });
        const rows = widget(page).getByRole('spinbutton', {
            name: 'Number of rows',
        });
        await expect(columns).toHaveValue('2');
        await expect(rows).toHaveValue('2');
        await setNumber(rows, 1);
        await expect(labels(page)).toHaveText(['0', '1']);
        await spinButtons(page, 'Number of rows').first().click();
        await expect(labels(page)).toHaveText(['0', '1', '2', '3']);
        await spinButtons(page, 'Number of rows').last().click();
        await expect(labels(page)).toHaveText(['0', '1']);

        const buttons = widget(page).locator(
            '.channel-map-channel-control-buttons button',
        );
        await expect(buttons).toHaveCount(4);
        await buttons.nth(0).click(); // previous page at the lower bound
        await expect(startChannel(page)).toHaveValue('0');
        await buttons.nth(1).click(); // previous channel at the lower bound
        await expect(startChannel(page)).toHaveValue('0');
        await buttons.nth(2).click();
        await expect(labels(page)).toHaveText(['1', '2']);
        await buttons.nth(3).click();
        await expect(labels(page)).toHaveText(['3', '4']);
        await buttons.nth(2).click();
        await expect(labels(page)).toHaveText(['4']);
        await buttons.nth(3).click(); // no channel beyond the cube
        await expect(startChannel(page)).toHaveValue('4');
        await buttons.nth(1).click();
        await buttons.nth(0).click();
        await expect(labels(page)).toHaveText(['1', '2']);

        await setNumber(startChannel(page), 99);
        await expect(labels(page)).toHaveText(['1', '2']);
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.channelMapStore.startChannel,
                ),
            )
            .toBe(1);
        await setNumber(startChannel(page), 0);
        await spinButtons(page, 'Start channel').first().click();
        await expect(labels(page)).toHaveText(['1', '2']);
        await spinButtons(page, 'Start channel').last().click();
        await expect(labels(page)).toHaveText(['0', '1']);
        const slider = field(page, 'Start channel').getByRole('slider');
        await slider.focus();
        await slider.press('Home');
        await slider.press('ArrowRight');
        await slider.press('ArrowRight');
        await expect(labels(page)).toHaveText(['2', '3']);
        await slider.press('ArrowLeft');
        await slider.press('ArrowLeft');
        await expect(startChannel(page)).toHaveValue('0');
        await setNumber(columns, 1);
        await expect(labels(page)).toHaveText(['0']);
        await spinButtons(page, 'Number of columns').first().click();
        await expect(labels(page)).toHaveText(['0', '1']);
        await spinButtons(page, 'Number of columns').last().click();
        await expect(labels(page)).toHaveText(['0']);
        await carta.closeWidget('channel-map-control');
        await page.mouse.move(0, 0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'ChannelMap-Navigation.png',
        );
    });

    test('Renders label styling and keeps the selected channel in the spectral profile', async ({
        page,
    }) => {
        const carta = await openMap(page);
        await page.evaluate(async () => {
            await (window as any).app.activeFrame.regionSet.addRegionAsync(0, [
                { x: 8, y: 8 },
            ]);
        });
        await expect(startChannel(page)).toHaveValue('0');
        await toggle(page, 'Show channel string');
        await toggle(page, 'Show frequency string');
        await toggle(page, 'Show velocity string');
        await setNumber(startChannel(page), 1);
        await expect(labels(page)).toHaveCount(4);
        await expect(labels(page).first()).toContainText('1');
        await expect(labels(page).first()).toContainText('MHz');
        await expect(labels(page).first()).toContainText('km/s');

        await field(page, 'Show frequency string')
            .getByText('Show unit')
            .click();
        await field(page, 'Show velocity string')
            .getByText('Show unit')
            .click();
        await expect(labels(page).first()).not.toContainText('MHz');
        await expect(labels(page).first()).not.toContainText('km/s');

        await setNumber(
            widget(page).getByRole('spinbutton', { name: 'Font size' }),
            18,
        );
        await expect(labels(page).first()).toHaveCSS('font-size', '18px');
        await spinButtons(page, 'Font').first().click();
        await expect(labels(page).first()).toHaveCSS('font-size', '19px');
        await spinButtons(page, 'Font').last().click();
        await expect(labels(page).first()).toHaveCSS('font-size', '18px');
        await field(page, 'Font').locator('button').first().click();
        await page.locator('.fontselect [role="menuitem"]').nth(1).click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.channelMapStore.font),
            )
            .toBe(1);
        await toggle(page, 'Custom color');
        await expect(field(page, 'Color').last()).toBeVisible();
        await field(page, 'Color').last().locator('button.colorselect').click();
        await page.locator('.colorselect [role="menuitem"]').nth(1).click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.channelMapStore.color),
            )
            .not.toBe('auto-light_gray');
        await field(page, 'Color').last().locator('button.colorselect').click();
        await page.locator('.colorselect .custom-color button').click();
        await expect(page.locator('.color-picker-popup')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(labels(page).first()).toHaveCSS(
            'border-color',
            'rgb(255, 0, 0)',
        );

        await carta.closeWidget('channel-map-control');
        await page.mouse.move(0, 0);
        const rgb = await page
            .locator('#raster-canvas')
            .first()
            .evaluate((source: HTMLCanvasElement) => {
                const copy = document.createElement('canvas');
                copy.width = source.width;
                copy.height = source.height;
                const context = copy.getContext('2d')!;
                context.drawImage(source, 0, 0);
                return [0.25, 0.75].map((x) =>
                    Array.from(
                        context.getImageData(
                            Math.floor(copy.width * x),
                            Math.floor(copy.height * 0.25),
                            1,
                            1,
                        ).data,
                    ),
                );
            });
        for (const [sample, ranges] of [
            [
                rgb[0],
                [
                    [225, 255],
                    [150, 200],
                    [0, 60],
                    [255, 255],
                ],
            ],
            [
                rgb[1],
                [
                    [225, 255],
                    [220, 255],
                    [120, 190],
                    [255, 255],
                ],
            ],
        ] as const) {
            sample.forEach((value, channel) => {
                expect(value).toBeGreaterThanOrEqual(ranges[channel][0]);
                expect(value).toBeLessThanOrEqual(ranges[channel][1]);
            });
        }
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'ChannelMap-Configured.png',
        );

        await labels(page).nth(2).click({ force: true });
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame.channel),
            )
            .toBe(3);
        await expect(labels(page).nth(2)).toHaveCSS(
            'border-color',
            'rgb(255, 0, 0)',
        );
        await page.locator('#SpectralProfilerButton').click();
        await page
            .getByTestId('spectral-profiler-0-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await page.keyboard.press('Escape');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (window as any).app;
                    const profile = app.spectralProfiles
                        .get(app.activeFrame.frameInfo.fileId)
                        ?.get(1);
                    return Array.from(profile?.profiles?.values() ?? []).some(
                        (series: any) =>
                            Array.from(series.values()).some(
                                (curve: any) => curve.values?.length === 5,
                            ),
                    );
                }),
            )
            .toBe(true);
        const profile = page.locator(
            '.floating-content > .spectral-profiler-widget .line-plot-component',
        );
        await expect(profile).toBeVisible();
        const values = await page.evaluate(() => {
            const app = (window as any).app;
            const profile = app.spectralProfiles
                .get(app.activeFrame.frameInfo.fileId)
                ?.get(1);
            return Array.from(profile?.profiles?.values() ?? []).flatMap(
                (series: any) =>
                    Array.from(series.values()).flatMap((curve: any) =>
                        Array.from(curve.values ?? []),
                    ),
            );
        });
        expect(values).toEqual([1.5, 3, 6, 12, 24]);
        await expect(profile).toHaveScreenshot(
            'ChannelMap-SpectralProfile.png',
        );

        await page.getByTestId('image-view-header-channel-map-button').click();
        await expect(labels(page)).toHaveCount(0);
        await carta.closeWidget('spectral-profiler');
        await page.mouse.move(0, 0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'ChannelMap-Disabled.png',
        );
    });

    test('Switches the displayed image and handles a single-channel cube', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        await carta.loadImage('single.fits', true);
        await carta.selectMenuItem('Widgets', 'Channel Map Control');
        await toggle(page, 'Enable channel map mode');
        const image = widget(page).getByTestId('image-dropdown');
        await expect(image.locator('option')).toHaveCount(2);
        await image.selectOption({ label: '0: cube.fits' });
        await expect(labels(page)).toHaveCount(4);
        await image.selectOption({ label: '1: single.fits' });
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'single.fits',
        );
        await expect(labels(page)).toHaveCount(0);
        await expect(
            field(page, 'Start channel').getByRole('slider'),
        ).toBeDisabled();
        await expect(startChannel(page)).toHaveValue('0');
        await setNumber(startChannel(page), 99);
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.channelMapStore.startChannel,
                ),
            )
            .toBe(0);
        await setNumber(startChannel(page), 0);
        await image.selectOption({ label: '0: cube.fits' });
        await expect(labels(page)).toHaveCount(4);
        await carta.closeWidget('channel-map-control');
        await page.locator('.root-menu').hover();
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'ChannelMap-SourceRestored.png',
        );
    });
});
