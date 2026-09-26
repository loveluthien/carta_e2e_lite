import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test.describe('Contours E2E set', () => {
    test('Contour Dialog', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // 1. Boot up CARTA application
        await carta.goto();

        // 2. Load test data cube
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        await page.getByTestId('contour-dialog-button').click();
        await expect(page.getByTestId('contour-dialog')).toBeVisible();
        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch0_subimage_contour_hist.png',
        );

        await carta.setChannel(0, 24);
        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch24_subimage_contour_hist.png',
        );

        await expect(page.locator('#numericInput-2')).toHaveValue('2.088e-1');
        await expect(page.locator('#numericInput-3')).toHaveValue('1.556e-1');

        await page.getByRole('button', { name: 'Generate' }).click();
        await page.getByRole('button', { name: 'increment' }).first().click();
        await page.getByRole('button', { name: 'increment' }).first().click();
        await page.getByRole('button', { name: 'increment' }).first().click();

        await expect(page.locator('#numericInput-4')).toHaveValue('8');
        await expect(
            page.getByTestId('contour-config-level-input-form'),
        ).toContainText('0.210.360.520.680.83');
        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch24_subimage_contour_hist_SSM8.png',
        );

        await page
            .getByRole('button', { name: 'start-step-multiplier' })
            .click();
        await page.getByRole('menuitem', { name: 'min-max-scaling' }).click();
        await page.locator('#numericInput-4').fill('10');
        await page.getByRole('button', { name: 'Generate' }).click();
        await expect(
            page.getByTestId('contour-config-level-input-form'),
        ).toContainText(
            '-2.19e-25.79e-33.35e-26.12e-28.89e-20.120.140.170.200.23',
        );
        await expect(page.locator('#numericInput-2')).toHaveValue('-2.193e-2');
        await expect(page.locator('#numericInput-3')).toHaveValue('2.275e-1');
        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch24_subimage_contour_hist_mM10.png',
        );

        await page.getByRole('button', { name: 'min-max-scaling' }).click();
        await page
            .getByRole('menuitem', { name: 'percentages-ref.value' })
            .click();
        await expect(
            page.getByText('Parameters Reference N Upper'),
        ).toBeVisible();
        await expect(page.locator('#numericInput-2')).toHaveValue('2.275e-1');
        await page.locator('#numericInput-4').fill('90');
        await page.locator('#numericInput-11').fill('25');
        await page.getByRole('button', { name: 'decrement' }).first().click();
        await page.getByRole('button', { name: 'decrement' }).first().click();
        await page.getByRole('button', { name: 'Generate' }).click();
        await expect(
            page.getByTestId('contour-config-level-input-form'),
        ).toContainText('5.69e-27.80e-29.91e-20.120.140.160.180.20');

        await page
            .getByRole('button', { name: 'percentages-ref.value' })
            .click();
        await page.getByRole('menuitem', { name: 'mean-sigma-list' }).click();
        await expect(
            page.getByText('Parameters Mean Sigma Sigma list -'),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Generate' }).click();
        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch24_subimage_contour_hist_MSL.png',
        );
        await expect(page.locator('#numericInput-2')).toHaveValue('1.424e-2');
        await expect(page.locator('#numericInput-12')).toHaveValue('3.891e-2');
        await expect(page.getByLabel('Levels')).toContainText('-5591317');

        await page.getByTestId('contour-dailog-config-tab-title').click();
        await expect(
            page.getByText(
                'Smoothing mode No smoothingBlockGaussianOpen dropdownSmoothing factor',
            ),
        ).toBeVisible();
        await page.getByTestId('contour-dailog-styling-tab-title').click();
        await expect(page.getByText('Thickness Dashes Negative')).toBeVisible();
    });

    test('Contour Rendering', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // 1. Boot up CARTA application
        await carta.goto();

        // 2. Load test data cube
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        await carta.setChannel(0, 24);
        await carta.plotContour(
            0,
            [
                -2.21e-2, 4.12e-2, 3.03e-2, 5.66e-2, 8.28e-2, 0.11, 0.14, 0.16,
                0.19, 0.21,
            ],
            2,
            4,
        );

        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch24_subimage_contour0.png',
        );

        await page.getByTestId('contour-dialog-button').click();
        await page.getByTestId('contour-dailog-styling-tab-title').click();
        await page
            .getByTestId('contour-thickness-input-increment-button')
            .click();
        await expect(page.getByTestId('contour-thickness-input')).toHaveValue(
            '1.5',
        );
        await page.getByTestId('contour-thickness-input').fill('3');

        await page.locator('.bp6-button.color-swatch-button').first().click();
        await page.getByTitle('#FFFFFF').click();

        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch24_subimage_contour1.png',
        );

        await page
            .getByRole('tabpanel', { name: 'Styling' })
            .locator('select')
            .selectOption('1');
        await page
            .getByTestId('contour-dialog')
            .getByTestId('colormap-dropdown')
            .click();
        await page.getByRole('menuitem', { name: 'tab10' }).click();
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
        await page.getByRole('button', { name: 'increment' }).nth(2).click();
        await expect(
            page.getByRole('spinbutton', { name: 'Bias' }),
        ).toHaveValue('-0.1');
        await expect(
            page.getByRole('spinbutton', { name: 'Contrast' }),
        ).toHaveValue('1.1');

        await expect(page.locator('canvas').nth(1)).toHaveScreenshot(
            'HD163296_13CO_2-1_ch24_subimage_contour2.png',
        );
    });
});
