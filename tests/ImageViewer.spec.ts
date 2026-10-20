import { readFile } from 'node:fs/promises';
import {
    test as base,
    expect,
    type Locator,
    type Page,
} from '@playwright/test';
import { PlaywrightDevPage, pixel } from '../utilities';

const test = base.extend<{
    carta: PlaywrightDevPage;
    viewerCanvas: Locator;
}>({
    carta: async ({ page }, use) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.setTestPreferences();
        await use(carta);
    },
    viewerCanvas: async ({ page }, use) => {
        await use(page.getByTestId('viewer-div'));
    },
});

test.setTimeout(90_000);

function settingsField(panel: Locator, label: RegExp) {
    const text = new RegExp(label.source.replace(/\$$/, '\\s*$'), label.flags);
    return panel.locator('.bp6-form-group').filter({
        has: panel.page().locator('.bp6-label').filter({ hasText: text }),
    });
}

async function rasterRGBA(canvas: Locator) {
    return canvas.evaluate((source: HTMLCanvasElement) => {
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d')!;
        context.drawImage(source, 0, 0);
        return Array.from(
            context.getImageData(
                Math.floor(copy.width / 2),
                Math.floor(copy.height / 2),
                1,
                1,
            ).data,
        );
    });
}

async function settleViewer(viewer: Locator) {
    await viewer.page().mouse.move(0, 0);
    await expect(viewer.locator('.image-ratio-popup')).toHaveCSS(
        'opacity',
        '0',
    );
}

async function snapshotViewer(
    viewer: Locator,
    name: string,
    options: { maxDiffPixelRatio?: number } = {},
) {
    const page = viewer.page();
    const settings = page.locator('.image-view-settings');
    const restoreSettings = await settings.isVisible();
    const selectedTab = restoreSettings
        ? await settings.getByRole('tab', { selected: true }).innerText()
        : undefined;
    const carta = new PlaywrightDevPage(page);
    if (restoreSettings) {
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(page.getByTestId('viewer-div'));
    }
    await expect(settings).toBeHidden();
    await expect(viewer).toHaveScreenshot(name, options);
    if (restoreSettings) {
        await page.getByTestId('image-view-header-settings-button').click();
        await settings
            .getByRole('tab', { name: selectedTab!, exact: true })
            .click();
    }
}

async function useSinglePanel(page: Page) {
    await page.evaluate(async () => {
        const app = (window as any).app;
        await app.preferenceStore.setPreference('imagePanelMode', 'fixed');
        await app.preferenceStore.setPreference('imagePanelColumns', 1);
        await app.preferenceStore.setPreference('imagePanelRows', 1);
        app.widgetsStore.setImageMultiPanelEnabled(true);
    });
}

