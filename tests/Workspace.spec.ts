import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
    activate,
    fixtureFolder,
    generate,
    generateButton,
    generatorCloseBtn,
    getFrames,
    load,
    panel,
    pixel,
    pvCutDropdown,
    renderedPixelRgb,
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

test('Workspace regenerates a mean moment and a PV image', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('cube.fits');
        await page.locator('#SpectralProfilerButton').click();
        await page.getByTestId('moment-generator-button').click();
        await panel(page)
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Channel');
        const [map] = await generate(page, ['-1']);
        await activate(page, map.filename);
        await expect.poll(() => pixel(page, 8, 8, true)).toBeCloseTo(9.3, 4);
        await carta.closeWidget('spectral-profiler');
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
        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
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
        await generatorCloseBtn(page).click();
        const momentImage = () =>
            getFrames(page).then((frames) =>
                frames.find((frame) => frame.filename === map.filename),
            );
        return async () => {
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
            await expect
                .poll(() => pixel(page, 8, 8, true))
                .toBeCloseTo(9.3, 4);
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

test('Workspace restores generated contour levels and their rendered overlay', async ({
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
        await page.getByTestId('contour-dialog-header-close-button').click();
        return async (stage) => {
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const frame = (window as any).app.activeFrame;
                        return {
                            levels: [...frame.contourConfig.levels],
                            progress: frame.contourProgress,
                            enabled: frame.contourConfig.isEnabled,
                        };
                    }),
                )
                .toEqual({ levels: [0.04, 0.1], progress: 1, enabled: true });
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
