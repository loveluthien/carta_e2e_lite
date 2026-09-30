import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test('Auto-fits Gaussian_triple.fits', async ({ page }) => {
    test.setTimeout(90_000);
    page.setDefaultTimeout(10_000);
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.setTestPreferences();
    await carta.loadImage('Gaussian_triple.fits');
    await carta.selectMenuItem('View', 'Image Fitting');

    const dialog = page.locator('.fitting-dialog');
    await dialog
        .locator('.bp6-form-group')
        .filter({ hasText: 'Region' })
        .locator('select')
        .selectOption({ label: 'Image' });
    const components = page.getByTestId('image-fitting-component-input');
    await components.fill('3');
    await components.press('Tab');
    await expect(components).toHaveValue('3');
    await expect(dialog.getByRole('checkbox', { name: 'Auto' })).toBeChecked();
    await page.getByTestId('image-fitting-fit-button').click();

    const result = page.getByTestId('image-fitting-result-tab');
    await expect(result).toContainText('Component #3:', { timeout: 60_000 });
    await expect(result).not.toContainText('Component #4:');
    const text = await result.innerText();
    const amplitudes = [...text.matchAll(/Amplitude\s*=\s*([\d.]+)/g)].map(
        (match) => Number(match[1]),
    );
    const fluxes = [...text.matchAll(/Integrated flux\s*=\s*([\d.]+)/g)].map(
        (match) => Number(match[1]),
    );
    expect(amplitudes).toHaveLength(3);
    expect(fluxes).toHaveLength(3);
    [0.0081, 0.0094, 0.0075].forEach((expected, index) =>
        expect(amplitudes[index]).toBeCloseTo(expected, 3),
    );
    [1.16, 1.84, 1.49].forEach((expected, index) =>
        expect(fluxes[index]).toBeCloseTo(expected, 1),
    );
    await expect(result).toContainText(
        'Background      = 0.000000 (Jy/pixel) (fixed)',
    );
    await page.getByRole('tab', { name: 'Full Log' }).click();
    await expect(page.getByTestId('image-fitting-full-log-tab')).toContainText(
        'Gaussian_triple.fits',
    );
    const [model, residual] = await page.evaluate(() => {
        const frame = (window as any).app.activeFrame;
        return [
            frame.fittingModelImage.filename,
            frame.fittingResidualImage.filename,
        ];
    });
    await carta.closeDialog('fitting-dialog');
    await page.getByTestId('image-view-header-multipanel-view-switch').click();
    for (const [name, screenshot, expectedRgb] of [
        [model, 'gaussian-triple-model.png', [252, 254, 164, 255]],
        [residual, 'gaussian-triple-residual.png', [99, 20, 110, 255]],
    ] as const) {
        await carta.selectMenuItem('View', ['Images', name]);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            name,
        );
        const canvas = page.locator('.image-panel-div #raster-canvas').first();
        await expect(
            page.locator('.image-panel-div #overlay-canvas').first(),
        ).toHaveScreenshot(screenshot, { scale: 'css' });
        const rgb = await canvas.evaluate((element: HTMLCanvasElement) => {
            const x = Math.floor(element.width / 2);
            const y = Math.floor(element.height / 2);
            return [...element.getContext('2d')!.getImageData(x, y, 1, 1).data];
        });
        expect(rgb).toEqual(expectedRgb);
    }

    const spatial = page.getByTestId('spatial-profiler-0-content');
    const profileImage = spatial.getByTestId('image-dropdown');
    await expect(profileImage).toContainText(model);
    await profileImage.selectOption({ label: `1: ${model}` });
    await page.evaluate(async () => {
        const frame = (window as any).app.frames.find(
            (f: any) => f.filename === 'Gaussian_triple.fits',
        ).fittingModelImage;
        await frame.regionSet.addRegionAsync(0, [{ x: 128, y: 128 }]);
    });
    await spatial
        .getByTestId('region-dropdown')
        .selectOption({ label: 'Region 1' });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const app = (window as any).app;
                const model = app.frames.find(
                    (f: any) => f.filename === 'Gaussian_triple.fits',
                ).fittingModelImage;
                return (
                    app.spatialProfiles
                        .get(`${model.frameInfo.fileId}-1`)
                        ?.getProfile('x')?.values?.length ?? 0
                );
            }),
        )
        .toBeGreaterThan(0);
    await expect(spatial.locator('.profile-plot')).toHaveScreenshot(
        'gaussian-triple-model-profile.png',
    );
});

test('Image fitting validates inputs and displays the fitted images', async ({
    page,
}) => {
    test.setTimeout(90_000);
    page.setDefaultTimeout(10_000);
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.setTestPreferences();
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
