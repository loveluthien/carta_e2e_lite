import { expect, test, type Page } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

async function waitForVectorOverlay(page: Page) {
    await expect
        .poll(
            () =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame.vectorOverlayStore
                            .progress,
                ),
            { timeout: 30000 },
        )
        .toBe(1);
}

async function vectorPixels(page: Page) {
    return page
        .locator('#vector-overlay-canvas')
        .evaluate((canvas: HTMLCanvasElement) => {
            const pixels = canvas
                .getContext('2d')!
                .getImageData(0, 0, canvas.width, canvas.height).data;
            let visible = 0;
            let white = 0;
            let colored = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] > 0) {
                    visible++;
                    if (
                        pixels[i] === 255 &&
                        pixels[i + 1] === 255 &&
                        pixels[i + 2] === 255
                    )
                        white++;
                    if (
                        pixels[i] !== pixels[i + 1] ||
                        pixels[i + 1] !== pixels[i + 2]
                    )
                        colored++;
                }
            }
            return { visible, white, colored };
        });
}

async function vectorVertices(page: Page) {
    return page.evaluate(() =>
        (window as any).app.activeFrame.vectorOverlayStore.tiles.reduce(
            (total: number, tile: { numVertices: number }) =>
                total + tile.numVertices,
            0,
        ),
    );
}

