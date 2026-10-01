import { test, expect, type Page } from '@playwright/test';
import {
    averageWidthInput,
    axesOrderSelect,
    coordDropdown,
    cubeSizeLabel,
    generateButton,
    generatorCloseBtn,
    getFrames,
    imageDropdown,
    keepSwitch,
    previewButton,
    previewCloseBtn,
    previewRegionSelect,
    previewWidget,
    pvCutDropdown,
    pvPanel,
    PlaywrightDevPage,
    rebinXyInput,
    rebinZInput,
    spectralFromInput,
    spectralToInput,
} from '../utilities';

type Point = {
    x: number;
    y: number;
};

type Region = {
    regionId: number;
    controlPoints: Point[];
    setControlPoints: (points: Point[], shouldSkipUpdate?: boolean) => void;
};

type CartaWindow = Window & {
    app: {
        activeFrame: {
            regionSet: {
                regions: Region[];
                addRegionAsync: (
                    regionType: number,
                    controlPoints: Point[],
                ) => Promise<void>;
            };
        };
        animatorStore: {
            startAnimation: (frame: number) => void;
            stopAnimation: () => void;
        };
    };
};

async function createLineAndOpenGenerator(page: Page) {
    const carta = new PlaywrightDevPage(page);
    await page.getByTestId('line-region-shortcut-button').click();
    await page.locator('.region-stage > .konvajs-content > canvas').click({
        position: { x: 359, y: 242 },
    });
    await carta.selectMenuItem('Widgets', 'PV Generator');
    await pvCutDropdown(page).selectOption({ label: 'Region 1' });
}

async function moveLineCut(page: Page) {
    const canvas = page
        .locator('.region-stage > .konvajs-content > canvas')
        .first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Image viewer region canvas is not visible');
    await page.mouse.move(box.x + 359, box.y + 242);
    await page.mouse.down();
    await page.mouse.move(box.x + 379, box.y + 292, { steps: 5 });
    await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.setTestPreferences();
    await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
});

test.afterEach(async ({ page }) => {
    await new PlaywrightDevPage(page).resetAllPreferences();
});

