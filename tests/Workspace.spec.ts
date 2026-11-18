import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
    activate,
    averageWidthInput,
    control,
    fixtureFolder,
    generate,
    generateButton,
    imageDropdown,
    getFrames,
    load,
    moveSettings,
    number,
    panel,
    pixel,
    pvCutDropdown,
    pvPanel,
    range,
    renderedPixelRgb,
    spectralFromInput,
    spectralToInput,
    tags,
} from '../utilities';
import {
    attachWorkspacePng,
    workspaceRegion,
    workspaceRoundTrip,
} from './workspace';

const overlayHasInk = (canvas: Locator, rgb: [number, number, number]) =>
    canvas.evaluate((source: HTMLCanvasElement, [red, green, blue]) => {
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d')!;
        context.drawImage(source, 0, 0);
        const rgba = context.getImageData(0, 0, copy.width, copy.height).data;
        for (let i = 0; i < rgba.length; i += 4) {
            if (
                rgba[i] === red &&
                rgba[i + 1] === green &&
                rgba[i + 2] === blue &&
                rgba[i + 3] > 0
            )
                return true;
        }
        return false;
    }, rgb);

test('Workspace restores image settings, floating windows and their selected tabs', async ({
    page,
}, info) => {
    await workspaceRoundTrip(
        page,
        info,
        async (carta) => {
            await carta.loadImage('cube.fits');
            await page.getByTestId('animator-0-header-title').click();
            await page.getByTestId('animator-last-button').click();
            expect(await pixel(page, 8, 8)).toBeCloseTo(24, 5);
            await workspaceRegion(page, 'rectangle');
            await page.getByTestId('region-list-0-header-title').click();
            const region = page
                .getByTestId('region-list-table')
                .getByTestId('region-list-table-row-2');
            await expect(region).toContainText('Rectangle');
            await region.click();
            const regionGeometry = () =>
                page.evaluate(() => {
                    const focused = (window as any).app.activeFrame?.regionSet
                        .focusedRegion;
                    return focused?.regionId > 0 ? focused.controlPoints : null;
                });
            await expect.poll(regionGeometry).not.toBeNull();
            const originalRegion = await regionGeometry();

            const colormap = page
                .getByTestId('render-config-0-content')
                .getByTestId('colormap-dropdown');
            const setColormap = async (name: string) => {
                await carta.selectMenuItem(
                    'Widgets',
                    'Render Configuration Widget',
                );
                await colormap.click();
                await page.getByRole('menuitem', { name, exact: true }).click();
                await carta.closeWidget('render-config');
            };
            await setColormap('gray');
            await expect
                .poll(async () => {
                    const [r, g, b] = await renderedPixelRgb(page, 8, 8);
                    return r > 0 && r === g && g === b;
                })
                .toBe(true);

            await page.locator('#SpectralProfilerButton').click();
            const profiler = page.getByTestId('spectral-profiler-0-content');
            const regionDropdown = profiler.getByTestId(
                'spectral-profiler-region-dropdown',
            );
            await regionDropdown.click();
            await page
                .getByTestId('spectral-profiler-region-dropdown-region-1')
                .click();
            await page.keyboard.press('Escape');
            const plot = profiler
                .locator('.line-plot-component .annotation-stage canvas')
                .first();
            const profileValues = () =>
                page.evaluate(
                    () =>
                        (window as any).app.widgetsStore.spectralProfileWidgets
                            .get('spectral-profiler-0')
                            ?.plotData?.data?.[0]?.map(
                                ({ y }: { y: number }) => y,
                            ) ?? [],
                );
            await expect(regionDropdown).toContainText('Region 1');
            await expect(plot).toBeVisible();
            await expect
                .poll(async () =>
                    (await profileValues()).filter(Number.isFinite),
                )
                .toHaveLength(5);
            const originalProfile = await profileValues();
            await carta.selectMenuItem(
                'Widgets',
                'Render Configuration Widget',
            );
            const renderTitle = page
                .locator('.floating-widget .floating-title')
                .filter({ hasText: 'Render Configuration' });
            const move = async (title: Locator) => {
                await expect(title).toBeVisible();
                const origin = await title.boundingBox();
                await carta.sliderDragAndDrop(page, title, 100, 75);
                await expect
                    .poll(async () => (await title.boundingBox())?.x)
                    .not.toBe(origin?.x);
            };
            await move(renderTitle);
            await carta.selectMenuItem('Widgets', 'Histogram Widget');
            await page
                .getByTestId('spectral-profiler-0-header-settings-button')
                .click();
            const settings = page.getByTestId(
                'spectral-profiler-0-floating-settings-0-content',
            );
            await expect(
                settings.getByRole('tab', {
                    name: 'Conversion',
                    selected: true,
                }),
            ).toBeVisible();
            await settings
                .getByRole('tab', { name: 'Smoothing', exact: true })
                .click();

            await carta.selectMenuItem('View', 'File Header');
            const header = page.getByRole('dialog', {
                name: 'File Header',
                exact: true,
            });
            await expect(
                header.getByRole('tab', {
                    name: 'Header',
                    exact: true,
                    selected: true,
                }),
            ).toBeVisible();
            await header
                .getByRole('tab', { name: 'File Information', exact: true })
                .click();
            await move(header.locator('.bp6-dialog-header .bp6-heading'));
            return async (stage) => {
                await expect
                    .poll(() => pixel(page, 8, 8, true))
                    .toBeCloseTo(24, 5);
                await expect
                    .poll(() =>
                        page.evaluate(
                            () =>
                                (window as any).app.activeFrame.renderConfig
                                    .colorMap,
                        ),
                    )
                    .toBe('gray');
                await expect.poll(regionGeometry).toEqual(originalRegion);
                await expect(regionDropdown).toContainText('Region 1');
                await expect.poll(profileValues).toEqual(originalProfile);
                await expect(renderTitle).toBeVisible();
                await expect
                    .soft(
                        settings.getByRole('tab', {
                            name: 'Smoothing',
                            exact: true,
                            selected: true,
                        }),
                    )
                    .toBeVisible();
                await expect
                    .soft(
                        settings.getByRole('tabpanel', {
                            name: 'Smoothing',
                            exact: true,
                        }),
                    )
                    .toBeVisible();
                await expect
                    .soft(
                        header.getByRole('tab', {
                            name: 'File Information',
                            exact: true,
                            selected: true,
                        }),
                    )
                    .toBeVisible();
                await attachWorkspacePng(
                    info,
                    `${stage}-spectral-profile`,
                    plot,
                );
            };
        },
        { verifyDatabaseFailures: true },
    );
});