test.describe('Image Viewer Controls', () => {
    test.use({ colorScheme: 'dark' });
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10_000));

    test('Toolbar toggle and all export resolutions', async ({
        page,
        carta,
        viewerCanvas,
    }, testInfo) => {
        await carta.loadImage('cube.fits');
        await viewerCanvas.hover();

        const toggle = page.getByTestId('toggle-toolbar-button');
        const zoom = page.getByTestId('zoom-in-button');
        await expect(zoom).toBeVisible();
        await toggle.click();
        await expect(zoom).toHaveCount(0);
        await toggle.click();
        await expect(zoom).toBeVisible();

        const raster = page.locator('#raster-canvas').first();
        await expect
            .poll(() => rasterRGBA(raster).then((pixel) => pixel[3]))
            .toBe(255);
        const expectedPixel = await rasterRGBA(raster);
        const sizes: Array<[number, number]> = [];
        for (const [index, label] of [
            'Normal (100%)',
            'High (200%)',
            'Highest (400%)',
        ].entries()) {
            await page.getByTestId('export-image-view-button').click();
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('menuitem', { name: label }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(
                /^cube\.fits-image-\d{4}(?:-\d{2}){5}\.png$/,
            );
            const savedPath = testInfo.outputPath(`export-${index}.png`);
            await download.saveAs(savedPath);
            const png = await readFile(savedPath);
            expect(png.subarray(0, 8)).toEqual(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            );
            sizes.push([png.readUInt32BE(16), png.readUInt32BE(20)]);
            const exportedPixel = await page.evaluate(async (base64) => {
                const image = new Image();
                image.src = `data:image/png;base64,${base64}`;
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const context = canvas.getContext('2d')!;
                context.drawImage(image, 0, 0);
                return Array.from(
                    context.getImageData(
                        Math.floor(image.width / 2),
                        Math.floor(image.height / 2),
                        1,
                        1,
                    ).data,
                );
            }, png.toString('base64'));
            expect(exportedPixel[3]).toBe(255);
            for (const channel of [0, 1, 2]) {
                expect(
                    Math.abs(exportedPixel[channel] - expectedPixel[channel]),
                ).toBeLessThanOrEqual(20);
            }
        }
        expect(sizes[0][0]).toBeGreaterThan(0);
        expect(sizes[0][1]).toBeGreaterThan(0);
        for (const [index, ratio] of [
            [1, 2],
            [2, 4],
        ]) {
            for (const dimension of [0, 1]) {
                expect(
                    Math.abs(
                        sizes[index][dimension] - sizes[0][dimension] * ratio,
                    ),
                ).toBeLessThanOrEqual(ratio);
            }
        }
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'image-viewer-export-raster.png',
        );
    });

    test('Viewer matching controls spatial and spectral alignment', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        await carta.loadImage('matching-cube.fits', true);

        const panel = page.locator('#image-panel-1-0');
        await panel
            .locator('.region-stage canvas')
            .first()
            .click({ position: { x: 100, y: 100 } });
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame?.filename),
            )
            .toBe('matching-cube.fits');
        const state = () =>
            page.evaluate(() => {
                const frame = (window as any).app.frames[1];
                return {
                    spatial: frame.spatialReference?.filename ?? null,
                    spectral: frame.spectralReference?.filename ?? null,
                };
            });
        const choose = async (name: string) => {
            await panel.getByTestId('match-button').click();
            await page.getByRole('menuitem', { name, exact: true }).click();
        };

        await choose('None');
        await expect.poll(state).toEqual({ spatial: null, spectral: null });
        await choose('Spatial only');
        await expect
            .poll(state)
            .toEqual({ spatial: 'cube.fits', spectral: null });
        await choose('Spectral (VRAD) only');
        await expect
            .poll(state)
            .toEqual({ spatial: null, spectral: 'cube.fits' });
        await choose('Spectral (VRAD) and spatial');
        await expect
            .poll(state)
            .toEqual({ spatial: 'cube.fits', spectral: 'cube.fits' });
        await page
            .locator('#image-panel-0-0 .region-stage canvas')
            .first()
            .click();
        await page.evaluate(() =>
            (window as any).app.frames[0].setCenter(6, 6),
        );
        await page.getByTestId('animator-0-header-title').click();
        await page.getByTestId('animator-last-button').click();
        const geometry = () =>
            page.evaluate(() => {
                const [reference, matched] = (window as any).app.frames;
                return {
                    referenceChannel: reference.channel,
                    channel: matched.channel,
                    center: matched.center,
                };
            });
        await expect
            .poll(geometry)
            .toMatchObject({ referenceChannel: 4, channel: 2 });
        expect((await geometry()).center.x).toBeCloseTo(7.732, 2);
        expect((await geometry()).center.y).toBeCloseTo(6, 2);
        await panel.locator('.region-stage canvas').first().click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame.filename),
            )
            .toBe('matching-cube.fits');
        await page.locator('#SpectralProfilerButton').click();
        await page.evaluate(() => {
            const frame = (window as any).app.frames[1];
            frame.setCursorPosition({ x: 8, y: 6 });
            frame.updateCursorRegion({ x: 8, y: 6 });
        });
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Velocity: 4.0000 km/s',
        );
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).app.widgetsStore.spectralProfileWidgets
                        .get('spectral-profiler-0')
                        ?.plotData?.data[0]?.map((point: any) => point.y),
                ),
            )
            .toEqual([2.75, 5.5, 11, 22, 44]);
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await expect(
            profiler.locator('.annotation-stage canvas').first(),
        ).toHaveScreenshot('image-viewer-matched-spectral-profile.png');
        await carta.closeWidget('spectral-profiler');
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-matched.png');
        await choose('None');
        await expect.poll(state).toEqual({ spatial: null, spectral: null });
    });

    test('Ruler creation renders a measured region', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('M17_SWex.fits');
        await viewerCanvas.hover();
        const before = await page.evaluate(
            () => (window as any).app.activeFrame.regionSet.regions.length,
        );
        await page.getByTestId('toolbar-distance-measuring-button').click();
        const canvas = page.locator('.region-stage canvas').first();
        await canvas.dragTo(canvas, {
            sourcePosition: { x: 150, y: 150 },
            targetPosition: { x: 300, y: 250 },
        });
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame.regionSet.regions
                            .length,
                ),
            )
            .toBe(before + 1);
        const rulerGeometry = () =>
            page.evaluate(() => {
                const region = (
                    window as any
                ).app.activeFrame.regionSet.regions.at(-1);
                return {
                    type: region.regionType,
                    width: region.size.x,
                    height: region.size.y,
                };
            });
        await expect.poll(rulerGeometry).toMatchObject({ type: 14 });
        const { width, height } = await rulerGeometry();
        expect(Number.isFinite(width)).toBe(true);
        expect(Number.isFinite(height)).toBe(true);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-ruler.png');
    });

    test('Raster RGB and invalid beam width', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        const rgb = () => rasterRGBA(page.locator('#raster-canvas').first());
        const initial = await rgb();
        for (const [channel, min, max] of [
            [0, 235, 250],
            [1, 210, 235],
            [2, 65, 105],
        ]) {
            expect(initial[channel]).toBeGreaterThanOrEqual(min);
            expect(initial[channel]).toBeLessThanOrEqual(max);
        }
        expect(initial[3]).toBe(255);

        await carta.selectMenuItem('Widgets', 'Render Configuration Widget');
        const renderConfig = page.getByTestId('render-config-0-content');
        await renderConfig.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'gray', exact: true }).click();
        await expect
            .poll(async () => {
                const [red, green, blue, alpha] = await rgb();
                return { isGray: red === green && green === blue, alpha };
            })
            .toEqual({ isGray: true, alpha: 255 });
        await carta.closeWidget('render-config');
        await settleViewer(viewerCanvas);
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'image-viewer-gray-raster.png',
        );

        await carta.loadImage('M17_SWex.fits');
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Beam' }).click();
        const width = page.getByRole('spinbutton', { name: 'Width' });
        const beamWidth = () =>
            page.evaluate(
                () =>
                    (window as any).app.overlaySettings.beam.settingsForDisplay
                        .width,
            );
        const original = await beamWidth();
        await width.fill('20');
        await width.press('Tab');
        await expect.poll(beamWidth).toBe(original);
        await width.fill('2');
        await width.press('Tab');
        await expect.poll(beamWidth).toBe(2);
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-beam-width.png');
    });
    test('Empty viewer controls recover after loading an image', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();
        await expect(
            page.getByTestId('image-view-header-previous-page-button'),
        ).toBeDisabled();
        await expect(
            page.getByTestId('image-view-header-next-page-button'),
        ).toBeDisabled();
        await expect(page.getByTestId('zoom-in-button')).toHaveCount(0);
        await page.getByTestId('image-view-header-settings-button').click();
        await expect(
            page.getByRole('tab', { name: 'Beam', exact: true }),
        ).toBeDisabled();
        await expect(
            page.getByRole('tab', { name: 'Conversion', exact: true }),
        ).toBeDisabled();
        await carta.closeWidget('image-view-floating-settings');
        await snapshotViewer(viewerCanvas, 'image-viewer-empty.png');

        await carta.loadImage('single.fits');
        await viewerCanvas.hover();
        await expect(page.getByTestId('zoom-in-button')).toBeVisible();
        await expect
            .poll(() =>
                rasterRGBA(page.locator('#raster-canvas').first()).then(
                    (pixel) => pixel[3],
                ),
            )
            .toBe(255);
        await page.getByTestId('image-view-header-settings-button').click();
        await expect(
            page.getByRole('tab', { name: 'Beam', exact: true }),
        ).toBeEnabled();
        await expect(
            page.getByRole('tab', { name: 'Conversion', exact: true }),
        ).toBeDisabled();
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-empty-recovered.png');
    });

    test('Pan and zoom edits, invalid sizes, and offset toolbar buttons', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        await useSinglePanel(page);
        await page
            .getByTestId('render-config-0-content')
            .getByTestId('colormap-dropdown')
            .click();
        await page.getByRole('menuitem', { name: 'gray', exact: true }).click();
        const raster = page.locator('#raster-canvas').first();
        await expect
            .poll(() => rasterRGBA(raster).then((pixel) => pixel[3]))
            .toBe(255);
        const originalPixel = await rasterRGBA(raster);
        await viewerCanvas.hover();
        await page.getByTestId('toolbar-region-moving-button').dblclick();
        await expect(
            page.getByRole('tab', { name: 'Pan and Zoom', exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        const pan = page.locator('.panel-pan-and-zoom');
        await pan
            .getByRole('radiogroup')
            .getByText('Image', { exact: true })
            .click();
        const centerX = settingsField(pan, /^Center \(X\)/).getByRole(
            'spinbutton',
        );
        const centerY = settingsField(pan, /^Center \(Y\)/).getByRole(
            'spinbutton',
        );
        await centerX.fill('8');
        await centerX.press('Enter');
        await centerY.fill('4');
        await centerY.press('Tab');
        const geometry = () =>
            page.evaluate(() => {
                const frame = (window as any).app.activeFrame;
                return {
                    center: frame.center,
                    size: {
                        x: Number(frame.fovSize.x.toFixed(6)),
                        y: Number(frame.fovSize.y.toFixed(6)),
                    },
                    zoom: Number(frame.zoomLevel.toFixed(6)),
                };
            });
        await expect.poll(geometry).toMatchObject({ center: { x: 8, y: 4 } });
        const width = settingsField(pan, /^Size \(X\)/).getByRole('spinbutton');
        const height = settingsField(pan, /^Size \(Y\)/).getByRole(
            'spinbutton',
        );
        await width.fill('8');
        await width.press('Enter');
        await expect
            .poll(() => geometry().then((frame) => frame.size.x))
            .toBeCloseTo(8, 5);
        await height.fill('8');
        await height.press('Enter');
        await expect
            .poll(() => geometry().then((frame) => frame.size.y))
            .toBeCloseTo(8, 5);
        const validGeometry = await geometry();
        for (const input of [width, height]) {
            for (const invalid of ['0', '-1', '']) {
                await input.fill(invalid);
                await input.press('Enter');
                await expect.poll(geometry).toEqual(validGeometry);
            }
        }
        await centerX.fill('');
        await centerX.press('Enter');
        await expect(centerX).toHaveValue('8');
        await pan
            .getByRole('radiogroup')
            .getByText('World', { exact: true })
            .click();
        const wcsX = settingsField(pan, /^Center \(X\)/).getByRole('textbox');
        const validWcs = await wcsX.inputValue();
        await wcsX.fill('invalid');
        await wcsX.press('Tab');
        await expect(wcsX).toHaveValue(validWcs);
        await expect.poll(geometry).toEqual(validGeometry);
        await carta.closeWidget('image-view-floating-settings');
        await expect
            .poll(() => rasterRGBA(raster).then((pixel) => pixel[0]))
            .not.toBe(originalPixel[0]);
        const [red, green, blue, alpha] = await rasterRGBA(raster);
        expect({ red, green, blue, alpha }).toEqual({
            red,
            green: red,
            blue: red,
            alpha: 255,
        });
        expect(red).toBeGreaterThan(0);
        expect(red).toBeLessThan(255);
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-pan-zoom-edited.png');

        await viewerCanvas.hover();
        await page.getByTestId('overlay-coordinate-button').click();
        const offset = page.getByRole('checkbox', {
            name: 'Offset',
            exact: true,
        });
        await offset.check({ force: true });
        await page.getByRole('button', { name: 'Origin', exact: true }).click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame.skyRefIs),
            )
            .toBe(0);
        await page.getByRole('button', { name: 'Pole', exact: true }).click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame.skyRefIs),
            )
            .toBe(1);
        await page
            .getByRole('button', {
                name: 'Set pole to current view center',
                exact: true,
            })
            .click();
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.activeFrame.offsetCenter,
                ),
            )
            .toEqual(validGeometry.center);
        await page.keyboard.press('Escape');
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-offset-pole.png');
        await viewerCanvas.hover();
        await page.getByTestId('overlay-coordinate-button').click();
        await offset.uncheck({ force: true });
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.activeFrame.isOffsetCoord,
                ),
            )
            .toBe(false);
    });

    test('Overlay font controls reject invalid sizes and restore visibility', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        for (const [
            tab,
            section,
            label,
            fontProperty,
            sizeProperty,
            visibilityLabel,
        ] of [
            ['Title', 'title', 'Font', 'font', 'fontSize', 'Visible'],
            ['Numbers', 'numbers', 'Font', 'font', 'fontSize', 'Visible'],
            ['Labels', 'labels', 'Font', 'font', 'fontSize', 'Visible'],
            [
                'Colorbar',
                'colorbar',
                'Label font',
                'labelFont',
                'labelFontSize',
                'Label',
            ],
            [
                'Colorbar',
                'colorbar',
                'Numbers font',
                'numberFont',
                'numberFontSize',
                'Numbers',
            ],
        ]) {
            await page.getByTestId('image-view-header-settings-button').click();
            await page.getByRole('tab', { name: tab, exact: true }).click();
            const panel = page.getByRole('tabpanel', {
                name: tab,
                exact: true,
            });
            const visible = settingsField(
                panel,
                new RegExp(`^${visibilityLabel}$`),
            ).getByRole('checkbox');
            await visible.setChecked(true, { force: true });
            const font = settingsField(panel, new RegExp(`^${label}$`));
            const size = font.getByRole('spinbutton');
            const modelSize = () =>
                page.evaluate(
                    ({ section, sizeProperty }) =>
                        (window as any).app.overlaySettings[section][
                            sizeProperty
                        ],
                    { section, sizeProperty },
                );
            await size.fill('24');
            await expect.poll(modelSize).toBe(24);
            await font.getByRole('button', { name: 'decrement' }).click();
            await expect.poll(modelSize).toBe(23);
            await font.getByRole('button', { name: 'increment' }).click();
            await expect.poll(modelSize).toBe(24);
            for (const invalid of ['6', '97']) {
                await size.fill(invalid);
                await size.press('Tab');
                await expect.poll(modelSize).toBe(24);
            }
            await size.fill('24');
            const previousFont = await page.evaluate(
                ({ section, fontProperty }) =>
                    (window as any).app.overlaySettings[section][fontProperty],
                { section, fontProperty },
            );
            await font.getByRole('combobox').getByRole('button').click();
            await page
                .getByRole('menuitem', { name: 'times', exact: true })
                .click();
            await expect(
                font.getByRole('combobox').getByRole('button'),
            ).toHaveText('times');
            await expect
                .poll(() =>
                    page.evaluate(
                        ({ section, fontProperty }) =>
                            (window as any).app.overlaySettings[section][
                                fontProperty
                            ],
                        { section, fontProperty },
                    ),
                )
                .not.toBe(previousFont);
            await visible.uncheck({ force: true });
            await expect(size).toBeDisabled();
            await expect(
                font.getByRole('combobox').getByRole('button'),
            ).toBeDisabled();
            await visible.check({ force: true });
            await expect(size).toBeEnabled();
            await carta.closeWidget('image-view-floating-settings');
            await settleViewer(viewerCanvas);
            await snapshotViewer(
                viewerCanvas,
                `image-viewer-${section}-${fontProperty}.png`,
            );
        }
    });

    test('Colorbar bottom position, interaction, visibility, and invalid values', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar', exact: true }).click();
        const panel = page.getByRole('tabpanel', {
            name: 'Colorbar',
            exact: true,
        });
        for (const [label, property, valid, invalids] of [
            ['Width', 'width', '30', ['0', '101']],
            ['Offset', 'offset', '10', ['-1', '101']],
            ['Ticks density', 'tickDensity', '2', ['0', '21']],
        ] as const) {
            const input = settingsField(
                panel,
                new RegExp(`^${label}\\b`),
            ).getByRole('spinbutton');
            await input.fill(valid);
            for (const invalid of invalids) {
                await input.fill(invalid);
                await input.press('Tab');
                await expect
                    .poll(() =>
                        page.evaluate(
                            (property) =>
                                (window as any).app.overlaySettings.colorbar[
                                    property
                                ],
                            property,
                        ),
                    )
                    .toBe(Number(valid));
            }
            await input.fill(valid);
        }
        await settingsField(panel, /^Position$/)
            .getByRole('combobox')
            .selectOption('bottom');
        await settingsField(panel, /^Interactive$/)
            .getByRole('checkbox')
            .check({ force: true });
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.overlaySettings.colorbar.position,
                ),
            )
            .toBe('bottom');
        await settingsField(panel, /^Visible$/)
            .getByRole('checkbox')
            .uncheck({ force: true });
        await expect(
            settingsField(panel, /^Width\b/).getByRole('spinbutton'),
        ).toBeDisabled();
        await expect(
            settingsField(panel, /^Position$/).getByRole('combobox'),
        ).toBeDisabled();
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-colorbar-hidden.png');
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar', exact: true }).click();
        await settingsField(panel, /^Visible$/)
            .getByRole('checkbox')
            .check({ force: true });
        await carta.closeWidget('image-view-floating-settings');
        await page.locator('.colorbar-stage').hover();
        await expect(page.locator('.colorbar-info')).toContainText(
            /Colorscale:.* K/,
        );
        await expect(page.locator('.colorbar-info')).toBeVisible();
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-colorbar-bottom.png');
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar', exact: true }).click();
        await settingsField(panel, /^Interactive$/)
            .getByRole('checkbox')
            .uncheck({ force: true });
        await carta.closeWidget('image-view-floating-settings');
        await page.locator('.colorbar-stage').hover();
        await expect(page.locator('.colorbar-info')).toHaveCount(0);
    });

    test('Beam settings stay with their selected image', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('M17_SWex.fits');
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);
        const ids = await page.evaluate(() =>
            (window as any).app.frames.map((frame: any) => String(frame.id)),
        );
        const state = () =>
            page.evaluate(() =>
                (window as any).app.frames.map((frame: any) => ({
                    width: frame.overlayBeamSettings.width,
                    visible: frame.overlayBeamSettings.isVisible,
                })),
            );
        const original = await state();
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Beam', exact: true }).click();
        const beam = page.getByRole('tabpanel', { name: 'Beam', exact: true });
        const image = settingsField(beam, /^Image$/).getByRole('combobox');
        await image.selectOption(ids[0]);
        await settingsField(beam, /^Width\b/)
            .getByRole('spinbutton')
            .fill('5');
        await settingsField(beam, /^Visible$/)
            .getByRole('checkbox')
            .uncheck({ force: true });
        await expect
            .poll(state)
            .toEqual([{ width: 5, visible: false }, original[1]]);
        await image.selectOption(ids[1]);
        await expect(
            settingsField(beam, /^Width\b/).getByRole('spinbutton'),
        ).toHaveValue(String(original[1].width));
        await settingsField(beam, /^Width\b/)
            .getByRole('spinbutton')
            .fill('2');
        await expect.poll(state).toEqual([
            { width: 5, visible: false },
            { ...original[1], width: 2 },
        ]);
        await image.selectOption(ids[0]);
        await settingsField(beam, /^Visible$/)
            .getByRole('checkbox')
            .check({ force: true });
        await expect.poll(state).toEqual([
            { width: 5, visible: true },
            { ...original[1], width: 2 },
        ]);
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'image-viewer-beam-per-image.png');
    });

    test('Multi-panel pages preserve selection and stop at both boundaries', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        await carta.loadImage('matching-cube.fits', true);
        await carta.loadImage('single.fits', true);
        await page.evaluate(async () => {
            const app = (window as any).app;
            await app.preferenceStore.setPreference('imagePanelMode', 'fixed');
            await app.preferenceStore.setPreference('imagePanelColumns', 2);
            await app.preferenceStore.setPreference('imagePanelRows', 1);
        });
        const previous = page.getByTestId(
            'image-view-header-previous-page-button',
        );
        const next = page.getByTestId('image-view-header-next-page-button');
        const visibleFrames = () =>
            page.evaluate(() =>
                (window as any).app.imageViewConfigStore.visibleFrames.map(
                    (frame: any) => frame.filename,
                ),
            );
        await expect.poll(visibleFrames).toEqual(['single.fits']);
        await expect(next).toBeDisabled();
        await previous.click();
        await expect
            .poll(visibleFrames)
            .toEqual(['cube.fits', 'matching-cube.fits']);
        await expect(previous).toBeDisabled();
        await expect(next).toBeEnabled();
        await settleViewer(viewerCanvas);
        await snapshotViewer(
            viewerCanvas,
            'image-viewer-first-multi-panel-page.png',
        );
        await next.click();
        await expect.poll(visibleFrames).toEqual(['single.fits']);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'single.fits',
        );
        await expect(previous).toBeEnabled();
        await expect(next).toBeDisabled();
        await expect
            .poll(() =>
                rasterRGBA(page.locator('#raster-canvas').first()).then(
                    (pixel) => pixel[3],
                ),
            )
            .toBe(255);
        await settleViewer(viewerCanvas);
        await snapshotViewer(
            viewerCanvas,
            'image-viewer-last-multi-panel-page.png',
        );
    });
});