test.describe('PV Generator Controls and Validation', () => {
    test('Initial state filters unsupported regions', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.selectMenuItem('Widgets', 'PV Generator');
        await expect(
            page.getByTestId('pv-generator-0-header-title'),
        ).toBeVisible();

        // Initially no region exists, PV cut should be "None" (value -4 = RegionId.NONE)
        await expect(pvCutDropdown(page)).toHaveValue('-4');
        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();

        // Create a rectangle region (type 3) and point region (type 0)
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            // 3: RECTANGLE, 0: POINT
            await frame.regionSet.addRegionAsync(3, [
                { x: 150, y: 150 },
                { x: 40, y: 40 },
            ]);
            await frame.regionSet.addRegionAsync(0, [{ x: 200, y: 200 }]);
        });

        // Rectangle and Point regions should NOT be listed in PV cut dropdown
        const options = await pvCutDropdown(page)
            .locator('option')
            .allInnerTexts();
        expect(options).toEqual(['None']);
        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();
    });

    test('Invalid line geometry disables generation and preview', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const moveLine = (points: Point[]) =>
            page.evaluate((points) => {
                const regions = (window as unknown as CartaWindow).app
                    .activeFrame.regionSet.regions;
                const line = regions.find((region) => region.regionId === 1);
                if (!line) throw new Error('Line region 1 was not created');
                line.setControlPoints(points, true);
            }, points);

        // Add a valid line region
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            await frame.regionSet.addRegionAsync(1, [
                { x: 15, y: 25 },
                { x: 75, y: 65 },
            ]);
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();

        // Move line region completely outside image bounds
        await moveLine([
            { x: -500, y: -500 },
            { x: -400, y: -400 },
        ]);

        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();

        // Move line back inside image bounds
        await moveLine([
            { x: 20, y: 20 },
            { x: 60, y: 60 },
        ]);
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();

        // Collapse line into a single pixel (same start and end coordinates)
        await moveLine([
            { x: 40, y: 40 },
            { x: 40, y: 40 },
        ]);
        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();

        // Restore normal line
        await moveLine([
            { x: 15, y: 25 },
            { x: 75, y: 65 },
        ]);
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();
        await carta.closeWidget('pv-generator');
        await page.mouse.move(0, 0);
        const viewer = page.getByTestId('viewer-div');
        await expect(viewer.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer).toHaveScreenshot(
            'image-viewer-pv-line-geometry.png',
        );
    });

    test('Polyline supports generation but not preview', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Add a polyline region (type 2: POLYLINE) with 3 vertices
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            await frame.regionSet.addRegionAsync(2, [
                { x: 80, y: 80 },
                { x: 150, y: 180 },
                { x: 220, y: 120 },
            ]);
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');

        // Select the Polyline in PV cut dropdown (first non-None option)
        await pvCutDropdown(page).selectOption({ index: 1 });

        // Generate is enabled for Polyline, but Preview is disabled
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeDisabled();
    });

    test('Animation playback disables generation and preview', async ({
        page,
    }) => {
        await createLineAndOpenGenerator(page);
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();

        // Start animation playback
        await page.evaluate(() => {
            (window as unknown as CartaWindow).app.animatorStore.startAnimation(
                0,
            );
        });

        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();

        // Stop animation playback
        await page.evaluate(() => {
            (
                window as unknown as CartaWindow
            ).app.animatorStore.stopAnimation();
        });

        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();
    });

    test('Spectral coordinate changes range units', async ({ page }) => {
        await createLineAndOpenGenerator(page);

        // Coordinate: Frequency (MHz)
        await coordDropdown(page).selectOption('Frequency (MHz)');
        await expect(pvPanel(page)).toContainText('(MHz)');

        // Coordinate: Radio velocity (km/s)
        await coordDropdown(page).selectOption('Radio velocity (km/s)');
        await expect(pvPanel(page)).toContainText('(km/s)');

        // Coordinate: Vacuum wavelength (um)
        await coordDropdown(page).selectOption('Vacuum wavelength (um)');
        await expect(pvPanel(page)).toContainText('(um)');

        // Coordinate: Channel (unitless -> null)
        await coordDropdown(page).selectOption('Channel');
        await expect(pvPanel(page)).toContainText('Range (null)');
    });

    test('Invalid spectral range disables generation', async ({ page }) => {
        await createLineAndOpenGenerator(page);
        await coordDropdown(page).selectOption('Channel');

        // Initial valid range
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();

        // Set invalid range where From == To (e.g. 20 and 20)
        await spectralFromInput(page).fill('20');
        await spectralFromInput(page).press('Enter');
        await spectralToInput(page).fill('20');
        await spectralToInput(page).press('Enter');
        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();
        expect((await getFrames(page)).some((frame) => frame.isPVImage)).toBe(
            false,
        );

        // Restore valid subset (From = 5, To = 25)
        await spectralFromInput(page).fill('5');
        await spectralFromInput(page).press('Enter');
        await spectralToInput(page).fill('25');
        await spectralToInput(page).press('Enter');
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();
    });

    test('Switching data sources restores the selected cut', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        // Add line region to frame 0
        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        // Append a second image
        await carta.loadImage('M17_SWex.fits', true);

        await carta.selectMenuItem('Widgets', 'PV Generator');

        // Verify Data source dropdown contains both images
        const dataSources = await imageDropdown(page)
            .locator('option')
            .allInnerTexts();
        expect(
            dataSources.some((t) =>
                t.includes('HD163296_13CO_2-1_subimage.fits'),
            ),
        ).toBe(true);
        expect(dataSources.some((t) => t.includes('M17_SWex.fits'))).toBe(true);

        // Switch to M17_SWex
        await imageDropdown(page).selectOption({ label: '1: M17_SWex.fits' });

        // Region dropdown should reset to "None" (-4) because M17_SWex has no regions yet
        await expect(pvCutDropdown(page)).toHaveValue('-4');
        await expect(generateButton(page)).toBeDisabled();

        // Switch back to HD163296
        await imageDropdown(page).selectOption({
            label: '0: HD163296_13CO_2-1_subimage.fits',
        });
        // Select Region 1
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
        await expect(generateButton(page)).toBeEnabled();
    });
});