async function vectorPng(page: Page) {
    const dataUrl = await page
        .locator('#vector-overlay-canvas')
        .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'));
    return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test.describe('Vector Overlay', () => {
    test('Configures every dialog control and renders the output canvas', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        await carta.goto();
        await carta.loadImage('iquv.fits');

        const viewer = page.getByTestId('viewer-div');
        const dialog = page.getByTestId('vector-dialog');
        const vectorCanvas = page.locator('#vector-overlay-canvas');

        const canvasBefore = await viewer.screenshot();

        await page.getByTestId('vector-dialog-button').click();
        await expect(dialog).toBeVisible();
        await expect(vectorCanvas).toBeVisible();
        const overlayBefore = await vectorCanvas.screenshot();

        // Data source and configuration controls.
        const dataSource = dialog
            .locator('.bp6-form-group')
            .filter({ hasText: 'Data source' })
            .getByRole('button');
        await dataSource.click();
        await page.getByRole('menuitem', { name: 'iquv.fits' }).click();

        await dialog
            .getByTestId('vector-field-angular-source-dropdown')
            .selectOption({ label: 'Current image' });
        await dialog
            .getByTestId('vector-field-intensity-source-dropdown')
            .selectOption({ label: 'Current image' });
        await dialog
            .getByTestId('vector-field-angular-source-dropdown')
            .selectOption({ label: 'Computed PA' });
        await dialog
            .getByTestId('vector-field-intensity-source-dropdown')
            .selectOption({ label: 'Computed PI' });
        await dialog
            .getByTestId('vector-field-averaging-width-input')
            .fill('4');
        await dialog
            .getByTestId('vector-field-averaging-width-input')
            .press('Enter');
        await dialog.getByLabel('Absolute').click({ force: true });
        await dialog.getByLabel('Fractional').click({ force: true });
        await dialog
            .getByTestId('vector-field-threshold-toggle')
            .click({ force: true });
        await dialog
            .getByTestId('vector-field-threshold-option-dropdown')
            .selectOption({ label: 'Stokes I' });
        await dialog.getByTestId('vector-field-threshold-input').fill('0.5');
        await dialog.getByTestId('vector-field-threshold-input').press('Enter');
        await dialog
            .getByTestId('vector-field-debiasing-toggle')
            .click({ force: true });
        await dialog
            .getByTestId('vector-field-stokes-q-error-input')
            .fill('0.1');
        await dialog
            .getByTestId('vector-field-stokes-q-error-input')
            .press('Enter');
        await dialog
            .getByTestId('vector-field-stokes-u-error-input')
            .fill('0.2');
        await dialog
            .getByTestId('vector-field-stokes-u-error-input')
            .press('Enter');

        await expect(
            dialog.getByTestId('vector-field-averaging-width-input'),
        ).toHaveValue('4');
        await expect(dialog.getByLabel('Fractional')).toBeChecked();
        await expect(
            dialog.getByTestId('vector-field-threshold-toggle'),
        ).toBeChecked();
        await expect(
            dialog.getByTestId('vector-field-threshold-option-dropdown'),
        ).toHaveValue('1');
        await expect(
            dialog.getByTestId('vector-field-debiasing-toggle'),
        ).toBeChecked();
        await expect(
            dialog.getByTestId('vector-field-apply-button'),
        ).toBeEnabled();

        // Styling controls, including both constant-color and color-mapped modes.
        await dialog.getByTestId('vector-field-styling-tab').click();
        await dialog.getByTestId('vector-field-line-input').fill('2');
        await dialog.locator('.parameter-intensity input').nth(0).fill('0.1');
        await dialog
            .locator('.parameter-intensity input')
            .nth(0)
            .press('Enter');
        await dialog.locator('.parameter-intensity input').nth(1).fill('10');
        await dialog
            .locator('.parameter-intensity input')
            .nth(1)
            .press('Enter');
        await dialog.locator('.parameter-length input').first().fill('1');
        await dialog.locator('.parameter-length input').first().press('Enter');
        await dialog
            .getByTestId('vector-field-line-length-max-input')
            .fill('12');
        await dialog
            .getByTestId('vector-field-line-length-max-input')
            .press('Enter');
        await dialog
            .getByTestId('vector-field-rotation-offset-input')
            .fill('45');
        await dialog
            .getByTestId('vector-field-rotation-offset-input')
            .press('Enter');

        await dialog
            .getByTestId('vector-field-color-mode-dropdown')
            .selectOption('0');
        const colorButton = dialog
            .locator('.vector-overlay-style-panel .color-swatch-button')
            .first();
        await colorButton.click();
        await page.locator('.color-picker-popup [title]').first().click();
        await page.keyboard.press('Escape');

        await dialog
            .getByTestId('vector-field-color-mode-dropdown')
            .selectOption('1');
        await dialog.getByTestId('colormap-dropdown').click();
        await page
            .locator('.colormap-select-popover')
            .getByRole('menuitem')
            .filter({ has: page.locator('.colormap-block') })
            .nth(1)
            .click();
        await dialog
            .getByTestId('vector-field-invert-colormap-toggle')
            .click({ force: true });
        await dialog.getByRole('spinbutton', { name: 'Bias' }).fill('0.2');
        await dialog.getByRole('spinbutton', { name: 'Contrast' }).fill('1.5');

        await dialog.getByTestId('vector-field-configuration-tab').click();
        await dialog.getByTestId('vector-field-apply-button').click();
        await waitForVectorOverlay(page);

        expect(await vectorVertices(page)).toBeGreaterThan(0);
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.visible))
            .toBeGreaterThan(0);
        expect(
            await page.evaluate(() => {
                const config = (window as any).app.activeFrame
                    .vectorOverlayConfig;
                return {
                    pixelAveraging: config.pixelAveraging,
                    isFractionalIntensity: config.isFractionalIntensity,
                    isThresholdEnabled: config.isThresholdEnabled,
                    threshold: config.threshold,
                    isDebiasing: config.isDebiasing,
                    qError: config.qError,
                    uError: config.uError,
                    thickness: config.thickness,
                    lengthMin: config.lengthMin,
                    lengthMax: config.lengthMax,
                    rotationOffset: config.rotationOffset,
                    isColormapEnabled: config.isColormapEnabled,
                    isColormapInverted: config.isColormapInverted,
                    colormapBias: config.colormapBias,
                    colormapContrast: config.colormapContrast,
                };
            }),
        ).toEqual({
            pixelAveraging: 4,
            isFractionalIntensity: true,
            isThresholdEnabled: true,
            threshold: 0.5,
            isDebiasing: true,
            qError: 0.1,
            uError: 0.2,
            thickness: 2,
            lengthMin: 1,
            lengthMax: 12,
            rotationOffset: 45,
            isColormapEnabled: true,
            isColormapInverted: true,
            colormapBias: 0.2,
            colormapContrast: 1.5,
        });

        const renderedCanvas = await viewer.screenshot();
        expect(renderedCanvas).not.toEqual(canvasBefore);
        expect(await vectorCanvas.screenshot()).not.toEqual(overlayBefore);

        // Exercise angle-only output and the Apply guard for both sources being None.
        await dialog
            .getByTestId('vector-field-intensity-source-dropdown')
            .selectOption({
                label: 'None',
            });
        await dialog.getByTestId('vector-field-apply-button').click();
        await waitForVectorOverlay(page);

        expect(await vectorVertices(page)).toBeGreaterThan(0);
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.visible))
            .toBeGreaterThan(0);

        await dialog
            .getByTestId('vector-field-angular-source-dropdown')
            .selectOption({
                label: 'None',
            });
        await expect(
            dialog.getByTestId('vector-field-apply-button'),
        ).toBeDisabled();
        await dialog
            .getByTestId('vector-field-intensity-source-dropdown')
            .selectOption({ label: 'Computed PI' });
        await dialog.getByTestId('vector-field-apply-button').click();
        await waitForVectorOverlay(page);

        expect(await vectorVertices(page)).toBeGreaterThan(0);
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.visible))
            .toBeGreaterThan(0);

        await dialog.getByTestId('vector-field-clear-button').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame.vectorOverlayStore.tiles
                            .length,
                ),
            )
            .toBe(0);
        await expect(
            dialog.getByTestId('vector-field-clear-button'),
        ).toBeDisabled();
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.visible))
            .toBe(0);
    });

    test('Threshold rejects vectors and recovers with white rendered pixels', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('iquv.fits');

        const dialog = page.getByTestId('vector-dialog');
        await page.getByTestId('vector-dialog-button').click();
        await dialog.getByTestId('vector-field-styling-tab').click();
        await dialog
            .getByTestId('vector-field-color-mode-dropdown')
            .selectOption('0');
        await dialog
            .locator('.vector-overlay-style-panel .color-swatch-button')
            .first()
            .click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        await dialog.getByTestId('vector-field-configuration-tab').click();

        await dialog.getByTestId('vector-field-apply-button').click();
        await waitForVectorOverlay(page);
        expect(await vectorVertices(page)).toBeGreaterThan(0);
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.white))
            .toBeGreaterThan(0);
        expect(await vectorPng(page)).toMatchSnapshot(
            'vector-overlay-white.png',
        );
        const thinPixels = await vectorPixels(page);
        const whiteCanvas = await vectorPng(page);

        await dialog
            .getByTestId('vector-field-threshold-toggle')
            .click({ force: true });
        await dialog
            .getByTestId('vector-field-threshold-option-dropdown')
            .selectOption({ label: 'Stokes I' });
        await dialog
            .getByTestId('vector-field-threshold-input')
            .fill('1000000');
        await dialog.getByTestId('vector-field-threshold-input').press('Enter');
        await dialog.getByTestId('vector-field-apply-button').click();
        await waitForVectorOverlay(page);
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.visible))
            .toBe(0);
        expect(await vectorVertices(page)).toBe(0);
        expect(await vectorPng(page)).toMatchSnapshot(
            'vector-overlay-empty.png',
        );

        await dialog
            .getByTestId('vector-field-threshold-toggle')
            .click({ force: true });
        await dialog.getByTestId('vector-field-apply-button').click();
        await waitForVectorOverlay(page);
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.white))
            .toBeGreaterThan(0);
        expect(await vectorPng(page)).toMatchSnapshot(
            'vector-overlay-white.png',
        );

        await dialog.getByTestId('vector-field-styling-tab').click();
        await dialog.getByTestId('vector-field-line-input').fill('4');
        await dialog.getByTestId('vector-field-line-input').press('Enter');
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.visible))
            .toBeGreaterThan(thinPixels.visible);
        const thickCanvas = await vectorPng(page);
        expect(thickCanvas).not.toEqual(whiteCanvas);

        await dialog
            .getByTestId('vector-field-rotation-offset-input')
            .fill('45');
        await dialog
            .getByTestId('vector-field-rotation-offset-input')
            .press('Enter');
        await expect.poll(() => vectorPng(page)).not.toEqual(thickCanvas);

        await dialog
            .getByTestId('vector-field-color-mode-dropdown')
            .selectOption('1');
        await dialog.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'tab10' }).click();
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.colored))
            .toBeGreaterThan(0);
        expect(await vectorPng(page)).toMatchSnapshot(
            'vector-overlay-mapped.png',
        );

        await page.getByTestId('vector-dialog-header-close-button').click();
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);
        const layerList = page.locator('.layer-list-widget').last();
        const visibility = layerList.getByRole('button', {
            name: 'V',
            exact: true,
        });
        await expect(visibility).toBeVisible();
        await visibility.click();
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.visible))
            .toBe(0);
        expect(await vectorVertices(page)).toBeGreaterThan(0);
        await visibility.click();
        await expect
            .poll(() => vectorPixels(page).then((pixels) => pixels.colored))
            .toBeGreaterThan(0);
    });
});
