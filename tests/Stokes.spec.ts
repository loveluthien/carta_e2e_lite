import { expect, test, type Locator, type Page } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const stokesFiles = [
    'stokes.I.fits',
    'stokes.Q.fits',
    'stokes.U.fits',
    'stokes.V.fits',
];

async function selectStokesFiles(page: Page) {
    const filter = page.getByRole('textbox', {
        name: 'Filter by filename with fuzzy',
    });
    await filter.fill('stokes.');
    await filter.press('Enter');
    await expect
        .poll(() =>
            page.evaluate(
                () => (window as any).app.fileBrowserStore.isLoadingList,
            ),
        )
        .toBe(false);

    for (const filename of stokesFiles) {
        const file = page.getByText(filename, { exact: true });
        await expect(file).toBeVisible();
    }
    for (const [index, filename] of stokesFiles.entries()) {
        await page
            .getByText(filename, { exact: true })
            .click(index ? { modifiers: ['ControlOrMeta'] } : {});
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).app.fileBrowserStore.selectedFiles
                        .map((file: any) => file.fileInfo.name)
                        .sort(),
                ),
            )
            .toEqual(stokesFiles.slice(0, index + 1).sort());
    }
}

async function stokesDropdown(dialog: Locator, filename: string) {
    const row = dialog
        .locator('[data-testid^="stokes-table-filename-"]')
        .filter({ hasText: filename });
    await expect(row).toHaveCount(1);
    const index = (await row.getAttribute('data-testid'))!.split('-').at(-1);
    return dialog.getByTestId(`stokes-table-dropdown-${index}`);
}

async function stokesPlotState(page: Page) {
    return page.evaluate(() => {
        const app = (window as any).app;
        const frame = app.activeFrame;
        const regionId = frame?.regionSet.focusedRegion?.regionId;
        const profiles = app.spectralProfiles
            .get(frame?.frameInfo.fileId)
            ?.get(regionId);
        const profileValues = (coordinate: string) => {
            const profile = Array.from(
                profiles?.profiles.get(coordinate)?.values() ?? [],
            )[0] as any;
            return Array.from(profile?.values ?? []) as number[];
        };
        const intensity = profileValues('Iz');
        const q = profileValues('Qz');
        const u = profileValues('Uz');
        return {
            qOverI: q.map((value, index) => (value / intensity[index]) * 100),
            uOverI: u.map((value, index) => (value / intensity[index]) * 100),
        };
    });
}

async function stokesPlotColorCounts(page: Page) {
    return page.evaluate(() =>
        Array.from(
            document.querySelectorAll<HTMLCanvasElement>(
                '.stokes-widget canvas[role="img"]',
            ),
        ).map((canvas: HTMLCanvasElement) => {
            const pixels = canvas
                .getContext('2d')!
                .getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0;
            for (let index = 0; index < pixels.length; index += 4) {
                const red = pixels[index];
                const green = pixels[index + 1];
                const blue = pixels[index + 2];
                if (
                    Math.max(red, green, blue) - Math.min(red, green, blue) >
                    40
                )
                    count++;
            }
            return count;
        }),
    );
}