test.describe('PV Image Generation', () => {
    test.beforeEach(async ({ page }) => {
        await createLineAndOpenGenerator(page);
    });

    test('Generate PV images with multiple spectral coordinates', async ({
        page,
    }) => {
        await generateButton(page).click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
            { timeout: 30_000 },
        );

        await expect
            .poll(
                async () =>
                    (await getFrames(page)).find((frame) => frame.isPVImage)
                        ?.filename,
            )
            .toBe('HD163296_13CO_2-1_subimage_pv.fits');

        await coordDropdown(page).selectOption('Frequency (MHz)');
        await expect(pvPanel(page)).toContainText('(MHz)');
        await generateButton(page).click();
        await expect(page.locator('.task-progress-dialog')).toBeHidden({
            timeout: 30_000,
        });
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
        );
        await generatorCloseBtn(page).click();
        await page.mouse.move(0, 0);
        const viewer = page.getByTestId('viewer-div');
        await expect(viewer.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer).toHaveScreenshot(
            'HD163296_13CO_2-1_subimage_pv_MHz.png',
        );
    });

    test('Generate a PV image with custom average width', async ({ page }) => {
        // Set Average width to 5
        await averageWidthInput(page).fill('5');
        await averageWidthInput(page).press('Tab');

        await generateButton(page).click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
            { timeout: 30_000 },
        );

        const frames = await getFrames(page);
        const pv = frames.find(
            (f: { filename: string }) =>
                f.filename === 'HD163296_13CO_2-1_subimage_pv.fits',
        );
        expect(pv).toBeTruthy();
    });

    test('Generate a PV image from a spectral subset', async ({ page }) => {
        await coordDropdown(page).selectOption('Channel');
        await spectralFromInput(page).fill('10');
        await spectralFromInput(page).press('Enter');
        await spectralToInput(page).fill('30');
        await spectralToInput(page).press('Enter');

        await generateButton(page).click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
            { timeout: 30_000 },
        );

        // 30 - 10 + 1 = 21 channels
        const frames = await getFrames(page);
        const pv = frames.find(
            (f: { filename: string }) =>
                f.filename === 'HD163296_13CO_2-1_subimage_pv.fits',
        );
        expect(pv).toBeTruthy();
        expect(pv?.height).toBe(21);
    });

    test('Transpose PV image axes', async ({ page }) => {
        await coordDropdown(page).selectOption('Channel');
        await axesOrderSelect(page).selectOption(
            'X-axis: Spectral, Y-axis: Spatial',
        );

        await generateButton(page).click();
        await expect(page.getByText('Generating PV')).toBeHidden({
            timeout: 30_000,
        });

        // This fixture's default line yields three spatial samples.
        await expect
            .poll(
                async () => {
                    const frames = await getFrames(page);
                    const pv = frames.find(
                        (f: { filename: string }) =>
                            f.filename === 'HD163296_13CO_2-1_subimage_pv.fits',
                    );
                    return pv ? { width: pv.width, height: pv.height } : null;
                },
                { timeout: 30_000 },
            )
            .toEqual({ width: 110, height: 3 });
    });

    test('Keep or replace previous PV images', async ({ page }) => {
        // First generation without keep
        await generateButton(page).click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
            { timeout: 30_000 },
        );
        let frames = await getFrames(page);
        expect(
            frames.filter((f: { filename: string | string[] }) =>
                f.filename.includes('_pv'),
            ).length,
        ).toBe(1);

        // Enable Keep switch
        await keepSwitch(page).click();
        await coordDropdown(page).selectOption('Frequency (MHz)');
        await generateButton(page).click();
        await expect
            .poll(
                async () => {
                    const f = await getFrames(page);
                    return f.filter((img: { filename: string | string[] }) =>
                        img.filename.includes('_pv'),
                    ).length;
                },
                { timeout: 30_000 },
            )
            .toBe(2);

        // Disable Keep switch
        await keepSwitch(page).click();
        await coordDropdown(page).selectOption('Channel');
        await generateButton(page).click();
        // Should replace rather than add a 3rd
        await expect
            .poll(
                async () => {
                    const f = await getFrames(page);
                    return f.filter((img: { filename: string | string[] }) =>
                        img.filename.includes('_pv'),
                    ).length;
                },
                { timeout: 30_000 },
            )
            .toBeLessThanOrEqual(2);
    });

    test('Generate a PV image from a polyline', async ({ page }) => {
        // Create a polyline region (type 2: POLYLINE) with 3 points
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            // 2: POLYLINE
            await frame.regionSet.addRegionAsync(2, [
                { x: 10, y: 10 },
                { x: 70, y: 35 },
                { x: 40, y: 80 },
            ]);
        });

        // Select the Polyline in PV cut dropdown (second non-None option)
        await pvCutDropdown(page).selectOption({ index: 2 });
        await generateButton(page).click();

        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
            { timeout: 30_000 },
        );
        const frames = await getFrames(page);
        const pv = frames.find(
            (f: { filename: string }) =>
                f.filename === 'HD163296_13CO_2-1_subimage_pv.fits',
        );
        expect(pv).toBeTruthy();
        expect(pv?.isPVImage).toBe(true);
    });

    test('Cancel and retry PV generation', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Load large cube Gaussian_array_wide.fits
        await carta.loadImage('Gaussian_array_wide.fits');

        // Add line region explicitly inside bounds
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            await frame.regionSet.addRegionAsync(1, [
                { x: 10, y: 40 },
                { x: 70, y: 40 },
            ]);
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ index: 1 });

        // Trigger PV generation
        await generateButton(page).click();

        // Progress dialog should appear
        const cancelBtn = page.getByRole('button', { name: 'Cancel' });
        await expect(page.getByText('Generating PV')).toBeVisible({
            timeout: 5000,
        });
        await expect(cancelBtn).toBeVisible();

        // Cancel the PV request
        await cancelBtn.click();
        await expect(page.getByText('Generating PV')).toBeHidden({
            timeout: 10_000,
        });

        // Re-request PV generation
        await generateButton(page).click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'Gaussian_array_wide_pv.fits',
            { timeout: 60_000 },
        );

        const frames = await getFrames(page);
        expect(
            frames.some((f: { filename: string | string[] }) =>
                f.filename.includes('Gaussian_array_wide_pv.fits'),
            ),
        ).toBe(true);
    });

    test('Rest-frame conversion validates input and updates the viewer', async ({
        page,
    }) => {
        test.setTimeout(90_000);
        page.setDefaultTimeout(10_000);
        await generateButton(page).click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
            { timeout: 30_000 },
        );
        await expect(page.locator('.task-progress-dialog')).toBeHidden({
            timeout: 30_000,
        });

        await page.getByTestId('image-view-header-settings-button').click();
        await page
            .locator('.image-view-settings')
            .getByRole('tab', { name: 'Conversion' })
            .click();
        const toggle = page.getByTestId(
            'image-view-settings-rest-frame-toggle',
        );
        await toggle.locator('..').click();
        await expect(toggle).toBeChecked();
        await page
            .getByTestId('image-view-settings-rest-frame-shift-mode-dropdown')
            .selectOption({ label: 'Redshift (z)' });

        const redshift = page.getByTestId(
            'image-view-settings-rest-frame-redshift-input',
        );
        await redshift.fill('-2');
        await redshift.press('Tab');
        await expect(
            page.getByText(/Correction is temporarily using z = 0/),
        ).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame
                            .effectiveRestFrameRedshift,
                ),
            )
            .toBe(0);

        await redshift.fill('0.1');
        await redshift.press('Tab');
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame
                            .effectiveRestFrameRedshift,
                ),
            )
            .toBeCloseTo(0.1, 3);
        await page
            .getByTestId('image-view-settings-rest-frame-shift-mode-dropdown')
            .selectOption({ label: 'Radial velocity (km/s)' });
        await page
            .getByTestId(
                'image-view-settings-rest-frame-velocity-convention-dropdown',
            )
            .selectOption({ label: 'Optical' });
        const velocity = page.getByTestId(
            'image-view-settings-rest-frame-radial-velocity-input',
        );
        await velocity.fill('1000');
        await velocity.press('Tab');
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame
                            .effectiveRestFrameRedshift,
                ),
            )
            .toBeGreaterThan(0);
        await new PlaywrightDevPage(page).closeWidget(
            'image-view-floating-settings',
        );
        await new PlaywrightDevPage(page).closeWidget('pv-generator');
        await page.mouse.move(0, 0);
        const viewer = page.getByTestId('viewer-div');
        await expect(viewer.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer).toHaveScreenshot('image-viewer-pv-rest-frame.png');
    });
});