test('Workspace restores changed moment map and PV generator settings and products', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('cube.fits');
        await load(page, 'HD163296_13CO_2-1_subimage.fits', true);
        await workspaceRegion(page, 'line');
        const lineCut = () =>
            page.evaluate(() => {
                const cube = (window as any).app.frames.find(
                    (frame: any) =>
                        frame.filename === 'HD163296_13CO_2-1_subimage.fits',
                );
                return cube?.regionSet.regions.find(
                    (region: any) => region.regionType === 1,
                )?.controlPoints;
            });
        const savedCut = await lineCut();
        expect(savedCut).toHaveLength(2);
        await activate(page, 'cube.fits');
        await page.locator('#SpectralProfilerButton').click();
        await page.getByTestId('moment-generator-button').click();
        await panel(page)
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Channel');
        await control(page, 'image-dropdown').selectOption({
            label: '0: cube.fits',
        });
        await control(page, 'region-dropdown').selectOption({ label: 'Image' });
        await range(page, 'spectral', 1, 3);
        const [map] = await generate(page, ['-1']);
        await moveSettings(page);
        await activate(page, 'HD163296_13CO_2-1_subimage.fits');
        await carta.selectMenuItem('Widgets', 'PV Generator');
        const source = imageDropdown(page)
            .locator('option')
            .filter({
                hasText: /: HD163296_13CO_2-1_subimage\.fits$/,
            });
        await imageDropdown(page).selectOption({
            label: await source.innerText(),
        });
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
        const pvCoordinate = pvPanel(page).getByTestId(
            'spectral-profiler-coordinate-dropdown',
        );
        await pvCoordinate.selectOption('Channel');
        await number(spectralFromInput(page), 10);
        await number(spectralToInput(page), 30);
        await number(averageWidthInput(page), 5);
        await generateButton(page).click();
        const pvName = 'HD163296_13CO_2-1_subimage_pv.fits';
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            pvName,
            { timeout: 30000 },
        );
        const pv = () =>
            getFrames(page).then((frames) =>
                frames.find((frame) => frame.isPVImage),
            );
        const expected = await pv();
        expect(expected?.width).toBeGreaterThan(0);
        expect(expected?.height).toBe(21);
        const momentImage = () =>
            getFrames(page).then((frames) =>
                frames.find((frame) => frame.filename === map.filename),
            );
        return async () => {
            await expect.soft(panel(page)).toBeVisible();
            await expect.soft(tags(page)).toHaveText(['-1']);
            await expect
                .soft(control(page, 'image-dropdown').locator('option:checked'))
                .toContainText('cube.fits');
            await expect
                .soft(control(page, 'spectral-range-from-input'))
                .toHaveValue('1');
            await expect
                .soft(control(page, 'spectral-range-to-input'))
                .toHaveValue('3');
            await expect.soft(pvPanel(page)).toBeVisible();
            await expect
                .soft(imageDropdown(page).locator('option:checked'))
                .toContainText('HD163296_13CO_2-1_subimage.fits');
            await expect
                .soft(pvCutDropdown(page).locator('option:checked'))
                .toHaveText('Region 1');
            await expect
                .soft(pvCoordinate.locator('option:checked'))
                .toHaveText('Channel');
            await expect.soft(spectralFromInput(page)).toHaveValue('10');
            await expect.soft(spectralToInput(page)).toHaveValue('30');
            await expect.soft(averageWidthInput(page)).toHaveValue('5');
            await expect.poll(lineCut).toEqual(savedCut);
            await expect
                .poll(async () => {
                    const image = await pv();
                    return image && [image.filename, image.width, image.height];
                })
                .toEqual([pvName, expected?.width, expected?.height]);
            await expect
                .poll(async () => (await momentImage())?.unit)
                .toBe('K');
            await activate(page, map.filename);
            await expect.poll(() => pixel(page, 8, 8, true)).toBeCloseTo(7, 4);
            await activate(page, pvName);
        };
    });
});

