import { test, expect, type Locator, type Page } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

async function createFullImageRegion(page: Page, canvas: Locator) {
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.getByTestId('rectangle-region-shortcut-button').click();
    await canvas.dragTo(canvas, {
        sourcePosition: { x: 1, y: 1 },
        targetPosition: { x: box!.width - 1, y: box!.height - 1 },
    });
}

async function createPartialImageRegion(page: Page, canvas: Locator) {
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.getByTestId('rectangle-region-shortcut-button').click();
    await canvas.dragTo(canvas, {
        sourcePosition: { x: box!.width * 0.25, y: box!.height * 0.25 },
        targetPosition: { x: box!.width * 0.75, y: box!.height * 0.75 },
    });
}

test.describe('Statistics widget E2E set', () => {
    test('shows values for regions from multiple images', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        await carta.goto();
        await carta.loadImage('cube.fits');
        const firstCanvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        await createFullImageRegion(page, firstCanvas);

        await carta.loadImage('iquv.fits', true);
        const lastCanvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .last();
        await createFullImageRegion(page, lastCanvas);

        await carta.selectMenuItem('Widgets', 'Statistics Widget');
        const widget = page.locator('.stats-widget');
        const table = widget.getByTestId('statistics-table');
        const image = widget.getByTestId('image-dropdown');
        const region = widget.getByTestId('region-dropdown');

        await expect(table).toBeVisible();
        await expect(table.locator('tbody tr')).toHaveCount(10);

        const value = (name: string) =>
            table
                .locator('tbody tr')
                .filter({ hasText: new RegExp(`^${name}`) })
                .locator('td')
                .nth(1);

        await image.selectOption('0');
        await region.selectOption('1');
        await expect(value('NumPixels')).toHaveText(
            '2.550000000000e+2 pixel(s)',
        );
        await expect(value('Sum')).toHaveText('3.044375000000e+2 K');
        await expect(value('Mean')).toHaveText('1.193872549020e+0 K');
        await expect(value('Min')).toHaveText('-3.875000000000e+0 K');
        await expect(value('Max')).toHaveText('1.937500000000e+0 K');

        await image.selectOption('1');
        await region.selectOption('2');
        await expect(value('NumPixels')).toHaveText(
            '2.230000000000e+2 pixel(s)',
        );
        await expect(value('Sum')).toHaveText('2.574375000000e+2 K');

        const stokes = widget.getByTestId('polarization-dropdown');
        await stokes.selectOption({ label: 'Stokes Q' });
        await expect(value('Sum')).toHaveText('5.148750000000e+2 K');
        await expect(value('Mean')).toHaveText('2.308856502242e+0 K');
        await expect(value('Min')).toHaveText('-7.750000000000e+0 K');
        await expect(value('Max')).toHaveText('3.875000000000e+0 K');
    });

    test('shows values for a non-full image region', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        await carta.goto();
        await carta.loadImage('cube.fits');
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        await createPartialImageRegion(page, canvas);

        await carta.selectMenuItem('Widgets', 'Statistics Widget');
        const widget = page.locator('.stats-widget');
        const table = widget.getByTestId('statistics-table');
        const region = widget.getByTestId('region-dropdown');

        await expect(table).toBeVisible();
        await region.selectOption('1');
        await expect(region).toHaveValue('1');
        const value = (name: string) =>
            table
                .locator('tbody tr')
                .filter({ hasText: new RegExp(`^${name}`) })
                .locator('td')
                .nth(1);

        await expect(value('NumPixels')).toHaveText(
            '1.800000000000e+2 pixel(s)',
        );
        await expect(value('Sum')).toHaveText('2.295000000000e+2 K');
        await expect(value('Mean')).toHaveText('1.275000000000e+0 K');
        await expect(value('Min')).toHaveText('-3.875000000000e+0 K');
        await expect(value('Max')).toHaveText('1.937500000000e+0 K');
    });
});