test.describe('Image Viewer', () => {
    test('Viewer header controls, layouts, help, and popout', async ({
        page,
        carta,
        viewerCanvas,
    }, testInfo) => {
        // Load test data cube
        await carta.loadImage('M17_SWex.fits');
        await useSinglePanel(page);
        await expect(viewerCanvas).toBeVisible();

        await viewerCanvas.hover();
        await expect(
            page.getByTestId('toolbar-distance-measuring-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('toolbar-catalog-selection-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('toolbar-region-moving-button'),
        ).toBeVisible();
        await expect(page.getByTestId('zoom-in-button')).toBeVisible();
        await expect(page.getByTestId('zoom-out-button')).toBeVisible();
        await expect(page.getByTestId('zoom-to-1x-fit-button')).toBeVisible();
        await expect(page.getByTestId('zoom-to-fit-button')).toBeVisible();
        await expect(page.getByTestId('match-button')).toBeVisible();
        await expect(
            page.getByTestId('overlay-coordinate-button'),
        ).toBeVisible();
        await expect(page.getByTestId('grid-button')).toBeVisible();
        await expect(page.getByTestId('toggle-labels-button')).toBeVisible();
        await expect(
            page.getByTestId('export-image-view-button'),
        ).toBeVisible();
        await expect(page.getByTestId('toggle-toolbar-button')).toBeVisible();

        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'M17_SWex.fits',
        );

        await expect(page.locator('.flexlayout__tab_toolbar').first())
            .toMatchAriaSnapshot(`
          - button ""
          - button "" [disabled]
          - button /[]/
          - button "" [disabled]
          - button ""
          - button ""
          - button "Pop out to a new window":
            - img
          - button "Maximise":
            - img
        `);

        await expect(
            page.getByTestId('image-view-header-channel-map-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-multipanel-view-switch'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-settings-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-help-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-popout-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-maximize-button'),
        ).toBeVisible();
        const panelSwitch = page.getByTestId(
            'image-view-header-multipanel-view-switch',
        );
        await expect(panelSwitch).toHaveAttribute(
            'title',
            'Switch to single panel',
        );
        await carta.screenShot(
            panelSwitch,
            'M17_SWex_viewer_multipanel_view_switch.png',
        );

        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);

        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        await expect(panelSwitch).toHaveAttribute(
            'title',
            'Switch to single panel',
        );
        await panelSwitch.click();
        await expect(panelSwitch).toHaveAttribute(
            'title',
            'Switch to multi-panel',
        );
        await carta.screenShot(
            panelSwitch,
            'M17_SWex_viewer_singlepanel_view_switch_button.png',
        );
        await expect(page.locator('.flexlayout__tab_toolbar').first())
            .toMatchAriaSnapshot(`
          - button ""
          - button ""
          - button /[]/
          - button "" [disabled]
          - button ""
          - button ""
          - button "Pop out to a new window":
            - img
          - button "Maximise":
            - img
        `);

        await snapshotViewer(
            viewerCanvas,
            'HD163296_13CO_2-1_subimage_viewer.png',
        );
        await expect(
            page.getByTestId('image-view-header-next-page-button'),
        ).toBeDisabled();
        await expect(
            page.getByTestId('image-view-header-previous-page-button'),
        ).toBeEnabled();
        await page
            .getByTestId('image-view-header-previous-page-button')
            .click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'M17_SWex.fits',
        );
        await snapshotViewer(viewerCanvas, 'M17_SWex_viewer.png');
        await page.getByTestId('image-view-header-next-page-button').click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        await page.evaluate(async () => {
            await (window as any).app.preferenceStore.setPreference(
                'imagePanelColumns',
                2,
            );
        });
        await page
            .getByTestId('image-view-header-multipanel-view-switch')
            .click();
        await carta.screenShot(
            page
                .locator('div')
                .filter({ hasText: /^HD163296_13CO_2-1_subimage\.fits$/ })
                .nth(1),
            'M17_SWex_viewer_multipanel.png',
        );

        await page.getByTestId('image-view-header-maximize-button').click();
        await settleViewer(viewerCanvas);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_multipanel_maximized.png',
        );
        await carta.screenShot(
            page.getByTestId('image-view-header-maximize-button'),
            'M17_SWex_viewer_maximized_button.png',
        );
        await page.getByTestId('image-view-header-channel-map-button').click();

        await carta.screenShot(
            page.locator('#overlay-canvas').nth(1),
            'M17_SWex_viewer_channel_map.png',
        );
        const help = page.getByTestId('image-view-header-help-button');
        await help.click();
        await expect(page.locator('.help-drawer')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.help-drawer')).toBeHidden();
        await page.getByTestId('image-view-header-maximize-button').click();
        await expect(page.locator('.flexlayout__tabset-maximized')).toHaveCount(
            0,
        );
        await page.getByTestId('image-view-header-channel-map-button').click();
        await useSinglePanel(page);
        const parentPixel = await rasterRGBA(
            page.locator('#raster-canvas').first(),
        );
        const popupPromise = page.waitForEvent('popup');
        await page.getByTestId('image-view-header-popout-button').click();
        const popup = await popupPromise;
        await popup.setViewportSize(page.viewportSize()!);
        await expect(popup.getByTestId('viewer-div')).toBeVisible();
        const popupRaster = popup.locator('#raster-canvas').first();
        await expect
            .poll(() => rasterRGBA(popupRaster).then((pixel) => pixel[3]))
            .toBe(255);
        const popupPixel = await rasterRGBA(popupRaster);
        for (const channel of [0, 1, 2])
            expect(
                Math.abs(popupPixel[channel] - parentPixel[channel]),
            ).toBeLessThanOrEqual(20);
        await testInfo.attach('viewer-popout.png', {
            body: await popup.getByTestId('viewer-div').screenshot(),
            contentType: 'image/png',
        });
        await popup.close();
    });

    test('Image viewer toolbar and region controls', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.setMultiPanelLayout(1, 2);
        // Load test data cube
        await carta.loadImage('M17_SWex.fits');

        await viewerCanvas.hover();

        await page.getByTestId('toolbar-distance-measuring-button').click();
        await viewerCanvas.dragTo(viewerCanvas, {
            sourcePosition: { x: 50, y: 50 },
            targetPosition: { x: 200, y: 150 },
        });

        await page.getByTestId('toolbar-region-creating-button').click();
        await page
            .locator('.bp6-popover-target.bp6-popover-open > .bp6-button')
            .click();
        await expect(
            page.getByText(
                'PointLineRectangleEllipsePolygonPolylineAnnotationsOpen sub menu',
            ),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Point"
            - menuitem "Line"
            - menuitem "Rectangle"
            - menuitem "Ellipse"
            - menuitem "Polygon"
            - menuitem "Polyline"
            - separator
            - menuitem "Annotations Open sub menu":
              - text: ""
              - img "Open sub menu"
        `);
        await page.getByRole('menuitem', { name: 'Ellipse' }).click();
        await viewerCanvas.dragTo(viewerCanvas, {
            sourcePosition: { x: 250, y: 200 },
            targetPosition: { x: 400, y: 300 },
        });
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_region_creating_ellipse.png',
        );
        await carta.screenShot(
            page.getByTestId('toolbar-region-creating-button'),
            'M17_SWex_viewer_toolbar_region_creating_button.png',
        );

        await page.getByTestId('toolbar-region-moving-button').click();
        await expect(
            page.getByTestId('toolbar-region-moving-button'),
        ).toHaveClass(/bp6-active/);
        await viewerCanvas.dragTo(viewerCanvas, {
            sourcePosition: { x: 500, y: 300 },
            targetPosition: { x: 200, y: 200 },
        });
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_moving.png',
        );

        await page.getByTestId('zoom-to-fit-button').click();
        const zoomLevel = () =>
            page.evaluate(() => (window as any).app.activeFrame.zoomLevel);
        const fitZoom = await zoomLevel();
        await page.getByTestId('zoom-in-button').click();
        await page.getByTestId('zoom-in-button').click();
        await expect.poll(zoomLevel).toBeCloseTo(fitZoom * 4, 6);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_in.png',
        );
        await page.getByTestId('zoom-out-button').click();
        await expect.poll(zoomLevel).toBeCloseTo(fitZoom * 2, 6);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_out.png',
        );
        await page.getByTestId('zoom-to-1x-fit-button').click();
        await expect.poll(zoomLevel).toBe(1);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_1x.png',
        );
        await page.getByTestId('zoom-to-fit-button').click();
        await expect.poll(zoomLevel).toBeCloseTo(fitZoom, 6);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_fit.png',
        );
        await page.getByTestId('grid-button').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.overlaySettings.grid.isVisible,
                ),
            )
            .toBe(true);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_grid_on.png',
        );
        await page.getByTestId('toggle-labels-button').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.overlaySettings.labels.isHidden,
                ),
            )
            .toBe(true);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_label_off.png',
        );

        await page.getByTestId('overlay-coordinate-button').click();
        await expect(page.getByText('WCSFK5FK4GALECLICRSIMGOffset'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "WCS"
            - menuitem "FK5"
            - menuitem "FK4"
            - menuitem "GAL"
            - menuitem "ECL"
            - menuitem "ICRS"
            - menuitem "IMG"
            - checkbox "Offset"
            - text: Offset
        `);
        await page.getByRole('menuitem', { name: 'GAL' }).click();
        await page.getByTestId('toggle-labels-button').click();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_coordinate_galactic.png',
        );

        await page.getByTestId('match-button').click();
        await expect(
            page.getByText(
                'Spectral (VRAD) and spatialSpectral (VRAD) onlySpatial onlyNone',
            ),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Spectral (VRAD) and spatial" [disabled]
            - menuitem "Spectral (VRAD) only" [disabled]
            - menuitem "Spatial only" [disabled]
            - menuitem "None" [disabled]
        `);

        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);
        await page.locator('#image-panel-1-0 .region-stage canvas').click({
            position: {
                x: 217,
                y: 122,
            },
        });

        await page
            .locator('#image-panel-1-0')
            .getByTestId('match-button')
            .click();
        await expect(
            page.getByText(
                'Spectral (VRAD) and spatialSpectral (VRAD) onlySpatial onlyNone',
            ),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Spectral (VRAD) and spatial"
            - menuitem "Spectral (VRAD) only"
            - menuitem "Spatial only"
            - menuitem "None"
        `);
    });

    test('Image viewer settings: pan and zoom', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const pan = page.locator('.panel-pan-and-zoom');
        // Load test data cube
        await carta.loadImage('M17_SWex.fits');
        await useSinglePanel(page);

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();

        await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
          - tablist:
            - tab "Pan and Zoom" [expanded] [selected]
            - tab "Global"
            - tab "Title"
            - tab "Ticks"
            - tab "Grids"
            - tab "Border"
            - tab "Axes"
            - tab "Numbers"
            - tab "Labels"
            - tab "Colorbar"
            - tab "Beam"
            - tab "Conversion" [disabled]
        `);

        await expect(
            page.getByRole('textbox', { name: 'X WCS coordinate' }),
        ).toHaveValue(/^\d+:\d+:\d+\.\d+$/);
        await expect(
            page.getByRole('textbox', { name: 'Y WCS coordinate' }),
        ).toHaveValue(/^-\d+:\d+:\d+\.\d+$/);
        await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await expect(page.getByRole('textbox', { name: 'Height' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await page
            .getByRole('radiogroup')
            .getByText('Image', { exact: true })
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'X Coordinate' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await expect(
            page.getByRole('spinbutton', { name: 'Y Coordinate' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await expect(
            page.getByRole('spinbutton', { name: 'Width' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await expect(
            page.getByRole('spinbutton', { name: 'Height' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await pan.getByRole('combobox').selectOption('ECLIPTIC');
        await pan
            .getByRole('radiogroup')
            .getByText('World', { exact: true })
            .click();
        await expect(
            page.getByRole('textbox', { name: 'X WCS coordinate' }),
        ).toHaveValue(/^\d+\.\d+$/);
        await expect(
            page.getByRole('textbox', { name: 'Y WCS coordinate' }),
        ).toHaveValue(/^[-\d]+\.\d+$/);
        await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await expect(page.getByRole('textbox', { name: 'Height' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await pan.getByRole('combobox').selectOption('CARTESIAN');
        await expect(
            page.getByRole('textbox', { name: 'X WCS coordinate' }),
        ).toBeEmpty();
        await expect(page.getByRole('textbox', { name: 'Width' })).toBeEmpty();

        await settingsField(pan, /^Offset coordinates$/)
            .getByRole('checkbox')
            .click({ force: true });
        await pan.getByRole('combobox').selectOption('GALACTIC');
        const xCoordinates = page.getByRole('textbox', {
            name: 'X WCS coordinate',
        });
        const yCoordinates = page.getByRole('textbox', {
            name: 'Y WCS coordinate',
        });
        const centerX = xCoordinates.first();
        const centerY = yCoordinates.first();
        const offsetX = xCoordinates.nth(1);
        const offsetY = yCoordinates.nth(1);
        await expect(centerX).toHaveValue(/^\d+\.\d+$/);
        await expect(centerY).toHaveValue(/^[-\d]+\.\d+$/);
        await offsetX.fill('10');
        await offsetX.press('Tab');
        await expect
            .poll(async () => Number(await offsetX.inputValue()))
            .toBeCloseTo(10, 6);
        await offsetY.fill('10');
        await offsetY.press('Tab');
        await expect
            .poll(async () => Number(await offsetX.inputValue()))
            .toBeCloseTo(10, 6);
        await expect
            .poll(async () => Number(await offsetY.inputValue()))
            .toBeCloseTo(10, 6);
        await carta.closeWidget('image-view-floating-settings');
        await expect(page.locator('.image-view-settings')).toBeHidden();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_offset_galactic.png',
            { maxDiffPixelRatio: 0.02 },
        );

        await page.getByTestId('image-view-header-settings-button').click();
        await expect(page.locator('.image-view-settings')).toBeVisible();
        await settingsField(pan, /^Offset coordinates$/)
            .getByRole('button')
            .click();
        await expect(offsetX).toHaveValue(await centerX.inputValue());
        await expect(offsetY).toHaveValue(await centerY.inputValue());
        await carta.closeWidget('image-view-floating-settings');
        await expect(page.locator('.image-view-settings')).toBeHidden();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_de_offset_galactic.png',
            { maxDiffPixelRatio: 0.02 },
        );
    });

    test('Image viewer settings: global', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const global = page.getByRole('tabpanel', {
            name: 'Global',
            exact: true,
        });
        // set to default multi-panel layout

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();

        await page.getByRole('tab', { name: 'Global' }).click();
        await expect(page.getByLabel('Global')).toMatchAriaSnapshot(`
          - tabpanel "Global":
            - text: Enable multi-panel
            - checkbox [checked]
            - text: Multi-panel mode
            - combobox:
              - option "Dynamic grid size" [selected]
              - option "Fixed grid size"
            - img "Open dropdown"
            - text: Columns (Maximum)
            - group:
              - spinbutton "Columns"
              - button "increment"
              - button "decrement"
            - text: Rows (Maximum)
            - group:
              - spinbutton "Rows"
              - button "increment"
              - button "decrement"
            - text: Overlay color
            - combobox:
              - button
            - text: Tolerance (%)
            - group:
              - spinbutton "Tolerance"
              - button "increment"
              - button "decrement"
            - text: Labelling
            - combobox:
              - option "Interior"
              - option "Exterior" [selected]
            - img "Open dropdown"
            - text: Coordinate system
            - combobox:
              - option "Auto" [selected]
              - option "Ecliptic"
              - option "FK4"
              - option "FK5"
              - option "Galactic"
              - option "ICRS"
              - option "Image"
            - img "Open dropdown"
          `);

        await settingsField(global, /^Enable multi-panel$/)
            .getByRole('checkbox')
            .click({ force: true });
        await expect(page.getByLabel('Global')).toMatchAriaSnapshot(`
            - tabpanel "Global":
              - text: Enable multi-panel
              - checkbox
              - text: Multi-panel mode
              - combobox [disabled]:
                - option "Dynamic grid size" [selected]
                - option "Fixed grid size"
              - img "Open dropdown"
              - text: Columns (Maximum)
              - group:
                - spinbutton "Columns" [disabled]
                - button "increment" [disabled]
                - button "decrement" [disabled]
              - text: Rows (Maximum)
              - group:
                - spinbutton "Rows" [disabled]
                - button "increment" [disabled]
                - button "decrement" [disabled]
              - text: Overlay color
              - combobox:
                - button
              - text: Tolerance (%)
              - group:
                - spinbutton "Tolerance"
                - button "increment"
                - button "decrement"
              - text: Labelling
              - combobox:
                - option "Interior"
                - option "Exterior" [selected]
              - img "Open dropdown"
              - text: Coordinate system
              - combobox:
                - option "Auto" [selected]
                - option "Ecliptic"
                - option "FK4"
                - option "FK5"
                - option "Galactic"
                - option "ICRS"
                - option "Image"
              - img "Open dropdown"
            `);

        await carta.screenShot(
            page.getByTestId('image-view-header-multipanel-view-switch'),
            'M17_SWex_viewer_settings_multi_panel_button.png',
        );

        await settingsField(global, /^Enable multi-panel$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(global, /^Multi-panel mode$/)
            .getByRole('combobox')
            .selectOption('fixed');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_2x2.png',
        );

        await page
            .getByLabel('Global')
            .getByRole('button', { name: 'increment' })
            .first()
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'Columns' }),
        ).toHaveValue('3');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_2x3.png',
        );
        await page
            .getByLabel('Global')
            .getByRole('button', { name: 'decrement' })
            .nth(1)
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'Rows' }),
        ).toHaveValue('1');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_1x3.png',
        );

        await settingsField(global, /^Overlay color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(4) > .bp6-menu-item').click();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_1x3_color.png',
        );

        await settingsField(global, /^Labelling$/)
            .getByRole('combobox')
            .selectOption('Interior');
        await settingsField(global, /^Multi-panel mode$/)
            .getByRole('combobox')
            .selectOption('dynamic');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_interior_label.png',
        );

        await settingsField(global, /^Coordinate system$/)
            .getByRole('combobox')
            .selectOption('ECLIPTIC');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_coord_ecliptic.png',
        );
    });

    test('Image viewer settings: title and ticks', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const title = page.getByRole('tabpanel', {
            name: 'Title',
            exact: true,
        });
        const ticks = page.getByRole('tabpanel', {
            name: 'Ticks',
            exact: true,
        });
        // set to default multi-panel layout

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();

        await page.getByRole('tab', { name: 'Title' }).click();
        await expect(page.getByLabel('Title')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox
          - text: Font
          - combobox [disabled]:
            - button "bold sans-serif" [disabled]
          - group:
            - spinbutton "Font size" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Custom text
          - checkbox [disabled]
          - text: Custom color
          - checkbox [disabled]
          `);

        await settingsField(title, /^Visible$/)
            .getByRole('checkbox')
            .click({ force: true });
        await expect(page.getByLabel('Title')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Font
          - combobox:
            - button "bold sans-serif"
          - group:
            - spinbutton "Font size"
            - button "increment"
            - button "decrement"
          - text: Custom text
          - checkbox
          - text: Custom color
          - checkbox
          `);

        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_title_on.png',
        );
        await settingsField(title, /^Custom text$/)
            .getByRole('checkbox')
            .click({ force: true });
        await page
            .getByRole('textbox', { name: 'Enter title text' })
            .fill('I am Title');
        await settingsField(title, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(title, /^Color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(3) > .bp6-menu-item').click();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_custom_title.png',
        );

        await settingsField(title, /^Visible$/)
            .getByRole('checkbox')
            .click({ force: true });

        await page.getByRole('tab', { name: 'Ticks' }).click();
        await expect(page.getByLabel('Ticks')).toMatchAriaSnapshot(`
          - tabpanel "Ticks":
            - text: Draw on all edges
            - checkbox [checked]
            - text: Custom density
            - checkbox
            - text: Custom color
            - checkbox
            - text: Width (px)
            - group:
              - spinbutton "Width"
              - button "increment"
              - button "decrement"
            - text: Minor length (%)
            - group:
              - spinbutton "Length"
              - button "increment"
              - button "decrement"
            - text: Major length (%)
            - group:
              - spinbutton "Length"
              - button "increment"
              - button "decrement"
          `);
        await settingsField(ticks, /^Draw on all edges$/)
            .getByRole('checkbox')
            .click({ force: true });
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_all_edges_off.png',
        );
        await settingsField(ticks, /^Custom density$/)
            .getByRole('checkbox')
            .click({ force: true });
        await ticks
            .getByRole('spinbutton', { name: 'Density' })
            .nth(0)
            .fill('10');
        await ticks
            .getByRole('spinbutton', { name: 'Density' })
            .nth(1)
            .fill('2');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_custom_density.png',
        );
        await settingsField(ticks, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(ticks, /^Color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(2) > .bp6-menu-item').click();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_custom_color.png',
            { maxDiffPixelRatio: 0.02 },
        );
        await page.getByRole('spinbutton', { name: 'Width' }).fill('3');
        await ticks
            .getByRole('spinbutton', { name: 'Length' })
            .nth(0)
            .fill('4');
        await ticks
            .locator('.bp6-form-group')
            .filter({ hasText: 'Major length (%)' })
            .getByRole('button', { name: 'decrement' })
            .click();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_custom_width.png',
        );
    });

    test('Image viewer settings: grid', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const grids = page.getByRole('tabpanel', {
            name: 'Grids',
            exact: true,
        });
        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Grid' }).click();

        await expect(page.getByLabel('Grids')).toMatchAriaSnapshot(`
          - text: WCS grid
          - checkbox
          - text: Custom color
          - checkbox [disabled]
          - text: Width (px)
          - group:
            - spinbutton "Width" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Custom gap
          - checkbox [disabled]
          - text: Pixel grid
          - checkbox
          - text: Pixel grid color
          - combobox:
            - button
          `);

        await settingsField(grids, /^WCS grid$/)
            .getByRole('checkbox')
            .click({ force: true });
        await snapshotViewer(viewerCanvas, 'M17_SWex_viewer_settings_grid.png');

        await settingsField(grids, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(grids, /^Color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(9) > .bp6-menu-item').click();
        await page
            .getByTestId(
                'image-view-settings-grid-width-input-increment-button',
            )
            .click();
        await page
            .getByTestId(
                'image-view-settings-grid-width-input-increment-button',
            )
            .click();
        await expect(
            page.getByTestId('image-view-settings-grid-width-input'),
        ).toHaveValue('2');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_grid_color.png',
        );

        await carta.setSystem('CARTESIAN');
        await settingsField(grids, /^Custom gap$/)
            .getByRole('checkbox')
            .click({ force: true });
        await grids.getByRole('spinbutton', { name: 'Gap' }).nth(0).fill('100');
        await grids.getByRole('spinbutton', { name: 'Gap' }).nth(1).fill('50');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_grid_gap.png',
        );

        await settingsField(grids, /^WCS grid$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(grids, /^Pixel grid$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(grids, /^Pixel grid color$/)
            .getByRole('button')
            .click();
        await page
            .getByRole('listbox', { name: 'selectable options' })
            .getByRole('menuitem')
            .nth(8)
            .click();
        await carta.setZoom(0, 25);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_pixel_grid.png',
        );
    });

    test('Image viewer settings: border and axes', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const border = page.getByRole('tabpanel', {
            name: 'Border',
            exact: true,
        });
        const axes = page.getByRole('tabpanel', { name: 'Axes', exact: true });
        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Border' }).click();

        await expect(page.getByLabel('Border')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Custom color
          - checkbox
          - text: Width (px)
          - group:
            - spinbutton "Width"
            - button "increment"
            - button "decrement"
          `);
        await settingsField(border, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(border, /^Color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(6) > .bp6-menu-item').click();
        await page
            .getByLabel('Border')
            .getByRole('button', { name: 'increment' })
            .click();
        await page
            .getByLabel('Border')
            .getByRole('button', { name: 'increment' })
            .click();

        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_border.png',
        );

        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Axes' }).click();
        await expect(page.getByLabel('Axes')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [disabled]
          - text: Does not apply to exterior labelling. Custom color
          - checkbox [disabled]
          - text: Width (px)
          - group:
            - spinbutton "Width" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Does not apply to exterior labelling.
          `);

        await carta.setLabelType('Interior');
        await settingsField(axes, /^Visible$/)
            .getByRole('checkbox')
            .click({ force: true });
        await expect(page.getByLabel('Axes')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Custom color
          - checkbox
          - text: Width (px)
          - group:
            - spinbutton "Width"
            - button "increment"
            - button "decrement"
          `);
        await settingsField(axes, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(axes, /^Color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(3) > .bp6-menu-item').click();
        await page
            .getByLabel('Axes')
            .getByRole('button', { name: 'increment' })
            .click();
        await page
            .getByLabel('Axes')
            .getByRole('button', { name: 'increment' })
            .click();

        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'M17_SWex_viewer_settings_axes.png');
    });

    test('Image viewer settings: numbers and labels', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const numbers = page.getByRole('tabpanel', {
            name: 'Numbers',
            exact: true,
        });
        const labels = page.getByRole('tabpanel', {
            name: 'Labels',
            exact: true,
        });
        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Numbers' }).click();

        await expect(page.getByLabel('Numbers')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Font
          - combobox:
            - button "sans-serif"
          - group:
            - spinbutton "Font size"
            - button "increment"
            - button "decrement"
          - text: Custom color
          - checkbox
          - text: Custom format
          - checkbox
          - text: Custom precision
          - checkbox
          `);

        await settingsField(numbers, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(numbers, /^Color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(2) > .bp6-menu-item').click();
        await settingsField(numbers, /^Custom format$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(numbers, /^Format \(X\)$/)
            .getByRole('combobox')
            .selectOption('d');
        await settingsField(numbers, /^Format \(Y\)$/)
            .getByRole('combobox')
            .selectOption('d');
        await settingsField(numbers, /^Custom precision$/)
            .getByRole('checkbox')
            .click({ force: true });
        const numberPrecision = page
            .getByLabel('Numbers')
            .locator('.bp6-form-group')
            .filter({ hasText: 'Precision' });
        await numberPrecision
            .getByRole('button', { name: 'decrement' })
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'Precision' }),
        ).toHaveValue('2');

        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_numbers.png',
            { maxDiffPixelRatio: 0.02 },
        );

        // Open image viewer settings - Labels tab
        await page.getByRole('tab', { name: 'Labels' }).click();
        await expect(page.getByLabel('Labels')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Font
          - combobox:
            - button "sans-serif"
          - group:
            - spinbutton "Font size"
            - button "increment"
            - button "decrement"
          - text: Show RA/Dec reference
          - checkbox [checked]
          - text: Custom text
          - checkbox
          - text: Custom color
          - checkbox
          `);

        await settingsField(labels, /^Show RA\/Dec reference$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(labels, /^Custom text$/)
            .getByRole('checkbox')
            .click({ force: true });
        await page
            .getByRole('textbox', { name: 'Enter label text' })
            .first()
            .fill('IamRA');
        await page
            .getByRole('textbox', { name: 'Enter label text' })
            .nth(1)
            .fill('WeAreDEC');
        await settingsField(labels, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(labels, /^Color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(2) > .bp6-menu-item').click();

        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_labels.png',
        );
    });

    test('Image viewer settings: colorbar', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const colorbarCanvas = page.locator('.colorbar-stage canvas').first();

        const colorbar = page.getByRole('tabpanel', {
            name: 'Colorbar',
            exact: true,
        });
        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar' }).click();

        await expect(page.getByLabel('Colorbar')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Interactive
          - checkbox [checked]
          - text: Position
          - combobox:
            - option "Right" [selected]
            - option "Top"
            - option "Bottom"
          - img "Open dropdown"
          - text: Width (px)
          - group:
            - spinbutton "Width"
            - button "increment"
            - button "decrement"
          - text: Offset (px)
          - group:
            - spinbutton "Offset"
            - button "increment"
            - button "decrement"
          - text: Ticks density (per 100px)
          - group:
            - spinbutton "Ticks density"
            - button "increment"
            - button "decrement"
          - text: Custom color
          - checkbox
          - separator
          - text: Label
          - checkbox
          - text: Label rotation
          - combobox [disabled]:
            - option /-\\d+/ [selected]
            - option /\\d+/
          - img "Open dropdown"
          - text: Label font
          - combobox [disabled]:
            - button "sans-serif" [disabled]
          - group:
            - spinbutton [disabled]: /\\d+/
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Label custom text
          - checkbox [disabled]
          - text: Label custom color
          - checkbox [disabled]
          - separator
          - text: Numbers
          - checkbox [checked]
          - text: Numbers rotation
          - combobox:
            - option /-\\d+/ [selected]
            - option "0"
            - option /\\d+/
          - img "Open dropdown"
          - text: Numbers font
          - combobox:
            - button "sans-serif"
          - group:
            - spinbutton: /\\d+/
            - button "increment"
            - button "decrement"
          - text: Numbers custom precision
          - checkbox
          - text: Numbers custom color
          - checkbox
          - separator
          - text: Ticks
          - checkbox [checked]
          - text: Ticks length (px)
          - group:
            - spinbutton "Ticks length"
            - button "increment"
            - button "decrement"
          - text: Ticks width (px)
          - group:
            - spinbutton "Ticks width"
            - button "increment"
            - button "decrement"
          - text: Ticks custom color
          - checkbox
          - separator
          - text: Border
          - checkbox [checked]
          - text: Border width (px)
          - group:
            - spinbutton "Border width"
            - button "increment"
            - button "decrement"
          - text: Border custom color
          - checkbox
          `);

        await settingsField(colorbar, /^Interactive$/)
            .getByRole('checkbox')
            .click({ force: true });
        await page
            .getByLabel('Colorbar')
            .getByRole('combobox')
            .first()
            .selectOption('top');
        await expect(page.getByLabel('Colorbar')).toMatchAriaSnapshot(`
          - text: Label rotation
          - combobox [disabled]:
            - option /-\\d+/ [selected]
            - option /\\d+/
          - img "Open dropdown"
          `);
        await page
            .getByRole('spinbutton', { name: 'Width', exact: true })
            .fill('30');
        await page.getByRole('spinbutton', { name: 'Offset' }).fill('10');
        await page.getByRole('spinbutton', { name: 'Ticks density' }).fill('2');
        await settingsField(colorbar, /^Custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(colorbar, /^color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(3) > .bp6-menu-item').click();
        await page.locator('.colorbar-stage').click({
            position: {
                x: 384,
                y: 37,
            },
        });
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_colorbar_position.png',
            { maxDiffPixelRatio: 0.02 },
        );

        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar', exact: true }).click();
        await settingsField(colorbar, /^Label$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(colorbar, /^Label custom text$/)
            .getByRole('checkbox')
            .click({ force: true });
        await page.getByRole('textbox', { name: 'Enter label text' }).click();
        await page
            .getByRole('textbox', { name: 'Enter label text' })
            .fill('LabelLabel');
        await settingsField(colorbar, /^Label custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(colorbar, /^Label color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(5) > .bp6-menu-item').click();
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await carta.screenShot(
            colorbarCanvas,
            'M17_SWex_viewer_settings_colorbar_label.png',
        );

        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar', exact: true }).click();
        await page
            .getByLabel('Colorbar')
            .getByRole('combobox')
            .first()
            .selectOption('right');
        await settingsField(colorbar, /^Numbers rotation$/)
            .getByRole('combobox')
            .selectOption('0');
        await settingsField(colorbar, /^Numbers custom precision$/)
            .getByRole('checkbox')
            .click({ force: true });
        const colorbarPrecision = page
            .getByLabel('Colorbar')
            .locator('.bp6-form-group')
            .filter({ hasText: 'Numbers precision' });
        await colorbarPrecision
            .getByRole('button', { name: 'decrement' })
            .click();
        await expect(colorbarPrecision.getByRole('spinbutton')).toHaveValue(
            '2',
        );
        await settingsField(colorbar, /^Numbers custom color$/)
            .getByRole('checkbox')
            .click({ force: true });
        await settingsField(colorbar, /^Numbers color$/)
            .getByRole('button')
            .click();
        await page.locator('li:nth-child(7) > .bp6-menu-item').click();
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await expect(colorbarCanvas).toHaveScreenshot(
            'M17_SWex_viewer_settings_colorbar_numbers.png',
            { maxDiffPixelRatio: 0.02 },
        );

        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar', exact: true }).click();
        await settingsField(colorbar, /^Numbers$/)
            .getByRole('checkbox')
            .click({ force: true });
        await expect(page.getByText('Numbers rotation -90090Open'))
            .toMatchAriaSnapshot(`
          - text: Numbers rotation
          - combobox [disabled]:
            - option /-\\d+/
            - option "0" [selected]
            - option /\\d+/
          - img "Open dropdown"
          `);

        await expect(settingsField(colorbar, /^Numbers precision$/))
            .toMatchAriaSnapshot(`
            - text: Numbers precision
            - group:
              - spinbutton [disabled]: "2"
              - button "increment" [disabled]
              - button "decrement" [disabled]
            `);

        await page.getByRole('spinbutton', { name: 'Ticks length' }).fill('10');
        await page.getByRole('spinbutton', { name: 'Ticks width' }).fill('5');
        await page.getByRole('spinbutton', { name: 'Border width' }).fill('3');
        await carta.closeWidget('image-view-floating-settings');
        await settleViewer(viewerCanvas);
        await carta.screenShot(
            colorbarCanvas,
            'M17_SWex_viewer_settings_colorbar_ticks.png',
        );
    });

    test('Image viewer settings: beam', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const beam = page.getByRole('tabpanel', { name: 'Beam', exact: true });
        // set to default preferences
        await carta.setMultiPanelLayout();
        await carta.enablePixelGrid(false);
        await carta.setLabelType('Exterior');

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Beam' }).click();

        await carta.setZoom(0, 15);

        await settingsField(beam, /^Color$/)
            .getByRole('button')
            .click();
        await page
            .getByRole('menuitem')
            .filter({
                has: page.locator('.dropdown-color[style*="rgb(37, 42, 49)"]'),
            })
            .click();
        await settingsField(beam, /^Type$/)
            .getByRole('combobox')
            .selectOption('solid');
        await page.getByRole('spinbutton', { name: 'Width' }).click();
        await page.getByRole('spinbutton', { name: 'Width' }).fill('5');
        await page.getByRole('spinbutton', { name: 'Position (X)' }).fill('10');
        await page.getByRole('spinbutton', { name: 'Position (Y)' }).fill('30');
        await page
            .getByRole('spinbutton', { name: 'Position (Y)' })
            .press('Tab');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const settings = (window as any).app.activeFrame
                        .overlayBeamSettings;
                    return {
                        visible: settings.isVisible,
                        type: settings.type,
                        width: settings.width,
                        x: settings.shiftX,
                        y: settings.shiftY,
                    };
                }),
            )
            .toEqual({ visible: true, type: 'solid', width: 5, x: 10, y: 30 });
        const beamPixels = () =>
            viewerCanvas
                .locator('.beam-profile-stage canvas')
                .evaluate((canvas: HTMLCanvasElement) => {
                    const pixels = canvas
                        .getContext('2d')!
                        .getImageData(0, 0, canvas.width, canvas.height).data;
                    let count = 0;
                    for (let offset = 0; offset < pixels.length; offset += 4) {
                        if (
                            pixels[offset] === 37 &&
                            pixels[offset + 1] === 42 &&
                            pixels[offset + 2] === 49 &&
                            pixels[offset + 3] === 255
                        )
                            count++;
                    }
                    return count;
                });
        await expect.poll(beamPixels).toBeGreaterThan(0);
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'M17_SWex_viewer_settings_beam.png');

        await settingsField(beam, /^Visible$/)
            .getByRole('checkbox')
            .click({ force: true });
        await expect(
            settingsField(beam, /^Visible$/).getByRole('checkbox'),
        ).not.toBeChecked();
        await expect(
            viewerCanvas.locator('.beam-profile-stage canvas'),
        ).toHaveCount(0);
        await settleViewer(viewerCanvas);
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_viewer_settings_no_beam.png',
        );
    });

    test('Raster configuration', async ({ page, carta }) => {
        const viewerCanvas = page.locator(
            '.region-stage > .konvajs-content > canvas',
        );
        const histogramCanvas = page
            .locator('.annotation-stage > .konvajs-content > canvas')
            .first();

        // Load test data cube
        await carta.loadImage('M17_SWex.fits');
        const renderConfigContent = page.getByTestId('render-config-0-content');
        if (!(await renderConfigContent.isVisible())) {
            await page.getByTestId('render-config-0-header-title').click();
        }
        await expect(renderConfigContent).toBeVisible();
        const renderedPixels = () =>
            page
                .locator('#raster-canvas')
                .first()
                .evaluate((source: HTMLCanvasElement) => {
                    const sample = document.createElement('canvas');
                    sample.width = sample.height = 8;
                    const context = sample.getContext('2d')!;
                    context.drawImage(source, 0, 0, 8, 8);
                    return Array.from(context.getImageData(0, 0, 8, 8).data);
                });
        const selectColormap = async (name: string) => {
            const previous = await renderedPixels();
            await renderConfigContent.getByTestId('colormap-dropdown').click();
            const item = page.getByRole('menuitem', { name, exact: true });
            // Keyboard selection avoids hover previews moving the menu beneath the pointer.
            await item.focus();
            await item.press('Enter');
            await expect(item).toBeHidden();
            await page.mouse.move(0, 0);
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame.renderConfig
                                .colorMap,
                    ),
                )
                .toBe(name);
            await expect.poll(renderedPixels).not.toEqual(previous);
        };

        // set channel to 8 and take screenshots of different rendering modes and colormaps
        await carta.setChannel(0, 8);
        await page.getByRole('button', { name: 'Linear' }).click();
        await page.getByRole('menuitem', { name: 'Log' }).click();
        await page.getByTestId('clip-button-99.99').click();
        await snapshotViewer(viewerCanvas, 'M17_SWex_channel8_log_99.99.png');
        await page.getByTestId('clip-button-99').click();
        await snapshotViewer(viewerCanvas, 'M17_SWex_channel8_log_99.png');
        await settingsField(renderConfigContent, /^Alpha/)
            .getByRole('spinbutton')
            .fill('100');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_log_99_alpha100.png',
        );
        await expect(histogramCanvas).toHaveScreenshot(
            'M17_SWex_channel8_log_99_alpha100_hist.png',
            { maxDiffPixelRatio: 0.05 },
        );

        await page.getByRole('button', { name: 'Log' }).click();
        await page.getByRole('menuitem', { name: 'Square root' }).click();
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_square_root_99.png',
        );
        await settingsField(renderConfigContent, /^Invert colormap$/)
            .getByRole('checkbox')
            .click({ force: true });
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_square_root_99_invert.png',
        );

        await page.getByRole('button', { name: 'Square root' }).click();
        await page.getByRole('menuitem', { name: 'Squared' }).click();
        await snapshotViewer(viewerCanvas, 'M17_SWex_channel8_square_99.png');
        await selectColormap('cubehelix');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_square_99_cubehelix.png',
        );
        await selectColormap('gnuplot2');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_square_99_gnuplot2.png',
        );
        await carta.screenShot(
            page.locator('.colorbar-stage canvas').first(),
            'gnuplot2_colorbar.png',
        );
        await selectColormap('custom');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_square_99_custom.png',
        );

        await page.getByRole('button', { name: 'Squared' }).click();
        await page.getByRole('menuitem', { name: 'Gamma' }).click();

        const gammaInput = settingsField(
            renderConfigContent,
            /^Gamma$/,
        ).getByRole('spinbutton');
        await gammaInput.fill('1.5');
        await gammaInput.press('Enter');

        await selectColormap('seismic');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_gamma_99_gamma_1.5_seismic.png',
        );
        await page.getByTestId('clip-button-99.99').click();

        await page.getByRole('button', { name: 'Bias / Contrast' }).click();
        const contrastControls = settingsField(
            renderConfigContent,
            /^Contrast$/,
        );
        const contrastDecrement = contrastControls.getByRole('button', {
            name: 'decrement',
        });
        const contrastIncrement = contrastControls.getByRole('button', {
            name: 'increment',
        });
        for (let i = 0; i < 5; i++) await contrastDecrement.click();
        for (let i = 0; i < 6; i++) await contrastIncrement.click();
        await carta.screenShot(
            page.locator('.bias-contrast-stage > .konvajs-content > canvas'),
            'bias.png',
        );
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_gamma_99.99_gamma_1.5_seismic_bias.png',
        );
        await carta.screenShot(
            histogramCanvas,
            'M17_SWex_channel8_gamma_99.99_gamma_1.5_seismic_bias_hist.png',
        );
        await carta.screenShot(
            page.locator('.colorbar-stage canvas').first(),
            'seismic_colorbar.png',
        );

        await page.getByRole('button', { name: 'Gamma', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Power' }).click();

        await settingsField(renderConfigContent, /^Bias$/)
            .locator('.bp6-input-action > button')
            .click();
        await contrastControls.locator('.bp6-input-action > button').click();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const { bias, contrast } = (window as any).app.activeFrame
                        .renderConfig;
                    return { bias, contrast };
                }),
            )
            .toEqual({ bias: 0, contrast: 1 });
        await page.getByTestId('clip-button-99.5').click();
        await selectColormap('gist_stern');
        await settingsField(renderConfigContent, /^Alpha/)
            .getByRole('spinbutton')
            .fill('10');
        await snapshotViewer(
            viewerCanvas,
            'M17_SWex_channel8_power_99.5_alpha_10_gist_stern.png',
        );
    });
});

async function axisPixelRgb(page: Page, x: number, y: number) {
    return page
        .locator('#raster-canvas')
        .first()
        .evaluate(
            (canvas: HTMLCanvasElement, point) => {
                const view = (window as any).app.activeFrame.requiredFrameView;
                const px = Math.floor(
                    ((point.x - view.xMin) / (view.xMax - view.xMin)) *
                        canvas.width,
                );
                const py = Math.floor(
                    ((view.yMax - point.y) / (view.yMax - view.yMin)) *
                        canvas.height,
                );
                return Array.from(
                    canvas.getContext('2d')!.getImageData(px, py, 1, 1).data,
                );
            },
            { x, y },
        );
}

// PR #2853: exercise DOM events and canvas rendering beyond the zoom unit tests.
test.describe('Independent axis zoom', () => {
    for (const kind of ['pv', 'swapped'] as const) {
        test(`${kind}: axis controls, wheel, size edits and resets`, async ({
            page,
            carta,
            viewerCanvas,
        }) => {
            await carta.loadImage(`wcs-${kind}-clean.fits`);
            await useSinglePanel(page);
            const geometry = () =>
                page.evaluate(() => {
                    const frame = (window as any).app.activeFrame;
                    return {
                        zoom: { ...frame.effectiveZoomLevel },
                        axis: frame.zoomAxis,
                        center: { ...frame.center },
                        size: { ...frame.fovSize },
                    };
                });
            await viewerCanvas.hover();
            const selector = page.getByTestId('pv-zoom-axis-button');
            await expect(selector).toBeVisible();
            expect((await geometry()).axis).toBe(kind === 'pv' ? 'y' : 'x');
            const fit = await geometry();
            const sampleX = kind === 'swapped' ? 2 : 8;
            const expectedValue = await pixel(page, sampleX, 8);
            expect(Number.isFinite(expectedValue)).toBe(true);
            for (const axis of ['x', 'y'] as const) {
                await selector.click();
                await page.getByTestId(`pv-zoom-axis-${axis}`).click();
                await expect
                    .poll(() => geometry().then((g) => g.axis))
                    .toBe(axis);
                const before = await geometry();
                await page.getByTestId('zoom-in-button').click();
                await expect
                    .poll(() => geometry().then((g) => g.zoom))
                    .toEqual({
                        x: before.zoom.x * (axis === 'x' ? 2 : 1),
                        y: before.zoom.y * (axis === 'y' ? 2 : 1),
                    });
                await page.getByTestId('zoom-out-button').click();
                await expect
                    .poll(() => geometry().then((g) => g.zoom))
                    .toEqual(before.zoom);
            }
            const stage = viewerCanvas.locator('.region-stage canvas').first();
            await stage.hover({ position: { x: 200, y: 200 } });
            await page.mouse.wheel(0, -100);
            await expect
                .poll(() => geometry().then((g) => g.zoom.y))
                .toBeGreaterThan(fit.zoom.y);
            expect((await geometry()).zoom.x).toBe(fit.zoom.x);
            expect((await geometry()).center.x).toBeCloseTo(fit.center.x, 8);
            const wheel = await geometry();
            await page.keyboard.down('Shift');
            try {
                await page.mouse.wheel(0, -200);
            } finally {
                await page.keyboard.up('Shift');
            }
            await expect
                .poll(() => geometry().then((g) => g.zoom.x))
                .toBeGreaterThan(wheel.zoom.x);
            expect((await geometry()).zoom.y).toBe(wheel.zoom.y);
            expect((await geometry()).center.y).toBeCloseTo(wheel.center.y, 8);
            const beforePan = await geometry();
            await stage.hover({ position: { x: 200, y: 200 } });
            const bounds = (await stage.boundingBox())!;
            await page.mouse.down({ button: 'middle' });
            try {
                await page.mouse.move(bounds.x + 220, bounds.y + 210, {
                    steps: 5,
                });
            } finally {
                await page.mouse.up({ button: 'middle' });
            }
            await expect
                .poll(() => geometry().then((g) => g.center.x))
                .not.toBe(beforePan.center.x);
            await expect
                .poll(() => geometry().then((g) => g.center.y))
                .not.toBe(beforePan.center.y);
            expect((await geometry()).zoom).toEqual(beforePan.zoom);
            expect(await pixel(page, sampleX, 8)).toBeCloseTo(expectedValue, 5);

            // Clip the known positive fixture data to white, then invert to black.
            // Sample an image coordinate after stretching to check canvas mapping.
            await page.evaluate(() => {
                const config = (window as any).app.activeFrame.renderConfig;
                config.setColorMap('gray');
                config.setScaling(0);
                config.setCustomScale(-2, -1);
                config.setInverted(false);
            });
            await expect
                .poll(() => axisPixelRgb(page, kind === 'swapped' ? 2 : 8, 8))
                .toEqual([255, 255, 255, 255]);
            await page.evaluate(() =>
                (window as any).app.activeFrame.renderConfig.setInverted(true),
            );
            await expect
                .poll(() => axisPixelRgb(page, kind === 'swapped' ? 2 : 8, 8))
                .toEqual([0, 0, 0, 255]);
            await page.evaluate(async (kind) => {
                const frame = (window as any).app.activeFrame;
                frame.renderConfig.setInverted(false);
                frame.renderConfig.setCustomScale(0, 2);
                const region = await frame.regionSet.addRegionAsync(3, [
                    { x: kind === 'swapped' ? 2 : 8, y: 8 },
                    { x: kind === 'swapped' ? 1 : 4, y: 4 },
                ]);
                region.setColor('#FF0000');
                region.setLineWidth(3);
                region.setDashLength(0);
                frame.contourConfig.setContourConfiguration(
                    [kind === 'swapped' ? 1.1 : 1.3],
                    0,
                    1,
                );
                frame.contourConfig.setColor('#00FF00');
                frame.contourConfig.setColormapEnabled(false);
                frame.applyContours();
            }, kind);
            await expect
                .poll(() =>
                    page
                        .locator('#contour-canvas')
                        .first()
                        .evaluate((canvas: HTMLCanvasElement) => {
                            const pixels = canvas
                                .getContext('2d')!
                                .getImageData(
                                    0,
                                    0,
                                    canvas.width,
                                    canvas.height,
                                ).data;
                            let green = 0;
                            for (let i = 0; i < pixels.length; i += 4)
                                if (
                                    pixels[i] === 0 &&
                                    pixels[i + 1] === 255 &&
                                    pixels[i + 2] === 0 &&
                                    pixels[i + 3] > 0
                                )
                                    green++;
                            return green;
                        }),
                )
                .toBeGreaterThan(20);
            // Check the four rectangle sides at their projected image coordinates.
            await expect
                .poll(() =>
                    stage.evaluate((canvas: HTMLCanvasElement, kind) => {
                        const view = (window as any).app.activeFrame
                            .requiredFrameView;
                        return [
                            { x: kind === 'swapped' ? 1.5 : 6, y: 8 },
                            { x: kind === 'swapped' ? 2.5 : 10, y: 8 },
                            { x: kind === 'swapped' ? 2 : 8, y: 6 },
                            { x: kind === 'swapped' ? 2 : 8, y: 10 },
                        ].map((point) => {
                            const x = Math.round(
                                ((point.x - view.xMin) /
                                    (view.xMax - view.xMin)) *
                                    canvas.width,
                            );
                            const y = Math.round(
                                ((view.yMax - point.y) /
                                    (view.yMax - view.yMin)) *
                                    canvas.height,
                            );
                            const pixels = canvas
                                .getContext('2d')!
                                .getImageData(x - 4, y - 4, 9, 9).data;
                            for (let i = 0; i < pixels.length; i += 4)
                                if (
                                    pixels[i] > 240 &&
                                    pixels[i + 1] < 20 &&
                                    pixels[i + 2] < 20 &&
                                    pixels[i + 3] > 0
                                )
                                    return true;
                            return false;
                        });
                    }, kind),
                )
                .toEqual([true, true, true, true]);
            await settleViewer(viewerCanvas);
            await snapshotViewer(
                viewerCanvas,
                `${kind}-independent-axis-zoom.png`,
            );

            await viewerCanvas.hover();
            await page.getByTestId('toolbar-region-moving-button').dblclick();
            const pan = page.locator('.panel-pan-and-zoom');
            await pan
                .getByRole('radiogroup')
                .getByText('Image', { exact: true })
                .click();
            for (const axis of ['x', 'y'] as const) {
                const before = await geometry();
                const input = settingsField(
                    pan,
                    new RegExp(`^Size \\(${axis.toUpperCase()}\\)`),
                ).getByRole('spinbutton');
                await input.fill('12');
                await input.press('Enter');
                await expect
                    .poll(() => geometry().then((g) => g.size[axis]))
                    .toBeCloseTo(12, 4);
                const other = axis === 'x' ? 'y' : 'x';
                expect((await geometry()).zoom[other]).toBeCloseTo(
                    before.zoom[other],
                    8,
                );
                const valid = await geometry();
                for (const invalid of ['0', '-1', '']) {
                    await input.fill(invalid);
                    await input.press('Enter');
                    await expect.poll(geometry).toEqual(valid);
                }
            }
            await carta.closeWidget('image-view-floating-settings');
            await viewerCanvas.hover();
            await page.getByTestId('zoom-to-1x-fit-button').click();
            await expect
                .poll(() => geometry().then((g) => g.zoom))
                .toEqual({ x: 1, y: 1 });
            await page.getByTestId('zoom-to-fit-button').click();
            await expect
                .poll(() => geometry().then((g) => g.zoom))
                .toEqual(fit.zoom);
            await settleViewer(viewerCanvas);
            await snapshotViewer(viewerCanvas, `${kind}-axis-zoom-reset.png`);
        });
    }

    test('Regular images keep both axes coupled for wheel and Shift-wheel', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        await useSinglePanel(page);
        await viewerCanvas.hover();
        await expect(page.getByTestId('pv-zoom-axis-button')).toHaveCount(0);
        const zoom = () =>
            page.evaluate(() => ({
                ...(window as any).app.activeFrame.effectiveZoomLevel,
            }));
        const fittedZoom = await zoom();
        await page.getByTestId('zoom-in-button').click();
        await expect
            .poll(zoom)
            .toEqual({ x: fittedZoom.x * 2, y: fittedZoom.y * 2 });
        await page.getByTestId('zoom-out-button').click();
        await expect.poll(zoom).toEqual(fittedZoom);

        await page.getByTestId('toolbar-region-moving-button').dblclick();
        const pan = page.locator('.panel-pan-and-zoom');
        await pan
            .getByRole('radiogroup')
            .getByText('Image', { exact: true })
            .click();
        for (const axis of ['X', 'Y']) {
            const before = await zoom();
            const size = settingsField(
                pan,
                new RegExp(`^Size \\(${axis}\\)`),
            ).getByRole('spinbutton');
            await size.fill(axis === 'X' ? '8' : '12');
            await size.press('Enter');
            await expect
                .poll(() => zoom().then((value) => value.x))
                .not.toBe(before.x);
            const after = await zoom();
            expect(after.x).toBe(after.y);
        }
        await carta.closeWidget('image-view-floating-settings');
        await viewerCanvas.hover();
        await page.getByTestId('zoom-to-fit-button').click();
        await expect.poll(zoom).toEqual(fittedZoom);
        await expect(page.getByTestId('pv-zoom-axis-button')).toHaveCount(0);
        for (const shift of [false, true]) {
            const before = await zoom();
            await viewerCanvas.locator('.region-stage canvas').first().hover();
            if (shift) await page.keyboard.down('Shift');
            try {
                await page.mouse.wheel(0, -100);
            } finally {
                if (shift) await page.keyboard.up('Shift');
            }
            await expect
                .poll(() => zoom().then((g) => g.x))
                .toBeGreaterThan(before.x);
            const after = await zoom();
            expect(after.x).toBe(after.y);
        }
        await page.evaluate(() => {
            const config = (window as any).app.activeFrame.renderConfig;
            config.setColorMap('gray');
            config.setCustomScale(-2, -1);
        });
        await expect
            .poll(() => axisPixelRgb(page, 8, 8))
            .toEqual([255, 255, 255, 255]);
        await page.evaluate(() =>
            (window as any).app.activeFrame.renderConfig.setCustomScale(0, 2),
        );
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, 'regular-image-wheel-zoom.png');
    });
});

test('Independent axis zoom: PNG export and workspace round trip', async ({
    page,
    carta,
    viewerCanvas,
}, testInfo) => {
    // Isolate database writes while using the real workspace serializer/loader.
    let saved: any;
    const name = 'e2e-pv-axis-zoom';
    await page.route('**/database/list/workspaces', (route) =>
        route.fulfill({
            json: {
                success: true,
                workspaces: saved ? [{ name, date: saved.date }] : [],
            },
        }),
    );
    await page.route(/\/database\/workspace(?:\/.*)?$/, async (route) => {
        if (route.request().method() === 'PUT')
            saved = route.request().postDataJSON().workspace;
        await route.fulfill({ json: { success: true, workspace: saved } });
    });
    await carta.loadImage('wcs-pv-clean.fits');
    await useSinglePanel(page);
    await viewerCanvas.hover();
    await page.getByTestId('zoom-in-button').click();
    await page.getByTestId('pv-zoom-axis-button').click();
    await page.getByTestId('pv-zoom-axis-x').click();
    const state = () =>
        page.evaluate(() => {
            const f = (window as any).app.activeFrame;
            return {
                zoom: {
                    x: f.effectiveZoomLevel.x / (window as any).app.imageRatio,
                    y: f.effectiveZoomLevel.y / (window as any).app.imageRatio,
                },
                axis: f.zoomAxis,
            };
        });
    const expected = await state();
    expect(expected.zoom.x).not.toBe(expected.zoom.y);
    const sizes: number[][] = [];
    for (const [index, label] of ['High (200%)', 'Normal (100%)'].entries()) {
        await viewerCanvas.hover();
        await page.getByTestId('export-image-view-button').click();
        const pending = page.waitForEvent('download');
        await page.getByRole('menuitem', { name: label }).click();
        const download = await pending;
        const target = testInfo.outputPath(`pv-axis-export-${index}.png`);
        await download.saveAs(target);
        const png = await readFile(target);
        expect(png.subarray(0, 8)).toEqual(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        );
        sizes.push([png.readUInt32BE(16), png.readUInt32BE(20)]);
        await viewerCanvas.hover();
        await page.mouse.move(0, 0);
        await expect.poll(state).toEqual(expected);
        expect(png).toMatchSnapshot(`pv-axis-export-${index}.png`);
    }
    for (const dimension of [0, 1])
        expect(
            Math.abs(sizes[0][dimension] - 2 * sizes[1][dimension]),
        ).toBeLessThanOrEqual(2);
    await carta.selectMenuItem('File', 'Save Workspace');
    const save = page.getByRole('dialog', {
        name: 'Save Workspace',
        exact: true,
    });
    await save.getByPlaceholder('Enter workspace name').fill(name);
    await save.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(save).toBeHidden();
    expect(saved.files[0]).toMatchObject({
        axisZoomLevel: expected.zoom,
        zoomAxis: expected.axis,
    });
    for (const variant of ['current', 'legacy', 'invalid']) {
        if (variant === 'legacy') delete saved.files[0].axisZoomLevel;
        if (variant === 'invalid')
            saved.files[0].axisZoomLevel = { x: -1, y: 0 };
        await viewerCanvas.hover();
        await page.getByTestId('zoom-to-1x-fit-button').click();
        await carta.selectMenuItem('File', 'Open Workspace');
        const open = page.getByRole('dialog', {
            name: 'Open Workspace',
            exact: true,
        });
        await open.getByText(name, { exact: true }).first().click();
        await open.getByRole('button', { name: 'Open', exact: true }).click();
        await expect(open).toBeHidden();
        const zoom =
            variant === 'current'
                ? expected.zoom
                : { x: saved.files[0].zoomLevel, y: saved.files[0].zoomLevel };
        await expect.poll(state).toEqual({ axis: expected.axis, zoom });
        await expect
            .poll(() => axisPixelRgb(page, 8, 8).then((rgb) => rgb[3]))
            .toBe(255);
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, `pv-axis-workspace-${variant}.png`);
    }
});

test('WCS format round trip preserves numeric position and raster', async ({
    page,
    carta,
    viewerCanvas,
}) => {
    await carta.loadImage('cube.fits');
    await useSinglePanel(page);
    await page.getByTestId('image-view-header-settings-button').click();
    const pan = page.locator('.panel-pan-and-zoom');
    await pan
        .getByRole('radiogroup')
        .getByText('Image', { exact: true })
        .click();
    for (const name of ['X Coordinate', 'Y Coordinate']) {
        const input = pan.getByRole('spinbutton', { name, exact: true });
        await input.fill('8');
        await input.press('Enter');
    }
    await pan
        .getByRole('radiogroup')
        .getByText('World', { exact: true })
        .click();
    const geometry = () =>
        page.evaluate(() => {
            const frame = (window as any).app.activeFrame;
            return {
                center: { ...frame.center },
                zoom: { ...frame.effectiveZoomLevel },
            };
        });
    const original = await geometry();
    const x = pan.getByRole('textbox', {
        name: 'X WCS coordinate',
        exact: true,
    });
    const y = pan.getByRole('textbox', {
        name: 'Y WCS coordinate',
        exact: true,
    });
    const numbers = page.getByRole('tabpanel', {
        name: 'Numbers',
        exact: true,
    });
    await page.getByRole('tab', { name: 'Numbers', exact: true }).click();
    await settingsField(numbers, /^Custom format$/)
        .getByRole('checkbox')
        .check({ force: true });
    // Independent SIN projection of pixel (8,8) from cube.fits header:
    // CRPIX=(8,8), CRVAL=(180,-30), CDELT=(-0.001,0.001) degrees.
    const expected = { x: 179.99884531109683, y: -29.998999994961665 };
    let initialSexagesimal: string[];
    const degrees = (value: string, hours: boolean) => {
        const [whole, minutes, seconds] = value
            .replace(/^[+-]/, '')
            .split(':')
            .map(Number);
        return (
            (value.startsWith('-') ? -1 : 1) *
            (whole + minutes / 60 + seconds / 3600) *
            (hours ? 15 : 1)
        );
    };
    const visitReferencePixel = async (decimal: boolean) => {
        await x.fill(decimal ? '180' : '12:00:00');
        await x.press('Enter');
        await y.fill(decimal ? '-30' : '-30:00:00');
        await y.press('Enter');
        await expect
            .poll(() => geometry().then((value) => value.center.x))
            .toBeCloseTo(7, 5);
        await expect
            .poll(() => geometry().then((value) => value.center.y))
            .toBeCloseTo(7, 5);
    };
    for (const format of ['sexagesimal', 'degrees', 'restored'] as const) {
        await page.getByRole('tab', { name: 'Numbers', exact: true }).click();
        await settingsField(numbers, /^Format \(X\)$/)
            .getByRole('combobox')
            .selectOption(format === 'degrees' ? 'd' : 'hms');
        await settingsField(numbers, /^Format \(Y\)$/)
            .getByRole('combobox')
            .selectOption(format === 'degrees' ? 'd' : 'dms');
        await page
            .getByRole('tab', { name: 'Pan and Zoom', exact: true })
            .click();
        if (format === 'degrees') {
            await expect
                .poll(() => x.inputValue().then(Number))
                .toBeCloseTo(expected.x, 7);
            await expect
                .poll(() => y.inputValue().then(Number))
                .toBeCloseTo(expected.y, 7);
            // Submit equivalent world coordinates through the actual input path.
            await visitReferencePixel(true);
            await x.fill(String(expected.x));
            await x.press('Enter');
            await y.fill(String(expected.y));
            await y.press('Enter');
        } else {
            await expect(x).toHaveValue(/^\d+:\d+:\d+(?:\.\d+)?$/);
            await expect(y).toHaveValue(/^-\d+:\d+:\d+(?:\.\d+)?$/);
            const values = [await x.inputValue(), await y.inputValue()];
            expect(degrees(values[0], true)).toBeCloseTo(expected.x, 7);
            expect(degrees(values[1], false)).toBeCloseTo(expected.y, 7);
            if (format === 'sexagesimal') initialSexagesimal = values;
            else
                for (const index of [0, 1])
                    expect(degrees(values[index], index === 0)).toBeCloseTo(
                        degrees(initialSexagesimal![index], index === 0),
                        9,
                    );
            await visitReferencePixel(false);
            await x.fill(values[0]);
            await x.press('Enter');
            await y.fill(values[1]);
            await y.press('Enter');
        }
        const validX = await x.inputValue();
        await x.fill(format === 'degrees' ? 'invalid' : '12:xx:00');
        await x.press('Tab');
        if (format === 'degrees')
            await expect
                .poll(() => x.inputValue().then(Number))
                .toBeCloseTo(expected.x, 7);
        else
            await expect
                .poll(() =>
                    x.inputValue().then((value) => degrees(value, true)),
                )
                .toBeCloseTo(degrees(validX, true), 9);
        const after = await geometry();
        expect(after.center.x).toBeCloseTo(original.center.x, 5);
        expect(after.center.y).toBeCloseTo(original.center.y, 5);
        expect(after.zoom).toEqual(original.zoom);
        await page.evaluate(() => {
            const config = (window as any).app.activeFrame.renderConfig;
            config.setColorMap('gray');
            config.setScaling(0);
            config.setCustomScale(-2, -1);
        });
        await expect
            .poll(() => axisPixelRgb(page, 8, 8))
            .toEqual([255, 255, 255, 255]);
        await page.evaluate(() =>
            (window as any).app.activeFrame.renderConfig.setCustomScale(0, 2),
        );
        await carta.closeWidget('image-view-floating-settings');
        expect(await pixel(page, 8, 8)).toBeCloseTo(1.5, 5);
        const cursor = await page.evaluate(
            () => (window as any).app.activeFrame.cursorInfo.infoWCS,
        );
        for (const axis of ['x', 'y'] as const) {
            const value =
                format === 'degrees'
                    ? Number(cursor[axis])
                    : degrees(cursor[axis], axis === 'x');
            expect(value).toBeCloseTo(expected[axis], 3);
            await expect(
                page.getByTestId('viewer-cursor-info-bar'),
            ).toContainText(cursor[axis]);
        }
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            '1.5 K',
        );
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, `wcs-format-${format}.png`);
        await page.getByTestId('image-view-header-settings-button').click();
    }
});

test('WCS system round trip matches reference coordinates without moving the image', async ({
    page,
    carta,
    viewerCanvas,
}) => {
    await carta.loadImage('cube.fits');
    await useSinglePanel(page);
    await page.getByTestId('image-view-header-settings-button').click();
    const pan = page.locator('.panel-pan-and-zoom');
    await pan
        .getByRole('radiogroup')
        .getByText('Image', { exact: true })
        .click();
    for (const name of ['X Coordinate', 'Y Coordinate']) {
        const input = pan.getByRole('spinbutton', { name, exact: true });
        await input.fill('7');
        await input.press('Enter');
    }
    await pan
        .getByRole('radiogroup')
        .getByText('World', { exact: true })
        .click();
    const numbers = page.getByRole('tabpanel', {
        name: 'Numbers',
        exact: true,
    });
    await page.getByRole('tab', { name: 'Numbers', exact: true }).click();
    await settingsField(numbers, /^Custom format$/)
        .getByRole('checkbox')
        .check({ force: true });
    for (const axis of ['X', 'Y'])
        await settingsField(numbers, new RegExp(`^Format \\(${axis}\\)$`))
            .getByRole('combobox')
            .selectOption('d');
    await page.getByRole('tab', { name: 'Pan and Zoom', exact: true }).click();
    const state = () =>
        page.evaluate(() => {
            const f = (window as any).app.activeFrame;
            return {
                center: { ...f.center },
                zoom: { ...f.effectiveZoomLevel },
            };
        });
    const original = await state();
    await page.evaluate(() => {
        const c = (window as any).app.activeFrame.renderConfig;
        c.setColorMap('gray');
        c.setScaling(0);
        c.setCustomScale(-2, -1);
    });
    await expect
        .poll(() => axisPixelRgb(page, 7, 7))
        .toEqual([255, 255, 255, 255]);
    await page.evaluate(() =>
        (window as any).app.activeFrame.renderConfig.setCustomScale(0, 2),
    );
    const raster = page.locator('#raster-canvas').first();
    await expect
        .poll(() => axisPixelRgb(page, 7, 7).then((p) => p[0]))
        .toBeLessThan(255);
    const originalRaster = await raster.evaluate((c: HTMLCanvasElement) =>
        c.toDataURL(),
    );
    // Reference pixel (7,7) is RA=180, Dec=-30 degrees. Galactic reference
    // uses the standard J2000 rotation matrix; ecliptic uses J2000 obliquity.
    for (const [system, longitude, latitude] of [
        ['FK5', 180, -30],
        ['GALACTIC', 289.8581117798859, 31.562547013751264],
        ['ECLIPTIC', 192.93408433302122, -27.305898332084137],
        ['FK5', 180, -30],
    ] as const) {
        await pan.getByRole('combobox').selectOption(system);
        await expect
            .poll(() =>
                pan
                    .getByRole('textbox', {
                        name: 'X WCS coordinate',
                        exact: true,
                    })
                    .inputValue()
                    .then(Number),
            )
            .toBeCloseTo(longitude, 3);
        await expect
            .poll(() =>
                pan
                    .getByRole('textbox', {
                        name: 'Y WCS coordinate',
                        exact: true,
                    })
                    .inputValue()
                    .then(Number),
            )
            .toBeCloseTo(latitude, 3);
        await expect.poll(state).toEqual(original);
        await expect
            .poll(() =>
                raster.evaluate((c: HTMLCanvasElement) => c.toDataURL()),
            )
            .toBe(originalRaster);
        await carta.closeWidget('image-view-floating-settings');
        expect(await pixel(page, 7, 7)).toBeCloseTo(1.4375, 5);
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            '1.4375 K',
        );
        await settleViewer(viewerCanvas);
        await snapshotViewer(
            viewerCanvas,
            `wcs-system-${system.toLowerCase()}.png`,
        );
        await page.getByTestId('image-view-header-settings-button').click();
    }
});

for (const kind of ['pv', 'swapped'] as const) {
    test(`WCS coordinates survive unequal ${kind} zoom and unavailable format controls`, async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage(`wcs-${kind}-clean.fits`);
        await useSinglePanel(page);
        const point = { x: kind === 'pv' ? 8 : 2, y: 8 };
        const world = () =>
            page.evaluate((point) => {
                const info = (window as any).app.activeFrame.getCursorInfo(
                    point,
                );
                return { position: info.posWCS, formatted: info.infoWCS };
            }, point);
        const original = await world();
        expect(Number.isFinite(original.position.x)).toBe(true);
        expect(Number.isFinite(original.position.y)).toBe(true);
        await viewerCanvas.hover();
        await page.getByTestId('zoom-in-button').click();
        const zoom = await page.evaluate(() => ({
            ...(window as any).app.activeFrame.effectiveZoomLevel,
        }));
        expect(zoom.x).not.toBe(zoom.y);
        await expect.poll(world).toEqual(original);
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Numbers', exact: true }).click();
        const numbers = page.getByRole('tabpanel', {
            name: 'Numbers',
            exact: true,
        });
        await expect(
            settingsField(numbers, /^Custom format$/).getByRole('checkbox'),
        ).toBeDisabled();
        await expect(
            settingsField(numbers, /^Custom precision$/).getByRole('checkbox'),
        ).toBeDisabled();
        await carta.closeWidget('image-view-floating-settings');
        await expect.poll(world).toEqual(original);
        expect(await pixel(page, point.x, point.y)).toBeCloseTo(
            kind === 'pv' ? 1.5 : 1.125,
            5,
        );
        await page.evaluate(() => {
            const config = (window as any).app.activeFrame.renderConfig;
            config.setColorMap('gray');
            config.setCustomScale(-2, -1);
        });
        await expect
            .poll(() => axisPixelRgb(page, point.x, point.y))
            .toEqual([255, 255, 255, 255]);
        await page.evaluate(() =>
            (window as any).app.activeFrame.renderConfig.setCustomScale(0, 2),
        );
        await settleViewer(viewerCanvas);
        await snapshotViewer(viewerCanvas, `wcs-${kind}-unequal-zoom.png`);
    });
}
