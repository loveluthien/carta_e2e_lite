import { test, expect } from '@playwright/test';
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
    resetPreferences,
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

test.describe('PV Generator Controls & Validation', () => {
    test.beforeEach(async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await resetPreferences(page, carta);
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
    });

    test.afterEach(async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        await resetPreferences(page, carta);
    });

    test('PVG-01: Initial state, region filtering and tooltips', async ({
        page,
    }) => {
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

    test('PVG-02: Line geometry validation (out-of-bounds and single-pixel)', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        // Add a valid line region
        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();

        // Move line region completely outside image bounds
        await page.evaluate(() => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            const region = frame.regionSet.regions.find(
                (region: Region) => region.regionId === 1,
            );
            if (region) {
                region.controlPoints = [
                    { x: -500, y: -500 },
                    { x: -400, y: -400 },
                ];
            }
        });

        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();

        // Move line back inside image bounds
        await page.evaluate(() => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            const region = frame.regionSet.regions.find(
                (region: Region) => region.regionId === 1,
            );
            if (region) {
                region.controlPoints = [
                    { x: 100, y: 100 },
                    { x: 200, y: 200 },
                ];
            }
        });
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();

        // Collapse line into a single pixel (same start and end coordinates)
        await page.evaluate(() => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            const region = frame.regionSet.regions.find(
                (region: Region) => region.regionId === 1,
            );
            if (region) {
                region.controlPoints = [
                    { x: 150, y: 150 },
                    { x: 150, y: 150 },
                ];
            }
        });
        await expect(generateButton(page)).toBeDisabled();
        await expect(previewButton(page)).toBeDisabled();

        // Restore normal line
        await page.evaluate(() => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            const region = frame.regionSet.regions.find(
                (region: Region) => region.regionId === 1,
            );
            if (region) {
                region.controlPoints = [
                    { x: 120, y: 120 },
                    { x: 250, y: 220 },
                ];
            }
        });
        await expect(generateButton(page)).toBeEnabled();
        await expect(previewButton(page)).toBeEnabled();
    });

    test('PVG-03: Polyline region enables Generate but disables Preview', async ({
        page,
    }) => {
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

    test('PVG-04: Animation playback disables Generate and Preview', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        // Add line region
        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
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

    test('PVG-05: Spectral coordinate and system settings update units', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });

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

    test('PVG-06: Spectral range validation', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
        await coordDropdown(page).selectOption('Channel');

        // Initial valid range
        await expect(generateButton(page)).toBeEnabled();

        // Set invalid range where From == To (e.g. 20 and 20)
        await spectralFromInput(page).fill('20');
        await spectralFromInput(page).press('Enter');
        await spectralToInput(page).fill('20');
        await spectralToInput(page).press('Enter');
        await expect(generateButton(page)).toBeDisabled();

        // Restore valid subset (From = 5, To = 25)
        await spectralFromInput(page).fill('5');
        await spectralFromInput(page).press('Enter');
        await spectralToInput(page).fill('25');
        await spectralToInput(page).press('Enter');
        await expect(generateButton(page)).toBeEnabled();
    });

    test('PVG-07: Data source switching across multiple loaded images', async ({
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
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await resetPreferences(page, carta);
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
    });

    test.afterEach(async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        await resetPreferences(page, carta);
    });

    test('PVI-01: Full-resolution PV generation and multi-coordinate generation', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        // Generate PV image with default axes
        await generateButton(page).click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage_pv.fits',
            { timeout: 30_000 },
        );

        // Verify frame list has the new PV image
        let frames = await getFrames(page);
        const pvFrame = frames.find(
            (f: { filename: string }) =>
                f.filename === 'HD163296_13CO_2-1_subimage_pv.fits',
        );
        expect(pvFrame).toBeTruthy();
        expect(pvFrame?.isPVImage).toBe(true);

        // Generate second PV image with Frequency (MHz)
        await coordDropdown(page).selectOption('Frequency (MHz)');
        await generateButton(page).click();
        await expect(
            page.locator('#image-panel-1-0 #overlay-canvas'),
        ).toBeVisible({ timeout: 30_000 });

        // Close PV generator and modify line region dimensions via region dialog
        await generatorCloseBtn(page).click();
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .first()
            .dblclick({
                position: { x: 160, y: 240 },
            });
        await page.getByRole('radiogroup').getByText('Image').click();
        await page.locator('#numericInput-20').fill('150');
        await page.locator('#numericInput-21').fill('30');
        await page.getByTestId('region-dialog-header-close-button').click();

        // Re-open PV Generator, switch axes order and coordinate to Vacuum wavelength (um)
        await page.locator('#PVGeneratorButton').click();
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
        await keepSwitch(page).click();
        await axesOrderSelect(page).selectOption(
            'X-axis: Spectral, Y-axis: Spatial',
        );
        await coordDropdown(page).selectOption('Vacuum wavelength (um)');
        await generateButton(page).click();

        await expect(
            page.locator('#image-panel-1-0 #overlay-canvas'),
        ).toBeVisible({ timeout: 30_000 });

        // Verify multiple PV frames exist because keep was enabled
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
            .toBeGreaterThanOrEqual(2);
    });

    test('PVI-02: Custom average width generation', async ({ page }) => {
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

    test('PVI-03: Custom spectral range subset generation', async ({
        page,
    }) => {
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

    test('PVI-04: Axes order transposition (X-axis: Spectral, Y-axis: Spatial)', async ({
        page,
    }) => {
        await coordDropdown(page).selectOption('Channel');
        await axesOrderSelect(page).selectOption(
            'X-axis: Spectral, Y-axis: Spatial',
        );

        await generateButton(page).click();
        await expect(page.getByText('Generating PV')).toBeHidden({
            timeout: 30_000,
        });

        // In reversed axes, width is the spectral axis (channel count = 110) and height is spatial (cut length = 17)
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
            .toEqual({ width: 110, height: 17 });

        // Reset axes order back to default
        await axesOrderSelect(page).selectOption(
            'X-axis: Spatial, Y-axis: Spectral',
        );
    });

    test('PVI-05: Keep previous PV images toggle behaviour', async ({
        page,
    }) => {
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

    test('PVI-06: Polyline cut PV generation', async ({ page }) => {
        // Create a polyline region (type 2: POLYLINE) with 3 points
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            // 2: POLYLINE
            await frame.regionSet.addRegionAsync(2, [
                { x: 100, y: 100 },
                { x: 180, y: 220 },
                { x: 260, y: 150 },
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

    test('PVI-07: PV generation cancellation and re-request', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        // Load large cube Gaussian_array_wide.fits
        await carta.loadImage('Gaussian_array_wide.fits');

        // Add line region explicitly inside bounds
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            await frame.regionSet.addRegionAsync(1, [
                { x: 200, y: 200 },
                { x: 600, y: 200 },
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

    test('PVI-08: Image viewer conversion validates rest-frame input and renders correction', async ({
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
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await resetPreferences(page, carta);
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
    });

    test.afterEach(async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        await resetPreferences(page, carta);
    });

    test('PVP-01: Preview widget activation, interaction and lifecycle', async ({
        page,
    }) => {
        // Start preview
        await previewButton(page).click();
        const preview = previewWidget(page);
        await expect(preview).toBeVisible({ timeout: 30_000 });
        await expect(preview.locator('canvas').first()).toBeVisible();

        // Move line region in the viewer and check preview updates
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();

        await page.mouse.move(box!.x + 359, box!.y + 242);
        await page.mouse.down();
        await page.mouse.move(box!.x + 379, box!.y + 292, { steps: 5 });
        await page.mouse.up();

        await expect(preview).toBeVisible();

        // Close preview widget via header close button
        await previewCloseBtn(page).click();
        await expect(preview).toBeHidden({ timeout: 5000 });

        // Re-open preview
        await previewButton(page).click();
        await expect(preview).toBeVisible({ timeout: 10_000 });
    });

    test('PVP-02: Interactive preview responsiveness to generator controls', async ({
        page,
    }) => {
        await previewButton(page).click();
        const preview = previewWidget(page);
        await expect(preview).toBeVisible({ timeout: 30_000 });

        // Change Average Width
        await averageWidthInput(page).fill('6');
        await averageWidthInput(page).press('Tab');
        await expect(preview.locator('canvas').first()).toBeVisible();

        // Swap Axes Order
        await axesOrderSelect(page).selectOption(
            'X-axis: Spectral, Y-axis: Spatial',
        );
        await expect(preview.locator('canvas').first()).toBeVisible();

        // Change Spectral Coordinate
        await coordDropdown(page).selectOption('Radio velocity (km/s)');
        await expect(preview.locator('canvas').first()).toBeVisible();

        // Reset axes order
        await axesOrderSelect(page).selectOption(
            'X-axis: Spatial, Y-axis: Spectral',
        );
    });

    test('PVP-03: Preview cube size limit and rebinning controls', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        // Reuse the large cube from the cancellation test.
        await carta.loadImage('Gaussian_array_wide.fits');

        // Set the limit below the cube's estimated size to disable preview.
        await page.getByTestId('preference-dialog-button').click();
        await page.getByRole('tab', { name: 'Performance' }).click();
        await page
            .getByRole('spinbutton', { name: 'PV preview cube size limit' })
            .fill('0.4');
        await page.getByTestId('preference-dialog-header-close-button').click();

        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });

        // Verify estimated cube size is 0.44 GB and preview button is disabled
        await expect(page.getByTestId('pv-generator-0-content')).toContainText(
            '0.44',
        );
        await expect(previewButton(page)).toBeDisabled();

        // Increment XY rebin: size drops to 0.11 GB and preview becomes enabled
        await page
            .getByTestId('pv-generator-preview-rebin-xy-input-increment-button')
            .click();
        await expect(page.getByTestId('pv-generator-0-content')).toContainText(
            '0.11',
        );
        await expect(previewButton(page)).toBeEnabled();

        // Increment Z rebin: size drops further
        await page
            .getByTestId('pv-generator-preview-rebin-z-input-increment-button')
            .click();
        await expect(page.getByTestId('pv-generator-0-content')).toContainText(
            '0.05',
        );
        await expect(previewButton(page)).toBeEnabled();
    });

    test('PVP-04: Restricting preview cube size with rectangular Preview Region', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        // Reuse the large cube with a lower preview limit.
        await carta.loadImage('Gaussian_array_wide.fits');

        await page.getByTestId('preference-dialog-button').click();
        await page.getByRole('tab', { name: 'Performance' }).click();
        await page
            .getByRole('spinbutton', { name: 'PV preview cube size limit' })
            .fill('0.4');
        await page.getByTestId('preference-dialog-header-close-button').click();

        // Add line region
        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: { x: 359, y: 242 },
        });

        // Add a small rectangular region around the cut (3: RECTANGLE)
        await page.evaluate(async () => {
            const frame = (window as unknown as CartaWindow).app.activeFrame;
            // 3: RECTANGLE centered at (360, 240) with size (100, 100)
            await frame.regionSet.addRegionAsync(3, [
                { x: 360, y: 240 },
                { x: 100, y: 100 },
            ]);
        });

        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ index: 1 });

        // Full cube preview size exceeds limit
        await expect(previewButton(page)).toBeDisabled();

        // Select the rectangle region as "Preview region" (index 1 is the rectangle region)
        await previewRegionSelect(page).selectOption({ index: 1 });

        // The estimated size should now be much smaller (< 1 GB) and preview enabled
        await expect(previewButton(page)).toBeEnabled();

        // Start preview with bounded subcube
        await previewButton(page).click();
        await expect(previewWidget(page)).toBeVisible({ timeout: 30_000 });
    });

    test('PVP-05: Transition from preview to full PV generation', async ({
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