test('Workspace restores a local catalog and its plotted sources', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await load(
            page,
            'catalog-image.fits',
            false,
            path.join(fixtureFolder, 'catalogs'),
        );
        await carta.selectMenuItem('File', 'Import Catalog');
        const browser = page.getByTestId('file-browser-dialog');
        await browser
            .getByRole('textbox', { name: 'Filter by filename with fuzzy' })
            .fill('catalog-sky.vot');
        await browser
            .getByText('catalog-sky.vot', { exact: true })
            .first()
            .click();
        await browser
            .getByRole('button', { name: 'Load catalog', exact: true })
            .click();

        const catalog = page.locator('.catalog-overlay');
        const canvas = page.locator('#catalog-canvas');
        await catalog.getByTestId('catalog-plot-button').click();
        return async (stage) => {
            await expect(
                catalog.getByTestId('catalog-table-filtering-info'),
            ).toContainText('total 5 entries');
            await expect
                .poll(() => overlayHasInk(canvas, [0, 163, 150]))
                .toBe(true);
            await attachWorkspacePng(info, `${stage}-catalog`, canvas);
        };
    });
});

const contourDialog = (page: Page) => page.getByTestId('contour-dialog');
const contourCanvas = (page: Page) => page.locator('#contour-canvas');

test('Workspace restores changed contour settings and their rendered overlay', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await page.evaluate(() =>
            (window as any).app.activeFrame.setChannel(24),
        );
        await page.getByTestId('contour-dialog-button').click();
        const input = contourDialog(page)
            .getByTestId('contour-config-level-input-form')
            .locator('input');
        for (const value of ['0.04', '0.1']) {
            await input.fill(value);
            await input.press('Enter');
        }
        const dialog = contourDialog(page);
        const configuration = dialog.getByRole('tabpanel', {
            name: 'Configuration',
        });
        const smoothingMode = configuration.locator('select');
        const smoothingFactor = dialog.getByPlaceholder('Smoothing factor');
        await dialog
            .getByRole('tab', { name: 'Configuration', exact: true })
            .click();
        await smoothingMode.selectOption('1');
        await smoothingFactor.fill('3');
        await contourDialog(page)
            .getByTestId('contour-config-apply-button')
            .click();
        await contourDialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        await contourDialog(page)
            .getByRole('tabpanel', { name: 'Styling' })
            .locator('.color-swatch-button')
            .click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        await dialog
            .getByRole('tab', { name: 'Configuration', exact: true })
            .click();
        await smoothingFactor.fill('5');
        await smoothingFactor.press('Tab');
        return async (stage) => {
            await expect.soft(configuration).toBeVisible();
            await expect.soft(smoothingMode).toHaveValue('1');
            await expect.soft(smoothingFactor).toHaveValue('5');
            await expect
                .soft(dialog.getByTestId('contour-config-apply-button'))
                .toBeEnabled();
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const frame = (window as any).app.activeFrame;
                        return {
                            levels: [...frame.contourConfig.levels],
                            progress: frame.contourProgress,
                            enabled: frame.contourConfig.isEnabled,
                            smoothingMode: frame.contourConfig.smoothingMode,
                            smoothingFactor:
                                frame.contourConfig.smoothingFactor,
                        };
                    }),
                )
                .toEqual({
                    levels: [0.04, 0.1],
                    progress: 1,
                    enabled: true,
                    smoothingMode: 1,
                    smoothingFactor: 3,
                });
            await expect
                .poll(() => overlayHasInk(contourCanvas(page), [255, 255, 255]))
                .toBe(true);
            await attachWorkspacePng(
                info,
                `${stage}-contours`,
                page.locator('#contour-canvas').first(),
            );
        };
    });
});