test.describe('PV Preview', () => {
    test.beforeEach(async ({ page }) => {
        await createLineAndOpenGenerator(page);
    });

    test('Start, move, close and reopen a PV preview', async ({ page }) => {
        // Start preview
        await previewButton(page).click();
        const preview = previewWidget(page);
        await expect(preview).toBeVisible({ timeout: 30_000 });
        await expect(preview.locator('canvas').first()).toBeVisible();
        await expect(preview).toHaveScreenshot(
            'HD163296_13CO_2-1_subimage_pv_preview.png',
        );

        await moveLineCut(page);
        await expect(preview).toHaveScreenshot(
            'HD163296_13CO_2-1_subimage_pv_preview_moved.png',
        );

        // Close preview widget via header close button
        await previewCloseBtn(page).click();
        await expect(preview).toBeHidden({ timeout: 5000 });

        // Re-open preview
        await previewButton(page).click();
        await expect(preview).toBeVisible({ timeout: 10_000 });
    });

    test('Restarted preview applies width and axes order', async ({ page }) => {
        await previewButton(page).click();
        const preview = previewWidget(page);
        await expect(preview).toBeVisible({ timeout: 30_000 });
        await previewCloseBtn(page).click();
        await expect(preview).toBeHidden();

        // Change Average Width
        await averageWidthInput(page).fill('6');
        await averageWidthInput(page).press('Tab');
        await expect(averageWidthInput(page)).toHaveValue('6');

        // Swap Axes Order
        await axesOrderSelect(page).selectOption(
            'X-axis: Spectral, Y-axis: Spatial',
        );
        await expect(axesOrderSelect(page)).toHaveValue(
            'X-axis: Spectral, Y-axis: Spatial',
        );

        await previewButton(page).click();
        await expect(preview).toBeVisible({ timeout: 30_000 });
        await expect(preview).toHaveScreenshot('pv_preview_reversed_axes.png');
    });

    test('Rebin controls retain preview eligibility', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Reuse the large cube from the cancellation test.
        await carta.loadImage('Gaussian_array_wide.fits');

        // The preference minimum is 0.1 GB. This lightweight mock estimates
        // below 0.01 GB, so it should remain eligible for preview.
        await page.getByTestId('preference-dialog-button').click();
        await page.getByRole('tab', { name: 'Performance' }).click();
        const previewSizeLimit = page.getByRole('spinbutton', {
            name: 'PV preview cube size limit',
        });
        await previewSizeLimit.fill('0.1');
        await previewSizeLimit.press('Enter');
        await expect(previewSizeLimit).toHaveValue('0.1');
        await page.getByTestId('preference-dialog-header-close-button').click();

        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });
        await page.evaluate(() => {
            const line = (
                window as unknown as CartaWindow
            ).app.activeFrame.regionSet.regions.find(
                (region) => region.regionId === 1,
            )!;
            line.setControlPoints([
                { x: 5, y: 40 },
                { x: 75, y: 40 },
            ]);
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });

        await expect(cubeSizeLabel(page)).toHaveText('0');
        await expect(previewButton(page)).toBeEnabled();

        // Rebinning controls update while the mock remains below the limit.
        await page
            .getByTestId('pv-generator-preview-rebin-xy-input-increment-button')
            .click();
        await expect(rebinXyInput(page)).toHaveValue('2');
        await expect(previewButton(page)).toBeEnabled();

        // Increment Z rebin as well.
        await page
            .getByTestId('pv-generator-preview-rebin-z-input-increment-button')
            .click();
        await expect(rebinZInput(page)).toHaveValue('2');
        await expect(previewButton(page)).toBeEnabled();
    });

    test('Generate a preview within a rectangle region', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Reuse the lightweight wide cube; its estimate remains below the
        // minimum configurable size limit, including when bounded by a region.
        await carta.loadImage('Gaussian_array_wide.fits');

        await page.getByTestId('preference-dialog-button').click();
        await page.getByRole('tab', { name: 'Performance' }).click();
        const previewSizeLimit = page.getByRole('spinbutton', {
            name: 'PV preview cube size limit',
        });
        await previewSizeLimit.fill('0.1');
        await previewSizeLimit.press('Enter');
        await expect(previewSizeLimit).toHaveValue('0.1');
        await page.getByTestId('preference-dialog-header-close-button').click();

        // Add line region
        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });
        await page.evaluate(() => {
            const line = (
                window as unknown as CartaWindow
            ).app.activeFrame.regionSet.regions.find(
                (region) => region.regionId === 1,
            )!;
            line.setControlPoints([
                { x: 5, y: 40 },
                { x: 75, y: 40 },
            ]);
        });

        // Add a small rectangular region around the cut (3: RECTANGLE)
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            // Keep the preview region inside the lightweight 80×80 test cube.
            await frame.regionSet.addRegionAsync(3, [
                { x: 40, y: 40 },
                { x: 25, y: 25 },
            ]);
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ index: 1 });

        await expect(cubeSizeLabel(page)).toHaveText('0');
        await expect(previewButton(page)).toBeEnabled();

        // Select the rectangle region as "Preview region" (index 1 is the rectangle region)
        await previewRegionSelect(page).selectOption({ index: 1 });

        // Select the rectangle region and confirm preview remains available.
        await expect(previewButton(page)).toBeEnabled();

        // Start preview with bounded subcube
        await previewButton(page).click();
        await expect(previewWidget(page)).toBeVisible({ timeout: 30_000 });
    });

    test('Generate a full PV image while preview remains open', async ({
        page,
    }) => {
        // Start preview
        await previewButton(page).click();
        const preview = previewWidget(page);
        await expect(preview).toBeVisible({ timeout: 30_000 });

        // Check if generateButton is enabled
        await expect(generateButton(page)).toBeEnabled();

        // Generate full resolution PV while preview is active
        await generateButton(page).dispatchEvent('click');

        // Check that full PV frame is created and preview widget is still intact
        await expect
            .poll(
                async () => {
                    const frames = await getFrames(page);
                    return frames.some((f: { filename: string | string[] }) =>
                        f.filename.includes('_pv'),
                    );
                },
                { timeout: 30_000 },
            )
            .toBe(true);

        await expect(preview).toBeVisible();
    });
});
