import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test('Image fitting validates inputs and displays the fitted images', async ({
    page,
}) => {
    test.setTimeout(90_000);
    page.setDefaultTimeout(10_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.setPreferenceDefaults();
    await carta.loadImage('dice_four.fits');
    await carta.selectMenuItem('View', 'Image Fitting');

    const dialog = page.locator('.fitting-dialog');
    const fit = page.getByTestId('image-fitting-fit-button');
    await expect(dialog).toBeVisible();
    await dialog
        .locator('.bp6-form-group')
        .filter({ hasText: 'Region' })
        .locator('select')
        .selectOption({ label: 'Image' });
    await page.getByTestId('image-fitting-component-input').fill('4');
    await page.getByTestId('image-fitting-component-input').press('Tab');
    await expect(page.getByTestId('image-fitting-component-input')).toHaveValue(
        '4',
    );

    await dialog.locator('.auto-switch').click();
    await expect(
        dialog.getByRole('checkbox', { name: 'Auto' }),
    ).not.toBeChecked();
    await expect(fit).toBeDisabled();
    await dialog.locator('.auto-switch').click();
    await expect(dialog.getByRole('checkbox', { name: 'Auto' })).toBeChecked();
    await expect(fit).toBeEnabled();
    await fit.click();

    const result = page.getByTestId('image-fitting-result-tab');
    await expect(result).toContainText('Component #4:', { timeout: 60_000 });
    await expect(result).toContainText('Background');
    await page.getByRole('tab', { name: 'Full Log' }).click();
    await expect(page.getByTestId('image-fitting-full-log-tab')).toContainText(
        'dice_four.fits',
    );

    await expect
        .poll(() =>
            page.evaluate(() => {
                const frame = (window as any).app.frames.find(
                    (f: any) => f.filename === 'dice_four.fits',
                );
                return [
                    frame?.fittingModelImage?.filename,
                    frame?.fittingResidualImage?.filename,
                ];
            }),
        )
        .toEqual([expect.any(String), expect.any(String)]);
    const [model, residual] = await page.evaluate(() => {
        const frame = (window as any).app.frames.find(
            (f: any) => f.filename === 'dice_four.fits',
        );
        return [
            frame.fittingModelImage.filename,
            frame.fittingResidualImage.filename,
        ];
    });
    await carta.closeDialog('fitting-dialog');

    for (const [name, screenshot] of [
        [model, 'image-fitting-model.png'],
        [residual, 'image-fitting-residual.png'],
    ]) {
        await carta.selectMenuItem('View', ['Images', name]);
        await expect(
            page.getByTestId('image-view-header-title').first(),
        ).toContainText(name);
        await expect(
            page.locator('.image-panel-div #overlay-canvas').first(),
        ).toHaveScreenshot(screenshot, { scale: 'css' });
    }

    const spatial = page.getByTestId('spatial-profiler-0-content');
    const profileImage = spatial.getByTestId('image-dropdown');
    await expect(profileImage).toContainText(model);
    await expect(profileImage).toContainText(residual);
    await profileImage.selectOption({ label: `1: ${model}` });
    await page.evaluate(async () => {
        const frame = (window as any).app.frames.find(
            (f: any) => f.filename === 'dice_four.fits',
        ).fittingModelImage;
        await frame.regionSet.addRegionAsync(0, [{ x: 25, y: 75 }]);
    });
    await spatial
        .getByTestId('region-dropdown')
        .selectOption({ label: 'Region 1' });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).app;
                const frame = app.frames.find(
                    (f: any) => f.filename === 'dice_four.fits',
                ).fittingModelImage;
                return (
                    app.spatialProfiles
                        .get(`${frame.frameInfo.fileId}-1`)
                        ?.getProfile('x')?.values?.length ?? 0
                );
            }),
        )
        .toBeGreaterThan(0);
    await expect(spatial.locator('.profile-plot')).toHaveScreenshot(
        'image-fitting-model-profile.png',
    );
});
