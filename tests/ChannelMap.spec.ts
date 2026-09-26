import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test.describe('Channel Map widget', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10000));

    test('CM-01 shows the empty state without an image', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        await carta.goto();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();
        await carta.selectMenuItem('Widgets', 'Channel Map Control');

        const widget = page.locator('.channel-map-control-containers');
        await expect(widget).toContainText('No file loaded');
        await expect(
            page.getByTestId('channel-map-control-0-header-title'),
        ).toBeVisible();
    });

    test('CM-02 configures, renders, and synchronizes channel selection', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const viewer = page.getByTestId('viewer-div');

        await carta.goto();
        await carta.loadImage('cube.fits');
        await page.getByTestId('point-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 8, y: 8 },
            force: true,
        });
        await page.locator('#SpectralProfilerButton').click();

        await page.getByTestId('image-view-header-channel-map-button').click();
        await carta.selectMenuItem('Widgets', 'Channel Map Control');

        const widget = page.locator('.channel-map-control-containers');
        const field = (label: string) =>
            widget.locator('.bp6-form-group').filter({ hasText: label });
        await expect(
            field('Enable channel map mode').locator('input[type="checkbox"]'),
        ).toBeChecked();
        await expect(
            widget.getByRole('spinbutton', { name: 'Start channel' }),
        ).toHaveValue('0');
        await expect(
            widget.getByRole('spinbutton', { name: 'Channel step' }),
        ).toHaveValue('1');
        await expect(
            widget.getByRole('spinbutton', { name: 'Number of columns' }),
        ).toHaveValue('2');
        await expect(
            widget.getByRole('spinbutton', { name: 'Number of rows' }),
        ).toHaveValue('2');

        await widget
            .getByRole('spinbutton', { name: 'Start channel' })
            .fill('1');
        await widget
            .getByRole('spinbutton', { name: 'Start channel' })
            .press('Enter');
        await field('Show channel string')
            .locator('input[type="checkbox"]')
            .locator('..')
            .click();
        await field('Show frequency string')
            .locator('input[type="checkbox"]')
            .locator('..')
            .click();
        await field('Show velocity string')
            .locator('input[type="checkbox"]')
            .locator('..')
            .click();
        await expect(page.locator('.channel-map-label-span')).toHaveCount(4);
        await expect(
            page.locator('.channel-map-label-span').first(),
        ).toContainText('1');

        await carta.closeWidget('channel-map-control');
        await viewer.hover({ force: true });
        await page.getByTestId('zoom-to-fit-button').click();
        await expect(viewer).toHaveScreenshot('ChannelMap-Configured.png');

        await page
            .locator('.channel-map-label-span')
            .nth(2)
            .click({ force: true });
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame.channel),
            )
            .toBe(3);
        await expect(
            page.getByTestId('spectral-profiler-info-0').locator('pre'),
        ).toContainText('Data:');
        await expect(
            page.locator('.line-plot-component canvas').first(),
        ).toBeVisible();

        await page.getByTestId('image-view-header-channel-map-button').click();
        await expect(page.locator('.channel-map-label-span')).toHaveCount(0);
        await expect(viewer).toHaveScreenshot('ChannelMap-Disabled.png');
    });
});