test.describe('Stokes hypercube E2E set', () => {
    test('merges IQUV inputs and renders every Stokes plane', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const outputCanvas = page.locator('#raster-canvas').first();

        await carta.goto();
        await selectStokesFiles(page);
        await page.getByRole('button', { name: 'Load as hypercube' }).click();

        const dialog = page.getByTestId('stokes-dialog');
        await expect(dialog).toBeVisible();
        for (const [index, polarization] of [
            'Stokes I',
            'Stokes Q',
            'Stokes U',
            'Stokes V',
        ].entries()) {
            await expect(
                await stokesDropdown(dialog, stokesFiles[index]),
            ).toHaveText(polarization);
        }

        // Duplicate assignments clear the prior row and prevent loading.
        const intensity = await stokesDropdown(dialog, stokesFiles[0]);
        const q = await stokesDropdown(dialog, stokesFiles[1]);
        await intensity.click();
        await page.getByRole('menuitem', { name: 'Stokes Q' }).last().click();
        await expect(q).toHaveText('None');
        await expect(
            dialog.getByTestId('load-hypercube-button'),
        ).toBeDisabled();
        await expect
            .poll(() => page.evaluate(() => (window as any).app.frames.length))
            .toBe(0);
        await intensity.click();
        await page.getByRole('menuitem', { name: 'Stokes I' }).last().click();
        await q.click();
        await page.getByRole('menuitem', { name: 'Stokes Q' }).last().click();
        await expect(dialog.getByTestId('load-hypercube-button')).toBeEnabled();

        await dialog.getByTestId('load-hypercube-button').click();
        await expect(dialog).toBeHidden();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const frame = (window as any).app.activeFrame;
                    return frame?.polarizationInfo?.join(',');
                }),
            )
            .toBe(
                'Stokes I,Stokes Q,Stokes U,Stokes V,Ptotal,Plinear,PFtotal,PFlinear,Pangle',
            );

        await page
            .getByTestId('animator-0-header-title')
            .getByText('Animator')
            .click();
        const polarizationSlider = page
            .getByTestId('animator-polarization-slider')
            .getByRole('slider');
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame
                            .requiredPolarizationInfo,
                ),
            )
            .toBe('Stokes I');
        await expect(outputCanvas).toBeVisible();
        const planes = [
            'Stokes I',
            'Stokes Q',
            'Stokes U',
            'Stokes V',
            'Ptotal',
            'Plinear',
            'PFtotal',
            'PFlinear',
            'Pangle',
        ];
        for (const [index, polarization] of planes.entries()) {
            if (index) await polarizationSlider.press('ArrowRight');
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame
                                .requiredPolarizationInfo,
                    ),
                )
                .toBe(polarization);
            await expect(outputCanvas).toHaveScreenshot(
                `stokes-plane-${polarization.replaceAll(' ', '-')}.png`,
            );
        }
    });

    test('exercises every Stokes Analysis widget control', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        await carta.goto();
        await carta.loadImage('stokes-varying.fits');
        await carta.selectMenuItem('Widgets', 'Stokes Analysis Widget');

        const widget = page.getByTestId('stokes-0-content');
        await expect(widget).toBeVisible();
        await widget.getByTestId('image-dropdown').selectOption({ index: 0 });
        const regionId = await page.evaluate(async () => {
            const frame = (window as any).app.activeFrame;
            const region = await frame.regionSet.addRegionAsync(0, [
                { x: 8, y: 8 },
            ]);
            frame.regionSet.setFocusedRegion(region);
            return region.regionId;
        });
        await widget
            .getByTestId('region-dropdown')
            .selectOption(String(regionId));
        const fractionalPolarization = widget.locator(
            '.stokes-analysis-toolbar input[type="checkbox"]',
        );
        await fractionalPolarization.check({ force: true });
        await expect(fractionalPolarization).toBeChecked();
        await expect
            .poll(() => stokesPlotState(page))
            .toEqual({
                qOverI: [200, 225, 250, 275, 300],
                uOverI: [300, 275, 250, 225, 200],
            });
        const plots = widget.locator('.stokes-widget canvas[role="img"]');
        await expect(plots).toHaveCount(4);
        await expect
            .poll(async () => {
                const colorfulPixels = await stokesPlotColorCounts(page);
                return colorfulPixels.every((count) => count > 0);
            })
            .toBe(true);
        await expect
            .poll(() => widget.locator('.profiler-info').innerText())
            .toContain('Q/I: 2.00e+2, U/I: 3.00e+2, PI/I: 3.61e+2, PA: 28.15');
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-fractional-plots.png',
        );
        await fractionalPolarization.uncheck({ force: true });
        await expect(fractionalPolarization).not.toBeChecked();
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-absolute-plots.png',
        );
        await fractionalPolarization.check({ force: true });
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-fractional-plots.png',
        );

        await page.getByTestId('stokes-0-header-settings-button').click();
        const settings = page.getByTestId(
            'stokes-0-floating-settings-0-content',
        );
        const settingsCloseButton = page.locator(
            '[data-testid^="stokes-0-floating-settings-"][data-testid$="-header-close-button"]',
        );
        await expect(settings).toBeVisible();

        // Conversion settings.
        await settings
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Channel');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.activeFrame.spectralCoordinate,
                ),
            )
            .toBe('Channel');
        await settingsCloseButton.click();
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-channel-plots.png',
        );
        await page.getByTestId('stokes-0-header-settings-button').click();
        await expect(settings).toBeVisible();

        // Line plot styling: both color selectors, line width, point size, and styles.
        await settings.getByRole('tab', { name: 'Line Plot Styling' }).click();
        const linePanel = settings.locator('.line-settings-panel');
        const lineColors = linePanel.locator('button.colorselect');
        await expect(lineColors).toHaveCount(2);
        for (const [index, color] of [
            lineColors.nth(0),
            lineColors.nth(1),
        ].entries()) {
            await color.click();
            await page
                .locator('.bp6-popover.colorselect:visible')
                .getByRole('menuitem')
                .nth(index + 1)
                .click();
        }
        await linePanel
            .getByTestId('profiler-settings-line-width-input')
            .fill('2');
        await linePanel
            .locator('.plot-type-selector .bp6-button')
            .nth(0)
            .click();
        await linePanel
            .locator('.plot-type-selector .bp6-button')
            .nth(1)
            .click();
        await linePanel
            .locator('.plot-type-selector .bp6-button')
            .nth(2)
            .click();
        await linePanel.getByPlaceholder('Point size').fill('3');

        // Scatter plot styling: colormap, inversion, symbols, transparency, and axes.
        await settings
            .getByRole('tab', { name: 'Scatter Plot Styling' })
            .click();
        const scatterPanel = settings.locator('.scatter-settings-panel');
        await scatterPanel.getByTestId('colormap-dropdown').click();
        await page
            .locator('.colormap-select-popover')
            .getByRole('menuitem')
            .filter({ has: page.locator('.colormap-block') })
            .nth(1)
            .click();
        await scatterPanel
            .getByTestId('scatter-plot-invert-colormap-toggle')
            .check({ force: true });
        await scatterPanel.getByPlaceholder('Symbol size').fill('4');
        await scatterPanel.getByPlaceholder('Transparency').fill('0.5');
        await scatterPanel
            .locator('.bp6-form-group')
            .filter({ hasText: 'Equal axes' })
            .locator('input')
            .uncheck({ force: true });
        await scatterPanel
            .locator('.bp6-form-group')
            .filter({ hasText: 'Reference axes' })
            .locator('input')
            .uncheck({ force: true });
        await settingsCloseButton.click();
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-styled-plots.png',
        );
        await widget
            .locator('.stokes-analysis-toolbar .profile-buttons a')
            .click();
        await expect(settings).toBeVisible();
        await expect(
            settings.getByRole('tab', { name: 'Smoothing' }),
        ).toHaveAttribute('aria-selected', 'true');

        // Every smoothing method exposed by this widget and its method-specific inputs.
        const smoothing = settings.locator('.smoothing-settings-panel');
        const captureSmoothing = async (name: string) => {
            await settingsCloseButton.click();
            await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
                `stokes-${name}-plots.png`,
            );
            await page.getByTestId('stokes-0-header-settings-button').click();
            await settings.getByRole('tab', { name: 'Smoothing' }).click();
        };
        const smoothingMethod = smoothing.getByTestId(
            'smoothing-settings-method-dropdown',
        );
        await smoothingMethod.selectOption('Boxcar');
        await smoothing
            .getByTestId('smoothing-settings-overlay-toggle')
            .check({ force: true });
        await smoothing
            .getByTestId('smoothing-settings-kernel-input')
            .fill('3');
        await captureSmoothing('boxcar-overlay');
        await smoothing
            .getByTestId('smoothing-settings-overlay-toggle')
            .uncheck({ force: true });
        await captureSmoothing('boxcar-only');
        await smoothing
            .getByTestId('smoothing-settings-overlay-toggle')
            .check({ force: true });
        await smoothingMethod.selectOption('Gaussian');
        await smoothing.getByTestId('smoothing-settings-sigma-input').fill('2');
        await captureSmoothing('gaussian');
        await smoothingMethod.selectOption('Hanning');
        await smoothing
            .getByTestId('smoothing-settings-kernel-input')
            .fill('5');
        await captureSmoothing('hanning');
        await smoothingMethod.selectOption('Binning');
        await smoothing
            .getByTestId('smoothing-settings-binning-width-input')
            .fill('3');
        await captureSmoothing('binning');
        await smoothingMethod.selectOption('Savitzky-Golay');
        await smoothing
            .getByTestId('smoothing-settings-kernel-input')
            .fill('5');
        await smoothing
            .getByTestId('smoothing-settings-fitting-order-input')
            .fill('2');
        await captureSmoothing('savitzky-golay');
        await smoothingMethod.selectOption('None');
        await settingsCloseButton.click();
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-styled-plots.png',
        );

        await expect
            .poll(() =>
                page.evaluate(() => {
                    const store = Array.from(
                        (
                            window as any
                        ).app.widgetsStore.stokesAnalysisWidgets.values(),
                    )[0] as any;
                    return {
                        fractional: store.isFractionalPolVisible,
                        lineWidth: store.lineWidth,
                        pointSize: store.linePlotPointSize,
                        plotType: store.plotType,
                        primaryColor: store.primaryLineColor,
                        secondaryColor: store.secondaryLineColor,
                        colorMap: store.colorMap,
                        inverted: store.isInvertedColorMap,
                        symbolSize: store.scatterPlotPointSize,
                        transparency: store.pointTransparency,
                        equalAxes: store.areAxesEqual,
                        referenceAxes: store.shouldShowReferenceAxes,
                        smoothing: store.smoothingStore.type,
                        boxcar: store.smoothingStore.boxcarSize,
                        gaussian: store.smoothingStore.gaussianSigma,
                        hanning: store.smoothingStore.hanningSize,
                        binning: store.smoothingStore.binWidth,
                        savitzkyKernel: store.smoothingStore.savitzkyGolaySize,
                        savitzkyOrder: store.smoothingStore.savitzkyGolayOrder,
                    };
                }),
            )
            .toEqual({
                fractional: true,
                lineWidth: 2,
                pointSize: 3,
                plotType: 'Points',
                primaryColor: 'auto-orange',
                secondaryColor: 'auto-green',
                colorMap: 'Blues',
                inverted: true,
                symbolSize: 4,
                transparency: 0.5,
                equalAxes: false,
                referenceAxes: false,
                smoothing: 'None',
                boxcar: 3,
                gaussian: 2,
                hanning: 5,
                binning: 3,
                savitzkyKernel: 5,
                savitzkyOrder: 2,
            });
    });

    test('keeps fractional polarization unavailable without Q and U', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('stokes-varying.fits');
        await carta.loadImage('stokes.I.fits', true);
        await carta.selectMenuItem('Widgets', 'Stokes Analysis Widget');

        const widget = page.getByTestId('stokes-0-content');
        const images = widget.getByTestId('image-dropdown');
        const fractionalPolarization = widget.locator(
            '.stokes-analysis-toolbar input[type="checkbox"]',
        );
        await expect(images.locator('option')).toHaveCount(3);
        await images.selectOption({ label: '0: stokes-varying.fits' });
        const regionId = await page.evaluate(async () => {
            const frame = (window as any).app.frames[0];
            const region = await frame.regionSet.addRegionAsync(0, [
                { x: 8, y: 8 },
            ]);
            frame.regionSet.setFocusedRegion(region);
            return region.regionId;
        });
        await widget
            .getByTestId('region-dropdown')
            .selectOption(String(regionId));
        await fractionalPolarization.check({ force: true });
        await expect(widget.locator('.profiler-info')).toContainText(
            'Q/I: 2.00e+2',
        );

        await images.selectOption({ label: '1: stokes.I.fits' });
        await expect(fractionalPolarization).toBeDisabled();
        await expect(fractionalPolarization).not.toBeChecked();
        await expect(widget.locator('.profiler-info')).not.toContainText('Q:');
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-unavailable-plots.png',
        );
        await expect(page.locator('#raster-canvas').first()).toBeVisible();

        await images.selectOption({ label: '0: stokes-varying.fits' });
        await widget
            .getByTestId('region-dropdown')
            .selectOption(String(regionId));
        await expect(fractionalPolarization).toBeEnabled();
        await fractionalPolarization.check({ force: true });
        await expect(widget.locator('.stokes-widget')).toHaveScreenshot(
            'stokes-recovered-plots.png',
        );
    });
});