test('Workspace restores Vector Overlay settings and rendered vectors', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('iquv.fits');
        await page.getByTestId('vector-dialog-button').click();
        const dialog = page.getByTestId('vector-dialog');
        const configuration = dialog.getByTestId(
            'vector-field-configuration-tab',
        );
        const styling = dialog.getByTestId('vector-field-styling-tab');
        await number(
            dialog.getByTestId('vector-field-averaging-width-input'),
            4,
        );
        await dialog.getByTestId('vector-field-apply-button').click();
        await styling.click();
        const thickness = dialog.getByTestId('vector-field-line-input');
        await number(thickness, 2);
        const colorMode = dialog.getByTestId(
            'vector-field-color-mode-dropdown',
        );
        await colorMode.selectOption('0');
        await dialog
            .locator('.vector-overlay-style-panel .color-swatch-button')
            .first()
            .click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        const canvas = page.locator('#vector-overlay-canvas');
        const vectorState = () =>
            page.evaluate(() => {
                const frame = (window as any).app.activeFrame;
                return {
                    progress: frame.vectorOverlayStore.progress,
                    vertices: frame.vectorOverlayStore.tiles.reduce(
                        (total: number, tile: { numVertices: number }) =>
                            total + tile.numVertices,
                        0,
                    ),
                    averaging: frame.vectorOverlayConfig.pixelAveraging,
                    thickness: frame.vectorOverlayConfig.thickness,
                };
            });
        await expect
            .poll(async () => (await vectorState()).progress, {
                timeout: 30000,
            })
            .toBe(1);
        const saved = await vectorState();
        expect(saved).toMatchObject({ averaging: 4, thickness: 2 });
        expect(saved.vertices).toBeGreaterThan(0);

        return async (stage) => {
            await expect(dialog).toBeVisible();
            await expect(styling).toHaveAttribute('aria-selected', 'true');
            await expect(configuration).toHaveAttribute(
                'aria-selected',
                'false',
            );
            await expect(thickness).toHaveValue('2');
            await expect(colorMode).toHaveValue('0');
            await expect.poll(vectorState).toEqual(saved);
            await expect
                .poll(() => overlayHasInk(canvas, [255, 255, 255]))
                .toBe(true);
            await attachWorkspacePng(info, `${stage}-vectors`, canvas);
        };
    });
});

const widget = (page: Page) => page.locator('.channel-map-control-containers');
const field = (page: Page, label: string) =>
    widget(page).locator('.bp6-form-group').filter({ hasText: label });
const labels = (page: Page) => page.locator('.channel-map-label-span');
const startChannel = (page: Page) =>
    widget(page).getByRole('spinbutton', { name: 'Start channel' });
const spinButtons = (page: Page, label: string) =>
    field(page, label).locator('.bp6-button-group.bp6-vertical button');

async function setNumber(input: Locator, value: number) {
    await input.fill(String(value));
    await input.press('Enter');
    await input.press('Tab');
}

async function expectChannels(page: Page, channels: number[]) {
    await expect(labels(page)).toHaveText(channels.map(String));
    // Channel selection is debounced; labels alone can precede the histogram.
    await expect
        .poll(() =>
            page.evaluate((channels) => {
                const frame = (window as any).app.activeFrame;
                return (
                    channels.includes(frame.channel) &&
                    frame.requiredChannel === frame.channel &&
                    frame.renderConfig.histChannel === frame.channel
                );
            }, channels),
        )
        .toBe(true);
}

async function toggle(page: Page, label: string) {
    await field(page, label).locator('.bp6-control-indicator').first().click();
}

test('Workspace restores channel map mode and the selected panel grid', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('cube.fits');
        await carta.selectMenuItem('Widgets', 'Channel Map Control');
        await toggle(page, 'Enable channel map mode');
        await toggle(page, 'Show channel string');
        await setNumber(
            widget(page).getByRole('spinbutton', { name: 'Number of rows' }),
            1,
        );
        return async () => {
            await expect(widget(page)).toBeVisible();
            await expect
                .soft(
                    field(page, 'Enable channel map mode').getByRole(
                        'checkbox',
                    ),
                )
                .toBeChecked();
            await expect
                .soft(
                    widget(page).getByRole('spinbutton', {
                        name: 'Number of rows',
                    }),
                )
                .toHaveValue('1');
            await expect
                .soft(field(page, 'Show channel string').getByRole('checkbox'))
                .toBeChecked();
            await expectChannels(page, [0, 1]);
        };
    });
});
