import { expect, test, type Page } from '@playwright/test';
import {
    fixtureBrowserPath,
    load,
    pixel,
    PlaywrightDevPage,
    renderedPixelRgb,
    renderedRgb,
} from '../utilities';

const dialog = (page: Page) =>
    page.getByRole('dialog', { name: 'Preferences', exact: true });
const field = (page: Page, label: string) =>
    dialog(page)
        .getByRole('tabpanel')
        .locator('.bp6-form-group')
        .filter({
            has: page
                .locator('.bp6-label')
                .filter({ hasText: new RegExp(`^${label}(?:\\s*\\(|\\s*$)`) }),
        });

// Each page owns a tiny preferences database so parallel specs cannot overwrite
// its saved settings during reload. Images still use the real CARTA backend.
const preferencesTest = test.extend<{ saved: Record<string, unknown> }>({
    saved: async ({ page }, use) => {
        const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ uuid: '00000000-0000-4000-8000-000000000001' })).toString('base64url')}.test`;
        const saved: Record<string, unknown> = {};
        await page.route('https://telemetry.cartavis.org/**', (route) =>
            route.fulfill({ json: { token } }),
        );
        await page.route('**/database/preferences', async (route) => {
            const request = route.request();
            if (request.method() === 'PUT')
                Object.assign(saved, request.postDataJSON());
            if (request.method() === 'DELETE') {
                for (const key of request.postDataJSON().keys)
                    delete saved[key];
            }
            await route.fulfill({
                json: { success: true, preferences: { ...saved } },
            });
        });
        await use(saved);
    },
});

preferencesTest.beforeEach(async ({ page, saved }) => {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.resetAllPreferences();
    await carta.loadImage('cube.fits');
    await page.getByTestId('preference-dialog-button').click();
    await expect(dialog(page)).toBeVisible();
    expect(saved.telemetryMode).toBe('none');
});

preferencesTest.afterEach(async ({ page, saved }) => {
    await new PlaywrightDevPage(page).resetAllPreferences();
    expect(Object.keys(saved).sort()).toEqual([
        'telemetryConsentShown',
        'telemetryMode',
        'telemetryUuid',
    ]);
});

async function tab(page: Page, name: string) {
    await dialog(page).getByRole('tab', { name, exact: true }).click();
}

async function stored(page: Page, key: string, value: unknown) {
    await expect
        .poll(() =>
            page.evaluate(
                (key) =>
                    (window as any).app.preferenceStore.preferences.get(key),
                key,
            ),
        )
        .toEqual(value);
}

async function toggle(
    page: Page,
    label: string,
    key: string,
    checked: boolean,
) {
    const input = field(page, label).getByRole('checkbox');
    if ((await input.isChecked()) !== checked)
        await input.locator('..').click();
    await expect(input).toBeChecked({ checked });
    await stored(page, key, checked);
}

async function select(
    page: Page,
    label: string,
    key: string,
    option: string,
    value: unknown = option,
) {
    const input = field(page, label).locator('select');
    await input.selectOption({ label: option });
    await expect(input.locator('option:checked')).toHaveText(option);
    await stored(page, key, value);
}

async function numeric(
    page: Page,
    label: string,
    key: string,
    value: number,
    exerciseButtons = true,
) {
    const input = field(page, label).locator('input');
    await input.fill(String(value));
    await input.press('Tab');
    await expect(input).toHaveValue(String(value));
    await stored(page, key, value);
    const increment = field(page, label).getByRole('button', {
        name: 'increment',
        exact: true,
    });
    if (exerciseButtons && (await increment.count())) {
        await increment.click();
        await expect
            .poll(() => input.inputValue().then(Number))
            .toBeGreaterThan(value);
        await field(page, label)
            .getByRole('button', { name: 'decrement', exact: true })
            .click();
        await stored(page, key, value);
    }
}

async function menu(
    page: Page,
    label: string,
    key: string,
    option: string,
    value: unknown = option,
) {
    await field(page, label).getByRole('button').click();
    await page.getByRole('menuitem', { name: option, exact: true }).click();
    await stored(page, key, value);
}

async function color(page: Page, label: string, key: string, auto = false) {
    await field(page, label).getByRole('button').click();
    if (auto)
        await page.getByRole('button', { name: 'Other', exact: true }).click();
    const picker = page.locator('.color-picker-popup:visible');
    await picker.getByTitle('#FFFFFF', { exact: true }).click();
    await stored(
        page,
        key,
        key === 'nanColorHex' ? 'rgb(255, 255, 255)' : '#ffffff',
    );
    await page.keyboard.press('Escape');
    if (auto) await page.keyboard.press('Escape');
    await dialog(page)
        .getByRole('heading', { name: 'Preferences', exact: true })
        .click();
}

async function radio(
    page: Page,
    label: string,
    key: string,
    option: string,
    value: string,
) {
    const input = field(page, label).getByRole('radio', {
        name: option,
        exact: true,
    });
    await input.locator('..').click();
    await expect(input).toBeChecked();
    await stored(page, key, value);
}

async function controls(page: Page) {
    return dialog(page)
        .getByRole('tabpanel')
        .evaluate((panel) => ({
            inputs: Array.from(panel.querySelectorAll('input, select')).map(
                (node) => {
                    const input = node as HTMLInputElement;
                    return {
                        type: input.type,
                        value: input.value,
                        checked: input.checked,
                    };
                },
            ),
            buttons: Array.from(panel.querySelectorAll('button')).map(
                (button) => ({
                    text: button.textContent,
                    style: button
                        .querySelector('[style]')
                        ?.getAttribute('style'),
                }),
            ),
        }));
}

async function restore(
    page: Page,
    saved: Record<string, unknown>,
    baseline: unknown,
    keys: string[],
) {
    await expect
        .poll(() => keys.every((key) => Object.hasOwn(saved, key)))
        .toBe(true);
    await dialog(page)
        .getByRole('button', { name: 'Restore defaults' })
        .click();
    await expect
        .poll(() => keys.every((key) => !Object.hasOwn(saved, key)))
        .toBe(true);
    await expect.poll(() => controls(page)).toEqual(baseline);
    // Restoring one tab must not reset telemetry preferences from the fixture.
    if (!keys.includes('telemetryMode'))
        await stored(page, 'telemetryMode', 'none');
}

async function viewer(page: Page, name: string) {
    await page.getByTestId('preference-dialog-header-close-button').click();
    await page.mouse.move(5, 1000);
    await expect.poll(async () => (await renderedRgb(page))[3]).toBe(255);
    await expect(page.locator('.image-ratio-popup')).toHaveCSS('opacity', '0');
    await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
        `preferences-${name}.png`,
    );
}

async function rgbCount(page: Page, selector: string, rgb: number[]) {
    return page.locator(selector).evaluateAll((canvases, rgb) => {
        let count = 0;
        for (const canvas of canvases as HTMLCanvasElement[]) {
            const context = canvas.getContext('2d');
            if (!context) continue;
            const pixels = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            for (let i = 0; i < pixels.length; i += 4) {
                if (
                    pixels[i] === rgb[0] &&
                    pixels[i + 1] === rgb[1] &&
                    pixels[i + 2] === rgb[2] &&
                    pixels[i + 3] > 0
                )
                    count++;
            }
        }
        return count;
    }, rgb);
}

async function drawRegion(page: Page) {
    await page.getByTestId('ellipse-region-shortcut-button').click();
    const canvas = page
        .locator('.region-stage > .konvajs-content > canvas')
        .first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await canvas.dragTo(canvas, {
        sourcePosition: { x: box!.width * 0.35, y: box!.height * 0.35 },
        targetPosition: { x: box!.width * 0.65, y: box!.height * 0.65 },
    });
}

async function regionState(page: Page) {
    return page.evaluate(() => {
        const r = (window as any).app.activeFrame.regionSet.regions.find(
            (r: any) => r.regionId > 0,
        );
        return (
            r && {
                color: r.color,
                lineWidth: r.lineWidth,
                dashLength: r.dashLength,
                type: r.regionType,
            }
        );
    });
}

preferencesTest.describe('Preferences', () => {
    preferencesTest(
        'Global controls update application behavior and restore independently',
        async ({ page, saved }) => {
            await tab(page, 'Global');
            const baseline = await controls(page);
            await select(page, 'Theme', 'theme', 'Dark', 'dark');
            await expect(dialog(page)).toHaveClass(/bp6-dark/);
            await select(page, 'Theme', 'theme', 'Light', 'light');
            await expect(dialog(page)).not.toHaveClass(/bp6-dark/);
            await toggle(
                page,
                'Enable code snippets',
                'codeSnippetsEnabled',
                true,
            );
            await toggle(page, 'Auto-launch file browser', 'autoLaunch', false);
            await select(
                page,
                'File list',
                'fileFilterMode',
                'All files',
                'all',
            );
            await radio(
                page,
                'Initial cursor position',
                'cursorPosition',
                'Fixed',
                'fixed',
            );
            await radio(
                page,
                'Initial zoom level',
                'zoomMode',
                'Zoom to 1.0x',
                'full',
            );
            await radio(
                page,
                'Zoom to',
                'zoomPoint',
                'Current center',
                'center',
            );
            await toggle(page, 'Enable drag-to-pan', 'dragPanning', false);
            const matching = field(page, 'Matching on append').getByRole(
                'checkbox',
            );
            for (let i = 0; i < (await matching.count()); i++) {
                await matching.nth(i).locator('..').click();
                await expect(matching.nth(i)).toBeChecked();
            }
            await stored(page, 'autoWCSMatching', 7);
            await select(
                page,
                'Spectral matching',
                'spectralMatchingType',
                'Frequency',
                'FREQ',
            );
            await toggle(
                page,
                'Transparent image background',
                'transparentImageBackground',
                true,
            );
            await toggle(
                page,
                'Save last used directory',
                'keepLastUsedFolder',
                true,
            );
            await viewer(page, 'global');
            await expect(
                page
                    .locator('.root-menu')
                    .getByText('Snippets', { exact: true }),
            ).toBeVisible();
            await load(page, 'matching-cube.fits', true);
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const frame = (window as any).app.activeFrame;
                        return [
                            !!frame.spatialReference,
                            !!frame.spectralReference,
                            !!frame.rasterScalingReference,
                        ];
                    }),
                )
                .toEqual([true, true, true]);
            await expect
                .poll(() =>
                    page.evaluate(() => ({
                        zoom: (window as any).app.activeFrame.zoomLevel,
                    })),
                )
                .toEqual({ zoom: 1 });
            await page.locator('#SpectralProfilerButton').click();
            await pixel(page, 8, 8, true);
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const store = (
                            window as any
                        ).app.widgetsStore.spectralProfileWidgets.get(
                            'spectral-profiler-0',
                        );
                        return (
                            store?.plotData?.data?.[0]?.map(
                                (point: any) => point.y,
                            ) ?? []
                        );
                    }),
                )
                .toEqual([3, 6, 12, 24, 48]);
            await expect(
                page.locator('.spectral-profiler-widget .line-plot-component'),
            ).toHaveScreenshot('preferences-matched-profile.png');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'theme',
                'codeSnippetsEnabled',
                'autoLaunch',
                'fileFilterMode',
                'cursorPosition',
                'zoomMode',
                'zoomPoint',
                'dragPanning',
                'autoWCSMatching',
                'spectralMatchingType',
                'transparentImageBackground',
                'keepLastUsedFolder',
            ]);
        },
    );

    preferencesTest(
        'Render defaults initialize new images and NaN pixels',
        async ({ page, saved }) => {
            await tab(page, 'Render Configuration');
            const baseline = await controls(page);
            await menu(page, 'Default scaling', 'scaling', 'Gamma', 5);
            await numeric(page, 'Gamma', 'scalingGamma', 2);
            await menu(page, 'Default scaling', 'scaling', 'Log', 1);
            await numeric(page, 'Alpha', 'scalingAlphaLog', 500);
            await menu(page, 'Default colormap', 'colormap', 'gray');
            await toggle(page, 'Invert colormap', 'colormapInverted', true);
            await menu(
                page,
                'Default percentile ranks',
                'percentile',
                '100%',
                100,
            );
            await color(page, 'NaN color', 'nanColorHex');
            await toggle(
                page,
                'Smoothed bias/contrast',
                'useSmoothedBiasContrast',
                false,
            );
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await load(page, 'single.fits');
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const r = (window as any).app.activeFrame.renderConfig;
                        return {
                            scaling: r.scaling,
                            colormap: r.colorMap,
                            inverted: r.isInverted,
                            percentile: r.selectedPercentileVal,
                        };
                    }),
                )
                .toMatchObject({
                    scaling: 1,
                    colormap: 'gray',
                    inverted: true,
                    percentile: 100,
                });
            await expect
                .poll(() => renderedPixelRgb(page, 1, 1))
                .toEqual([255, 255, 255, 255]);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'render');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'scaling',
                'scalingGamma',
                'scalingAlphaLog',
                'colormap',
                'colormapInverted',
                'percentile',
                'nanColorHex',
                'useSmoothedBiasContrast',
            ]);
        },
    );

    preferencesTest(
        'Contour defaults reach the generator and rendered contours',
        async ({ page, saved }) => {
            await tab(page, 'Contour Configuration');
            const baseline = await controls(page);
            await select(
                page,
                'Generator type',
                'contourGeneratorType',
                'min-max-scaling',
            );
            await select(
                page,
                'Smoothing mode',
                'contourSmoothingMode',
                'No smoothing',
                0,
            );
            await numeric(
                page,
                'Default smoothing factor',
                'contourSmoothingFactor',
                2,
            );
            await numeric(
                page,
                'Default contour levels',
                'contourNumLevels',
                3,
            );
            await numeric(page, 'Thickness', 'contourThickness', 3);
            await select(
                page,
                'Default color mode',
                'contourColormapEnabled',
                'Color-mapped',
                true,
            );
            await menu(page, 'Default colormap', 'contourColormap', 'gray');
            await toggle(
                page,
                'Invert colormap',
                'contourColormapInverted',
                true,
            );
            await color(page, 'Default color', 'contourColor');
            await select(
                page,
                'Default color mode',
                'contourColormapEnabled',
                'Constant color',
                false,
            );
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await load(page, 'single.fits');
            await page.getByTestId('contour-dialog-button').click();
            const contour = page.getByTestId('contour-dialog');
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const c = (window as any).app.activeFrame.contourConfig;
                        return {
                            smoothingMode: c.smoothingMode,
                            smoothingFactor: c.smoothingFactor,
                            thickness: c.thickness,
                            color: c.color,
                            colormap: c.colormap,
                            inverted: c.isColormapInverted,
                        };
                    }),
                )
                .toMatchObject({
                    smoothingMode: 0,
                    smoothingFactor: 2,
                    thickness: 3,
                    color: { r: 255, g: 255, b: 255 },
                    colormap: 'gray',
                    inverted: true,
                });
            await expect(contour.getByRole('spinbutton').nth(2)).toHaveValue(
                '3',
            );
            await contour
                .getByRole('button', { name: 'Generate', exact: true })
                .click();
            await expect(
                contour
                    .getByTestId('contour-config-level-input-form')
                    .locator('.bp6-tag'),
            ).toHaveCount(3);
            await contour
                .getByRole('button', { name: 'Apply', exact: true })
                .click();
            await expect
                .poll(() =>
                    page.evaluate(
                        () => (window as any).app.activeFrame.contourProgress,
                    ),
                )
                .toBe(1);
            await page
                .getByTestId('contour-dialog-header-close-button')
                .click();
            await expect
                .poll(() => rgbCount(page, '#contour-canvas', [255, 255, 255]))
                .toBeGreaterThan(0);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'contours');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'contourGeneratorType',
                'contourSmoothingMode',
                'contourSmoothingFactor',
                'contourNumLevels',
                'contourThickness',
                'contourColormapEnabled',
                'contourColormap',
                'contourColormapInverted',
                'contourColor',
            ]);
        },
    );

    preferencesTest(
        'Vector defaults initialize a new Stokes image and render white vectors',
        async ({ page, saved }) => {
            await tab(page, 'Vector Overlay Configuration');
            const baseline = await controls(page);
            await numeric(
                page,
                'Default pixel averaging',
                'vectorOverlayPixelAveraging',
                2,
            );
            await toggle(
                page,
                'Use fractional intensity',
                'vectorOverlayFractionalIntensity',
                true,
            );
            await numeric(page, 'Thickness', 'vectorOverlayThickness', 3);
            await select(
                page,
                'Default color mode',
                'vectorOverlayColormapEnabled',
                'Color-mapped',
                true,
            );
            await menu(
                page,
                'Default colormap',
                'vectorOverlayColormap',
                'gray',
            );
            await toggle(
                page,
                'Invert colormap',
                'vectorOverlayColormapInverted',
                true,
            );
            await color(page, 'Default color', 'vectorOverlayColor');
            await select(
                page,
                'Default color mode',
                'vectorOverlayColormapEnabled',
                'Constant color',
                false,
            );
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await load(page, 'iquv.fits');
            await page.getByTestId('vector-dialog-button').click();
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const c = (window as any).app.activeFrame
                            .vectorOverlayConfig;
                        return {
                            pixelAveraging: c.pixelAveraging,
                            fractional: c.isFractionalIntensity,
                            thickness: c.thickness,
                            color: c.color,
                            colormap: c.colormap,
                            inverted: c.isColormapInverted,
                        };
                    }),
                )
                .toMatchObject({
                    pixelAveraging: 2,
                    fractional: true,
                    thickness: 3,
                    color: { r: 255, g: 255, b: 255 },
                    colormap: 'gray',
                    inverted: true,
                });
            await page.getByTestId('vector-field-apply-button').click();
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame.vectorOverlayStore
                                .progress,
                    ),
                )
                .toBe(1);
            await page.getByTestId('vector-dialog-header-close-button').click();
            await expect
                .poll(() =>
                    rgbCount(page, '#vector-overlay-canvas', [255, 255, 255]),
                )
                .toBeGreaterThan(0);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'vectors');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'vectorOverlayPixelAveraging',
                'vectorOverlayFractionalIntensity',
                'vectorOverlayThickness',
                'vectorOverlayColormapEnabled',
                'vectorOverlayColormap',
                'vectorOverlayColormapInverted',
                'vectorOverlayColor',
            ]);
        },
    );

    preferencesTest(
        'WCS and image overlay defaults initialize the viewer',
        async ({ page, saved }) => {
            await tab(page, 'WCS and Image Overlay');
            const baseline = await controls(page);
            await color(page, 'Color', 'astColor', true);
            await toggle(page, 'WCS grid visible', 'astGridVisible', true);
            await toggle(page, 'Labels visible', 'astLabelsVisible', false);
            await select(
                page,
                'Cursor info visible',
                'cursorInfoVisible',
                'Never',
                'never',
            );
            await select(page, 'WCS format', 'wcsType', 'Degrees', 'degrees');
            await toggle(page, 'Colorbar visible', 'colorbarVisible', false);
            await toggle(page, 'Colorbar visible', 'colorbarVisible', true);
            await toggle(
                page,
                'Colorbar interactive',
                'colorbarInteractive',
                false,
            );
            await select(
                page,
                'Colorbar position',
                'colorbarPosition',
                'Bottom',
                'bottom',
            );
            await numeric(page, 'Colorbar width', 'colorbarWidth', 25);
            await numeric(
                page,
                'Colorbar ticks density',
                'colorbarTicksDensity',
                2,
            );
            await toggle(
                page,
                'Colorbar label visible',
                'colorbarLabelVisible',
                true,
            );
            await toggle(page, 'Beam visible', 'beamVisible', false);
            await toggle(page, 'Beam visible', 'beamVisible', true);
            await color(page, 'Beam color', 'beamColor', true);
            await select(page, 'Beam type', 'beamType', 'Solid', 'solid');
            await numeric(page, 'Beam width', 'beamWidth', 3);
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await load(page, 'flux-beam.fits');
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const o = (window as any).app.overlaySettings;
                        return {
                            color: o.global.color,
                            grid: o.grid.isVisible,
                            labels: o.labels.isVisible,
                            colorbar: {
                                visible: o.colorbar.isVisible,
                                interactive: o.colorbar.isInteractive,
                                position: o.colorbar.position,
                                width: o.colorbar.width,
                                density: o.colorbar.tickDensity,
                                label: o.colorbar.isLabelVisible,
                            },
                        };
                    }),
                )
                .toEqual({
                    color: '#ffffff',
                    grid: true,
                    labels: false,
                    colorbar: {
                        visible: true,
                        interactive: false,
                        position: 'bottom',
                        width: 25,
                        density: 2,
                        label: true,
                    },
                });
            await expect
                .poll(() => rgbCount(page, '#overlay-canvas', [255, 255, 255]))
                .toBeGreaterThan(0);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'overlay');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'astColor',
                'astGridVisible',
                'astLabelsVisible',
                'cursorInfoVisible',
                'wcsType',
                'colorbarVisible',
                'colorbarInteractive',
                'colorbarPosition',
                'colorbarWidth',
                'colorbarTicksDensity',
                'colorbarLabelVisible',
                'beamVisible',
                'beamColor',
                'beamType',
                'beamWidth',
            ]);
        },
    );

    preferencesTest(
        'Layout defaults survive reload and retain the selected startup layout',
        async ({ page, saved }) => {
            await tab(page, 'Layout');
            const baseline = await controls(page);
            await select(page, 'Initial layout', 'layout', 'Cube View');
            await toggle(page, 'Dynamic layout', 'dynamicLayoutEnable', true);
            await toggle(
                page,
                'Higher dimension priority',
                'isHighDimPriority',
                false,
            );
            await toggle(page, 'Dynamic layout', 'dynamicLayoutEnable', false);
            await expect.poll(() => saved.layout).toBe('Cube View');
            await page.reload();
            await expect
                .poll(() =>
                    page.evaluate(
                        () => (window as any).app.layoutStore.currentLayoutName,
                    ),
                )
                .toBe('Cube View');
            await new PlaywrightDevPage(page).loadImage('cube.fits');
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'layout');
            await page.getByTestId('preference-dialog-button').click();
            await tab(page, 'Layout');
            await restore(page, saved, baseline, [
                'layout',
                'dynamicLayoutEnable',
                'isHighDimPriority',
            ]);
        },
    );

    preferencesTest(
        'Region defaults style newly drawn regions and preserve existing regions',
        async ({ page, saved }) => {
            await tab(page, 'Region');
            const baseline = await controls(page);
            await color(page, 'Color', 'regionColor');
            await numeric(page, 'Line width', 'regionLineWidth', 4);
            await numeric(page, 'Dash length', 'regionDashLength', 6);
            await select(page, 'Region type', 'regionType', 'Ellipse', 4);
            await numeric(page, 'Region size', 'regionSize', 40);
            await radio(
                page,
                'Creation mode',
                'regionCreationMode',
                'Corner to corner',
                'corner',
            );
            await select(
                page,
                'Paste offset',
                'regionPasteOffsetUnit',
                'Image px',
                'imagePx',
            );
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await load(page, 'single.fits');
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame.regionSet
                                .newRegionType,
                    ),
                )
                .toBe(4);
            await drawRegion(page);
            await expect
                .poll(() => regionState(page))
                .toMatchObject({
                    color: '#ffffff',
                    lineWidth: 4,
                    dashLength: 6,
                    type: 4,
                });
            await expect
                .poll(() =>
                    rgbCount(page, '.region-stage canvas', [255, 255, 255]),
                )
                .toBeGreaterThan(0);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'region');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'regionColor',
                'regionLineWidth',
                'regionDashLength',
                'regionType',
                'regionSize',
                'regionCreationMode',
                'regionPasteOffsetUnit',
            ]);
            expect(await regionState(page)).toMatchObject({
                color: '#ffffff',
                lineWidth: 4,
            });
        },
    );

    preferencesTest(
        'Annotation defaults update point caches and new annotation styles',
        async ({ page, saved }) => {
            await tab(page, 'Annotation');
            const baseline = await controls(page);
            await color(page, 'Color', 'annotationColor');
            await numeric(page, 'Line width', 'annotationLineWidth', 4);
            await numeric(page, 'Dash length', 'annotationDashLength', 6);
            await field(page, 'Point shape').getByRole('button').click();
            await page
                .locator('.catalog-select:visible')
                .getByRole('menuitem')
                .nth(2)
                .click();
            await stored(page, 'pointAnnotationShape', 2);
            await expect
                .poll(() =>
                    page.evaluate(
                        () => (window as any).app.activeFrame.pointShapeCache,
                    ),
                )
                .toBe(2);
            await numeric(page, 'Point size', 'pointAnnotationWidth', 12);
            await numeric(
                page,
                'Text line width',
                'textAnnotationLineWidth',
                3,
            );
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await page.evaluate(() => {
                const r = (window as any).app.activeFrame.regionSet;
                r.addAnnRectangularRegion({ x: 8, y: 8 }, 6, 6);
                r.addAnnPointRegion({ x: 4, y: 4 });
                r.addAnnTextRegion({ x: 12, y: 12 }, 3, 3);
            });
            await expect
                .poll(() => regionState(page))
                .toMatchObject({
                    color: '#ffffff',
                    lineWidth: 4,
                    dashLength: 6,
                });
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const regions = (window as any).app.activeFrame
                            .regionSet.regions;
                        const point = regions.find(
                            (r: any) => r.pointWidth !== undefined,
                        );
                        const text = regions.find(
                            (r: any) => r.text !== undefined,
                        );
                        return {
                            shape: point?.pointShape,
                            size: point?.pointWidth,
                            textWidth: text?.lineWidth,
                        };
                    }),
                )
                .toEqual({ shape: 2, size: 12, textWidth: 3 });
            await expect
                .poll(() =>
                    rgbCount(page, '.region-stage canvas', [255, 255, 255]),
                )
                .toBeGreaterThan(0);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'annotations');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'annotationColor',
                'annotationLineWidth',
                'annotationDashLength',
                'pointAnnotationShape',
                'pointAnnotationWidth',
                'textAnnotationLineWidth',
            ]);
            await expect
                .poll(() =>
                    page.evaluate(
                        () => (window as any).app.activeFrame.pointShapeCache,
                    ),
                )
                .toBe(0);
        },
    );

    preferencesTest(
        'Performance controls retain values and restore defaults',
        async ({ page, saved }) => {
            await tab(page, 'Performance');
            const baseline = await controls(page);
            await toggle(page, 'Low bandwidth mode', 'lowBandwidthMode', true);
            await toggle(
                page,
                'Limit overlay redraw',
                'limitOverlayRedraw',
                false,
            );
            const quality = field(page, 'Compression quality').locator('input');
            for (const [index, key, value] of [
                [0, 'imageCompressionQuality', 12],
                [1, 'animationCompressionQuality', 10],
            ] as const) {
                await quality.nth(index).fill(String(value));
                await quality.nth(index).press('Tab');
                await stored(page, key, value);
                const group = field(page, 'Compression quality').nth(index);
                await group
                    .getByRole('button', { name: 'increment', exact: true })
                    .click();
                await stored(page, key, value + 1);
                await group
                    .getByRole('button', { name: 'decrement', exact: true })
                    .click();
                await stored(page, key, value);
            }
            for (const [label, key, value] of [
                ['GPU tile cache size', 'GPUTileCache', 1280],
                ['System tile cache size', 'systemTileCache', 2048],
                ['Contour rounding factor', 'contourDecimation', 2],
                ['Contour compression level', 'contourCompressionLevel', 10],
            ] as const)
                await numeric(page, label, key, value);
            await select(
                page,
                'Contour chunk size',
                'contourChunkSize',
                '50K',
                50000,
            );
            await select(
                page,
                'Control map resolution',
                'contourControlMapWidth',
                '128×128 (128 KB)',
                128,
            );
            await toggle(
                page,
                'Stream image tiles while zooming',
                'streamContoursWhileZooming',
                true,
            );
            await select(
                page,
                'Stop animation playback in',
                'stopAnimationPlaybackMinutes',
                '10 minutes',
                10,
            );
            await numeric(
                page,
                'PV preview cube size limit',
                'pvPreviewCubeSizeLimit',
                0.5,
            );
            await viewer(page, 'performance');
            await load(page, 'single.fits');
            await expect
                .poll(async () => (await renderedPixelRgb(page, 8, 8))[3])
                .toBe(255);
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'lowBandwidthMode',
                'limitOverlayRedraw',
                'imageCompressionQuality',
                'animationCompressionQuality',
                'GPUTileCache',
                'systemTileCache',
                'contourDecimation',
                'contourCompressionLevel',
                'contourChunkSize',
                'contourControlMapWidth',
                'streamContoursWhileZooming',
                'stopAnimationPlaybackMinutes',
                'pvPreviewCubeSizeLimit',
            ]);
        },
    );

    preferencesTest(
        'Catalog defaults control initial columns and automatic coordinate selection',
        async ({ page, saved }) => {
            await tab(page, 'Catalog');
            const baseline = await controls(page);
            await numeric(
                page,
                'Displayed columns',
                'catalogDisplayedColumnSize',
                2,
            );
            await toggle(
                page,
                'Auto-select image overlay columns',
                'catalogAutoSelectImageOverlayColumns',
                false,
            );
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await new PlaywrightDevPage(page).selectMenuItem(
                'File',
                'Import Catalog',
            );
            const browser = page.getByTestId('file-browser-dialog');
            await browser.locator('.edit-path-button').click();
            const directory = browser.getByPlaceholder(
                'Input directory path with respect to the top level folder',
            );
            await directory.fill(`${fixtureBrowserPath}/catalogs`);
            await directory.press('Enter');
            await browser
                .getByText('00_baseline_decimal_deg.vot', { exact: true })
                .click();
            await browser
                .getByRole('button', { name: 'Load catalog', exact: true })
                .click();
            await expect(browser).toBeHidden();
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const store = [
                            ...(
                                window as any
                            ).app.catalogStore.catalogProfileStores.values(),
                        ][0] as any;
                        return (
                            store &&
                            [...store.catalogControlHeader.values()].filter(
                                (header: any) => header.display,
                            ).length
                        );
                    }),
                )
                .toBe(2);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'catalog');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'catalogDisplayedColumnSize',
                'catalogAutoSelectImageOverlayColumns',
            ]);
        },
    );

    preferencesTest(
        'Log event checkboxes support individual, all, mixed, and reset states',
        async ({ page, saved }) => {
            await tab(page, 'Log Events');
            const baseline = await controls(page);
            const all = dialog(page).getByRole('checkbox', {
                name: 'Select all',
                exact: true,
            });
            const events = dialog(page).locator('.log-event-checkbox input');
            const count = await events.count();
            expect(count).toBeGreaterThan(0);
            for (let i = 0; i < count; i++) {
                await events.nth(i).locator('..').click();
                await expect(events.nth(i)).toBeChecked();
                await expect
                    .poll(() => (saved.logEventList as unknown[])?.length)
                    .toBe(i + 1);
            }
            await expect(all).toBeChecked();
            await events.first().locator('..').click();
            await expect(all).toBeChecked({ indeterminate: true });
            await all.locator('..').click();
            await expect(all).not.toBeChecked();
            await all.locator('..').click();
            await expect(all).toBeChecked();
            await all.locator('..').click();
            await expect
                .poll(() =>
                    events.evaluateAll((inputs) =>
                        inputs.every(
                            (input) => !(input as HTMLInputElement).checked,
                        ),
                    ),
                )
                .toBe(true);
            await all.locator('..').click();
            await restore(page, saved, baseline, ['logEventList']);
            await viewer(page, 'log-events');
        },
    );

    preferencesTest(
        'Telemetry modes, helper text, logging, and user ID copy work',
        async ({ page, saved, context }) => {
            const telemetry = dialog(page).getByRole('tab', {
                name: 'Telemetry',
                exact: true,
            });
            preferencesTest.skip(
                !(await telemetry.count()),
                'This frontend build disables the telemetry tab',
            );
            await context.grantPermissions([
                'clipboard-read',
                'clipboard-write',
            ]);
            // Collect outgoing payloads locally while exercising consent modes.
            await tab(page, 'Telemetry');
            for (const [label, value, text] of [
                ['Minimal', 'minimal', 'No usage data will be collected.'],
                ['Full', 'usage', 'anonymous usage data'],
                ['Disabled', 'none', 'No data will be collected.'],
            ]) {
                await select(
                    page,
                    'Telemetry mode',
                    'telemetryMode',
                    label,
                    value,
                );
                await expect(field(page, 'Telemetry mode')).toContainText(text);
            }
            await toggle(
                page,
                'Log telemetry output',
                'telemetryLogging',
                true,
            );
            const userId = await page.evaluate(
                () => (window as any).app.telemetryService.decodedUserId,
            );
            await dialog(page).locator('.telemetry-id-text button').click();
            await expect
                .poll(() => page.evaluate(() => navigator.clipboard.readText()))
                .toBe(userId);
            await dialog(page)
                .getByRole('button', { name: 'Restore defaults' })
                .click();
            await expect(
                field(page, 'Telemetry mode').locator('select'),
            ).toHaveValue('usage');
            await expect(
                field(page, 'Log telemetry output').getByRole('checkbox'),
            ).not.toBeChecked();
            await expect.poll(() => saved.telemetryMode).toBeUndefined();
            await page
                .getByRole('button', { name: 'No, do not send usage data' })
                .click();
            await viewer(page, 'telemetry');
        },
    );

    preferencesTest(
        'Compatibility beam preference persists and restores',
        async ({ page, saved }) => {
            await tab(page, 'Compatibility');
            const baseline = await controls(page);
            await toggle(
                page,
                'AIPS cube beam support',
                'compatibilityAipsBeamSupport',
                true,
            );
            await page.reload();
            await new PlaywrightDevPage(page).loadImage('cube.fits');
            await page.getByTestId('preference-dialog-button').click();
            await tab(page, 'Compatibility');
            await expect(
                field(page, 'AIPS cube beam support').getByRole('checkbox'),
            ).toBeChecked();
            await restore(page, saved, baseline, [
                'compatibilityAipsBeamSupport',
            ]);
            await viewer(page, 'compatibility');
        },
    );

    preferencesTest(
        'Invalid numeric input is rejected and valid edits recover',
        async ({ page, saved }) => {
            for (const [name, label, key, valid] of [
                ['Region', 'Line width', 'regionLineWidth', 3],
                ['Annotation', 'Point size', 'pointAnnotationWidth', 8],
                [
                    'Contour Configuration',
                    'Default contour levels',
                    'contourNumLevels',
                    4,
                ],
                [
                    'Vector Overlay Configuration',
                    'Default pixel averaging',
                    'vectorOverlayPixelAveraging',
                    2,
                ],
                [
                    'WCS and Image Overlay',
                    'Colorbar width',
                    'colorbarWidth',
                    20,
                ],
                [
                    'Performance',
                    'PV preview cube size limit',
                    'pvPreviewCubeSizeLimit',
                    0.5,
                ],
                [
                    'Catalog',
                    'Displayed columns',
                    'catalogDisplayedColumnSize',
                    2,
                ],
            ] as const) {
                await tab(page, name);
                await numeric(page, label, key, valid);
                await expect.poll(() => saved[key]).toBe(valid);
                const input = field(page, label).locator('input');
                await input.fill('-1');
                await input.press('Tab');
                await stored(page, key, valid);
                expect(saved[key]).toBe(valid);
                const maximum = await input.getAttribute('max');
                if (maximum !== null) {
                    await input.fill(String(Number(maximum) + 100));
                    await input.press('Tab');
                    await stored(page, key, valid);
                    expect(saved[key]).toBe(valid);
                }
                await numeric(page, label, key, valid);
            }
            await viewer(page, 'numeric-recovery');
        },
    );

    preferencesTest(
        'Dialog help, close, reopen, and saved settings survive reload',
        async ({ page, saved }) => {
            await tab(page, 'Global');
            await select(page, 'Theme', 'theme', 'Dark', 'dark');
            await toggle(page, 'Auto-launch file browser', 'autoLaunch', false);
            await radio(
                page,
                'Initial cursor position',
                'cursorPosition',
                'Fixed',
                'fixed',
            );
            await select(
                page,
                'Spectral matching',
                'spectralMatchingType',
                'Frequency',
                'FREQ',
            );
            await page
                .getByTestId('preference-dialog-header-help-button')
                .click();
            await expect(page.locator('.help-drawer iframe')).toHaveAttribute(
                'src',
                /\/preferences\.html$/,
            );
            await page
                .locator('.help-drawer-backdrop')
                .click({ position: { x: 1800, y: 800 } });
            await expect(page.locator('.help-drawer')).toBeHidden();
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await expect(dialog(page)).toBeHidden();
            await page.getByTestId('preference-dialog-button').click();
            await expect(field(page, 'Theme').locator('select')).toHaveValue(
                'dark',
            );
            await expect.poll(() => saved.theme).toBe('dark');
            await page.reload();
            await expect(page.locator('.root-menu')).toBeVisible();
            await expect
                .poll(() =>
                    page.evaluate(() => ({
                        frozen: (window as any).app.isCursorFrozen,
                        spectralMatching: (window as any).app
                            .spectralMatchingType,
                    })),
                )
                .toEqual({ frozen: true, spectralMatching: 'FREQ' });
            await expect(page.getByTestId('file-browser-dialog')).toBeHidden();
            await new PlaywrightDevPage(page).selectMenuItem(
                'File',
                'Preferences',
            );
            await expect(field(page, 'Theme').locator('select')).toHaveValue(
                'dark',
            );
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await load(page, 'cube.fits');
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'reload');
        },
    );

    preferencesTest(
        'PV preview size converts between MB and GB without changing the saved limit',
        async ({ page }) => {
            await tab(page, 'Performance');
            await numeric(
                page,
                'PV preview cube size limit',
                'pvPreviewCubeSizeLimit',
                0.5,
                false,
            );
            const group = field(page, 'PV preview cube size limit');
            await group.locator('select').selectOption('MB');
            await expect(group.locator('input')).toHaveValue('500');
            await stored(page, 'pvPreviewCubeSizeLimit', 0.5);
            await group.locator('input').fill('750');
            await group.locator('input').press('Tab');
            await stored(page, 'pvPreviewCubeSizeLimit', 0.75);
            await viewer(page, 'pv-units');
            await page.getByTestId('preference-dialog-button').click();
            await group.locator('select').selectOption('GB');
            preferencesTest.fail(
                true,
                'Switching from MB to GB commits the old MB number as GB and clamps the saved limit to 2 GB',
            );
            await expect(group.locator('input')).toHaveValue('0.75');
            await stored(page, 'pvPreviewCubeSizeLimit', 0.75);
        },
    );

    preferencesTest(
        'Custom colormap and scaling parameters initialize a new image',
        async ({ page, saved }) => {
            await tab(page, 'Render Configuration');
            const baseline = await controls(page);
            for (const [name, scaling, key] of [
                ['Power', 4, 'scalingAlphaPower'],
                ['Sinh', 8, 'scalingAlphaSinh'],
                ['Asinh', 9, 'scalingAlphaAsinh'],
            ] as const) {
                await menu(page, 'Default scaling', 'scaling', name, scaling);
                await numeric(page, 'Alpha', key, 2);
            }
            for (const [name, scaling] of [
                ['Square root', 2],
                ['Squared', 3],
                ['Linear', 0],
            ] as const) {
                await menu(page, 'Default scaling', 'scaling', name, scaling);
                await expect(field(page, 'Alpha')).toHaveCount(0);
            }
            await field(page, 'Default colormap').getByRole('button').click();
            await page
                .getByRole('button', { name: 'Color panel', exact: true })
                .click();
            await page
                .locator('.color-picker-popup:visible .w-color-saturation')
                .click({ position: { x: 0, y: 0 } });
            await stored(page, 'colormap', 'custom');
            await stored(page, 'colormapHex', '#ffffff');
            await page.keyboard.press('Escape');
            await page.keyboard.press('Escape');
            await page
                .getByTestId('preference-dialog-header-close-button')
                .click();
            await load(page, 'single.fits');
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const r = (window as any).app.activeFrame.renderConfig;
                        return {
                            colormap: r.colorMap,
                            end: r.customColormapHexEnd,
                            power: r.alphaPower,
                            sinh: r.alphaSinh,
                            asinh: r.alphaAsinh,
                        };
                    }),
                )
                .toEqual({
                    colormap: 'custom',
                    end: '#ffffff',
                    power: 2,
                    sinh: 2,
                    asinh: 2,
                });
            const rgb = await renderedPixelRgb(page, 8, 8);
            expect(rgb[0]).toBe(rgb[1]);
            expect(rgb[1]).toBe(rgb[2]);
            expect(rgb[3]).toBe(255);
            await page.getByTestId('preference-dialog-button').click();
            await viewer(page, 'custom-colormap');
            await page.getByTestId('preference-dialog-button').click();
            await restore(page, saved, baseline, [
                'scaling',
                'scalingAlphaPower',
                'scalingAlphaSinh',
                'scalingAlphaAsinh',
                'colormap',
                'colormapHex',
            ]);
        },
    );

    preferencesTest(
        'A failed preference save preserves the saved value and a later edit succeeds',
        async ({ page, saved }) => {
            await tab(page, 'Global');
            await select(page, 'Theme', 'theme', 'Dark', 'dark');
            await expect.poll(() => saved.theme).toBe('dark');
            await page.route(
                '**/database/preferences',
                (route) =>
                    route.fulfill({ status: 500, json: { success: false } }),
                { times: 1 },
            );
            const failure = page.waitForResponse(
                (response) =>
                    response.url().includes('/database/preferences') &&
                    response.status() === 500,
            );
            await field(page, 'Theme').locator('select').selectOption('light');
            await failure;
            expect(saved.theme).toBe('dark');
            await page.reload();
            await new PlaywrightDevPage(page).loadImage('cube.fits');
            await page.getByTestId('preference-dialog-button').click();
            await tab(page, 'Global');
            await expect(field(page, 'Theme').locator('select')).toHaveValue(
                'dark',
            );
            await select(page, 'Theme', 'theme', 'Light', 'light');
            await expect.poll(() => saved.theme).toBe('light');
            await viewer(page, 'save-recovery');
        },
    );
});
