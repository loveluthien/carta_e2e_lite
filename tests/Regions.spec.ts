import { expect, test } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test.describe('Regions', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });

    test('rectangle edits update the viewer and profiler; invalid edits and locked deletion are rejected', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        const viewer = page.getByTestId('viewer-div');
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        await page.getByTestId('rectangle-region-shortcut-button').click();
        await canvas.dragTo(canvas, {
            sourcePosition: { x: box!.width * 0.35, y: box!.height * 0.35 },
            targetPosition: { x: box!.width * 0.65, y: box!.height * 0.65 },
        });

        const region = () =>
            page.evaluate(() => {
                const r = (
                    window as any
                ).app.activeFrame.regionSet.regions.find(
                    (r: any) => r.regionId === 1,
                );
                return (
                    r && {
                        name: r.nameString,
                        width: r.size.x,
                        opacity: r.opacity,
                        locked: r.isLocked,
                    }
                );
            });
        await expect.poll(region).toMatchObject({ opacity: 1, locked: false });
        await page.getByTestId('region-list-0-header-title').click();
        const list = page.getByTestId('region-list-table');
        const row = list.getByTestId('region-list-table-row-2');
        await expect(row).toContainText('Rectangle');
        await expect(viewer).toHaveScreenshot('region-created.png');

        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await expect(
            profiler.getByTestId('spectral-profiler-region-dropdown'),
        ).toContainText('Region 1');
        await page.keyboard.press('Escape');
        const plot = page
            .locator(
                '.spectral-profiler-widget .line-plot-component .annotation-stage canvas',
            )
            .first();
        await expect(plot).toBeVisible();
        await expect(plot).toHaveScreenshot('region-profile.png', {
            maxDiffPixelRatio: 0.02,
        });

        await row.dblclick();
        const dialog = page.locator('.region-dialog');
        await expect(dialog).toBeVisible();
        const name = dialog.getByPlaceholder('Enter a region name');
        await name.fill('Science ROI');
        const imageCoordinates = dialog
            .getByRole('radiogroup')
            .getByText('Image');
        await imageCoordinates.click();
        const width = dialog.getByRole('spinbutton', { name: 'Width' });
        await width.fill('80');
        await width.press('Tab');
        await expect
            .poll(region)
            .toMatchObject({ name: 'Science ROI', width: 80 });
        await expect(row).toContainText('Science ROI');

        await width.fill('-5');
        await width.press('Tab');
        await expect.poll(async () => (await region()).width).toBe(80);

        await page.getByTestId('region-dialog-header-close-button').click();
        await expect(viewer).toHaveScreenshot('region-edited.png');
        await expect(plot).toHaveScreenshot('region-profile-edited.png', {
            maxDiffPixelRatio: 0.02,
        });
        await row.dblclick();

        await dialog.getByTestId('region-dialog-lock-button').click();
        await expect.poll(region).toMatchObject({ locked: true });
        await expect(
            dialog.getByTestId('region-dialog-delete-button'),
        ).toBeDisabled();
        await dialog.getByTestId('region-dialog-lock-button').click();
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await expect
            .poll(region)
            .toMatchObject({ opacity: 0.5, locked: false });
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await expect.poll(region).toMatchObject({ opacity: 0 });
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await expect.poll(region).toMatchObject({ opacity: 1 });

        await dialog.getByTestId('region-dialog-delete-button').click();
        await expect.poll(region).toBeFalsy();
        await expect(row).toHaveCount(0);
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await expect(
            page.getByTestId('spectral-profiler-region-dropdown-region-1'),
        ).toHaveCount(0);
    });
});
