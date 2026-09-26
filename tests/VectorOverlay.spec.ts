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

test.describe('Vector overlay E2E set', () => {
    test('configures every dialog control and renders the output canvas', async ({
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
    });
});
