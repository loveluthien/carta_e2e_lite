import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
    activate,
    averageWidthInput,
    control,
    fixtureBrowserPath,
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
    PlaywrightDevPage,
    previewButton,
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
            const renderWidget = page.locator('.floating-widget').filter({
                has: page
                    .locator('.floating-title')
                    .filter({ hasText: 'Render Configuration' }),
            });
            const renderTitle = renderWidget.locator('.floating-title');
            const move = async (title: Locator) => {
                await expect(title).toBeVisible();
                const origin = await title.boundingBox();
                await carta.sliderDragAndDrop(page, title, 100, 75);
                await expect
                    .poll(async () => (await title.boundingBox())?.x)
                    .not.toBe(origin?.x);
            };
            await move(renderTitle);
            const renderConfig = renderWidget.locator('.floating-content');
            const clipMin = renderConfig.getByTestId('clip-min-input');
            const clipMax = renderConfig.getByTestId('clip-max-input');
            const invert = renderConfig
                .locator('.bp6-form-group')
                .filter({
                    has: page.getByText('Invert colormap', { exact: true }),
                })
                .getByRole('checkbox');
            const samples = () =>
                Promise.all([
                    renderedPixelRgb(page, 8, 4),
                    renderedPixelRgb(page, 8, 12),
                ]);

            await renderConfig.getByTestId('colormap-dropdown').click();
            await page
                .getByRole('menuitem', { name: 'gray', exact: true })
                .click();
            await renderConfig
                .getByRole('button', { name: 'Linear', exact: true })
                .click();
            await page
                .getByRole('menuitem', { name: 'Square root', exact: true })
                .click();
            await number(clipMin, 4);
            await number(clipMax, 40);
            await invert.check({ force: true });
            await expect
                .poll(async () => {
                    const [lower, higher] = await samples();
                    return (
                        [lower, higher].every(
                            ([r, g, b, alpha]) =>
                                alpha === 255 &&
                                r === g &&
                                g === b &&
                                r > 0 &&
                                r < 255,
                        ) && lower[0] > higher[0]
                    );
                })
                .toBe(true);
            const savedSamples = await samples();

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
                await expect(
                    renderConfig.getByRole('button', {
                        name: 'Square root',
                        exact: true,
                    }),
                ).toBeVisible();
                await expect
                    .poll(async () => Number(await clipMin.inputValue()))
                    .toBe(4);
                await expect
                    .poll(async () => Number(await clipMax.inputValue()))
                    .toBe(40);
                await expect(invert).toBeChecked();
                await expect.poll(samples).toEqual(savedSamples);
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

test('Workspace restores an online SIMBAD query and its catalog', async ({
    page,
}, info) => {
    const queries: string[] = [];
    await page.route('**/sim-tap/sync?**', async (route) => {
        const query =
            new URL(route.request().url()).searchParams.get('query') ?? '';
        if (query.includes('FROM basic WHERE CONTAINS')) queries.push(query);
        await route.fulfill({
            headers: { 'access-control-allow-origin': '*' },
            json: {
                metadata: [
                    { name: 'ra', datatype: 'DOUBLE', unit: 'deg' },
                    { name: 'dec', datatype: 'DOUBLE', unit: 'deg' },
                    { name: 'main_id', datatype: 'CHAR' },
                ],
                data: [
                    [180.004, -30.003, 'Alpha'],
                    [179.999, -30, 'Beta'],
                ],
            },
        });
    });

    await workspaceRoundTrip(page, info, async (carta) => {
        await load(
            page,
            'catalog-image.fits',
            false,
            path.join(fixtureFolder, 'catalogs'),
        );
        const dialog = page.getByRole('dialog', {
            name: 'Online Data Query',
            exact: true,
        });
        const maxObjects = dialog.getByTestId(
            'catalog-query-max-objects-input',
        );
        const radius = dialog.getByTestId('catalog-query-search-radius-input');
        await carta.selectMenuItem('View', 'Online Data Query');
        await number(maxObjects, 2);
        await number(radius, 0.05);
        await dialog
            .getByRole('button', { name: 'Query', exact: true })
            .click();
        await expect(dialog).toBeHidden();
        expect(queries).toHaveLength(1);
        expect(queries[0]).toContain('SELECT Top 2');

        const catalog = page.locator('.catalog-overlay');
        await catalog.getByTestId('catalog-plot-button').click();
        await carta.selectMenuItem('View', 'Online Data Query');
        await number(maxObjects, 7);
        const canvas = page.locator('#catalog-canvas');
        return async (stage) => {
            await expect(
                dialog.getByRole('tab', { name: 'Catalog', selected: true }),
            ).toBeVisible();
            await expect(
                dialog.getByTestId('catalog-query-database-select-button'),
            ).toHaveText('SIMBAD');
            await expect(maxObjects).toHaveValue('7');
            await expect(radius).toHaveValue('0.05');
            await expect(
                catalog.getByTestId('catalog-table-filtering-info'),
            ).toContainText('total 2 entries');
            await expect(
                catalog.getByTestId('filterable-table-0-2'),
            ).toHaveText('Alpha');
            await expect(
                catalog.getByTestId('filterable-table-1-2'),
            ).toHaveText('Beta');
            expect(queries).toHaveLength(stage === 'saved' ? 1 : 2);
            expect(queries.at(-1)).toBe(queries[0]);
            await expect
                .poll(() => overlayHasInk(canvas, [0, 163, 150]))
                .toBe(true);
            await attachWorkspacePng(info, `${stage}-simbad-overlay`, canvas);
        };
    });
});

test('Workspace restores a HiPS image and its query form', async ({
    page,
}, info) => {
    await page.route('**/MocServer/query?**', (route) =>
        route.fulfill({ json: ['E2E/HiPS'] }),
    );

    await workspaceRoundTrip(
        page,
        info,
        async (carta) => {
            await carta.loadImage('cube.fits');
            const dialog = page.getByRole('dialog', {
                name: 'Online Data Query',
                exact: true,
            });
            const hips = dialog.locator('.hips-query-panel');
            const tab = dialog.getByRole('tab', {
                name: 'HiPS Survey',
                exact: true,
            });
            const field = (label: string) =>
                hips
                    .locator('.bp6-form-group')
                    .filter({
                        has: page.locator('.bp6-label', {
                            hasText: new RegExp(`^${label}`),
                        }),
                    })
                    .locator('input');
            const survey = hips.locator('.survey-input input');
            const width = hips.getByPlaceholder('Width');
            const height = hips.getByPlaceholder('Height');

            await carta.selectMenuItem('View', 'Online Data Query');
            await tab.click();
            await survey.fill('E2E/HiPS');
            await page
                .getByRole('option', { name: /E2E\/HiPS/ })
                .first()
                .click();
            await field('Object').fill('M 31');
            await width.fill('16');
            await height.fill('16');
            await field('Field of view').fill('0.016');
            await hips.locator('select').selectOption('SIN');
            await number(field('Rotation angle'), 45);
            await hips
                .getByRole('button', { name: 'Query', exact: true })
                .click();
            await expect(dialog).toBeHidden();
            await expect(
                page.getByTestId('image-view-header-title'),
            ).toContainText('hips-image.fits');

            await carta.selectMenuItem('View', 'Online Data Query');
            await tab.click();
            await width.fill('24');

            return async () => {
                const requests = await page.evaluate(
                    () => (window as any).workspaceHipsRequests,
                );
                expect(requests).toHaveLength(1);
                expect(requests[0]).toMatchObject({
                    hips: 'E2E/HiPS',
                    object: 'M 31',
                    width: 16,
                    height: 16,
                    fov: 0.016,
                    coordsys: 'icrs',
                    projection: 'SIN',
                    rotationAngle: 45,
                });
                expect((await getFrames(page)).at(-1)).toMatchObject({
                    filename: 'hips-image.fits',
                    width: 16,
                    height: 16,
                    channels: 1,
                });
                await expect.poll(() => pixel(page, 8, 8, true)).toBe(137);

                const restored = expect.configure({
                    soft: true,
                    timeout: 2000,
                });
                await restored(tab).toHaveAttribute('aria-selected', 'true');
                await restored(survey).toHaveValue('E2E/HiPS');
                await restored(field('Object')).toHaveValue('M 31');
                await restored(width).toHaveValue('24');
                await restored(height).toHaveValue('16');
                await restored(field('Field of view')).toHaveValue('0.016');
                await restored(hips.locator('select')).toHaveValue('SIN');
                await restored(field('Rotation angle')).toHaveValue('45');
            };
        },
        {
            configureSession: () =>
                page.evaluate((directory) => {
                    const app = (window as any).app;
                    const backend = app.backendService;
                    const requests: unknown[] = [];
                    (window as any).workspaceHipsRequests = requests;
                    backend.requestRemoteFile = async (request: {
                        fileId: number;
                    }) => {
                        requests.push({ ...request });
                        const openFileAck = await backend.loadFile(
                            directory,
                            'hips-image.fits',
                            '',
                            request.fileId,
                            false,
                        );
                        return { success: true, openFileAck };
                    };
                }, fixtureBrowserPath),
        },
    );
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
        const dialog = contourDialog(page);
        const levelsTab = dialog.getByRole('tab', {
            name: 'Levels',
            exact: true,
        });
        const levelsPanel = dialog.getByRole('tabpanel', {
            name: 'Levels',
            exact: true,
        });
        const generator = levelsPanel.getByRole('button', {
            name: 'min-max-scaling',
            exact: true,
        });
        const parameter = (name: string) =>
            levelsPanel
                .getByText(name, { exact: true })
                .locator('..')
                .getByRole('spinbutton');
        const parameters = [
            ['Min', 0.04],
            ['Max', 0.1],
            ['N', 4],
        ] as const;
        const generatedLevels = [0.04, 0.06, 0.08, 0.1];

        await levelsPanel
            .getByRole('button', { name: 'start-step-multiplier', exact: true })
            .click();
        await page
            .getByRole('menuitem', { name: 'min-max-scaling', exact: true })
            .click();
        for (const [name, value] of parameters) {
            const input = parameter(name);
            await input.click();
            await input.press('ControlOrMeta+A');
            await input.pressSequentially(String(value));
            await input.press('Tab');
            await expect
                .poll(async () => Number(await input.inputValue()))
                .toBe(value);
        }
        await levelsPanel
            .getByRole('button', { name: 'Generate', exact: true })
            .click();
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
                            levels: frame.contourConfig.levels.map(
                                (level: number) => Number(level.toFixed(8)),
                            ),
                            progress: frame.contourProgress,
                            enabled: frame.contourConfig.isEnabled,
                            smoothingMode: frame.contourConfig.smoothingMode,
                            smoothingFactor:
                                frame.contourConfig.smoothingFactor,
                        };
                    }),
                )
                .toEqual({
                    levels: generatedLevels,
                    progress: 1,
                    enabled: true,
                    smoothingMode: 1,
                    smoothingFactor: 3,
                });
            await levelsTab.click();
            const restored = expect.configure({ soft: true });
            await restored(generator).toBeVisible();
            if (await generator.isVisible()) {
                for (const [name, value] of parameters) {
                    await restored
                        .poll(
                            async () =>
                                Number(await parameter(name).inputValue()),
                            {
                                message: `Contour generator parameter ${name}`,
                            },
                        )
                        .toBe(value);
                }
            }
            await dialog
                .getByRole('tab', { name: 'Configuration', exact: true })
                .click();
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

test('Workspace restores Stokes Analysis settings and fractional polarization plots', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('stokes-varying.fits');
        const regionId = await page.evaluate(async () => {
            const frame = (window as any).app.activeFrame;
            const region = await frame.regionSet.addRegionAsync(0, [
                { x: 8, y: 8 },
            ]);
            frame.regionSet.setFocusedRegion(region);
            return region.regionId;
        });
        await carta.selectMenuItem('Widgets', 'Stokes Analysis Widget');
        const widget = page.getByTestId('stokes-0-content');
        const region = widget.getByTestId('region-dropdown');
        await region.selectOption(String(regionId));
        const fractional = widget
            .locator('.stokes-analysis-toolbar')
            .getByRole('checkbox');
        await fractional.check({ force: true });

        const plots = widget.locator('.stokes-widget canvas[role="img"]');
        const profileRatios = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const frame = app.activeFrame;
                const regionId = frame.regionSet.focusedRegion?.regionId;
                const profiles = app.spectralProfiles
                    .get(frame.frameInfo.fileId)
                    ?.get(regionId);
                const values = (coordinate: string) => {
                    const profile = Array.from(
                        profiles?.profiles.get(coordinate)?.values() ?? [],
                    )[0] as { values?: number[] } | undefined;
                    return Array.from(profile?.values ?? []);
                };
                const intensity = values('Iz');
                return {
                    qOverI: values('Qz').map(
                        (value, index) => (value / intensity[index]) * 100,
                    ),
                    uOverI: values('Uz').map(
                        (value, index) => (value / intensity[index]) * 100,
                    ),
                };
            });

        return async (stage) => {
            await expect(widget).toBeVisible();
            await expect(region.locator('option:checked')).toHaveText(
                'Region 1',
            );
            await expect(fractional).toBeChecked();
            await expect.poll(profileRatios).toEqual({
                qOverI: [200, 225, 250, 275, 300],
                uOverI: [300, 275, 250, 225, 200],
            });
            await expect(plots).toHaveCount(4);
            await expect
                .poll(() =>
                    plots.evaluateAll((canvases: HTMLCanvasElement[]) =>
                        canvases.map((canvas) => {
                            const pixels = canvas
                                .getContext('2d')!
                                .getImageData(
                                    0,
                                    0,
                                    canvas.width,
                                    canvas.height,
                                ).data;
                            for (let i = 0; i < pixels.length; i += 4) {
                                const [red, green, blue] = [
                                    pixels[i],
                                    pixels[i + 1],
                                    pixels[i + 2],
                                ];
                                if (
                                    pixels[i + 3] > 0 &&
                                    Math.max(red, green, blue) -
                                        Math.min(red, green, blue) >
                                        40
                                )
                                    return true;
                            }
                            return false;
                        }),
                    ),
                )
                .toEqual([true, true, true, true]);
            await attachWorkspacePng(info, `${stage}-stokes-analysis`, widget);
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

test('Workspace restores a frozen cursor at the saved pixel', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('cube.fits');
        await expect.poll(() => pixel(page, 8, 8)).toBeCloseTo(1.5, 5);
        await page.keyboard.press('f');
        const cursor = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const position = app.activeFrame.cursorInfo?.posImageSpace;
                return {
                    frozen: app.isCursorFrozen,
                    pixel: position && [
                        Math.round(position.x),
                        Math.round(position.y),
                    ],
                    value: app.activeFrame.cursorValue?.value,
                };
            });
        const expected = { frozen: true, pixel: [8, 8], value: 1.5 };
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();

        return async () => {
            await expect.poll(cursor).toEqual(expected);
            const box = (await canvas.boundingBox())!;
            await canvas.hover({
                position: { x: box.width * 0.65, y: box.height * 0.65 },
            });
            await expect.poll(cursor).toEqual(expected);
            await expect(
                page.getByTestId('viewer-cursor-info-bar'),
            ).toContainText('1.5 K');
        };
    });
});

test('Workspace restores a nonadjacent region selection and its focused region', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('cube.fits');
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        await expect(canvas).toBeVisible();
        const box = (await canvas.boundingBox())!;
        for (const x of [0.4, 0.5, 0.6]) {
            await page.getByTestId('point-region-shortcut-button').click();
            await canvas.click({
                position: { x: box.width * x, y: box.height * 0.5 },
            });
        }

        await page.getByTestId('region-list-0-header-title').click();
        const list = page.getByTestId('region-list-table');
        const row = (index: number) =>
            list.getByTestId(`region-list-table-row-${index}`);
        await row(2).click();
        await row(4).click({ modifiers: ['ControlOrMeta'] });
        await list.press('Enter');
        const groupDialog = page.locator('.region-dialog');

        return async () => {
            const restored = expect.configure({ soft: true });
            await restored(row(2)).toHaveClass(/\bselected\b/);
            await restored(row(3)).not.toHaveClass(/\b(selected|active)\b/);
            await restored(row(4)).toHaveClass(/\bactive\b/);
            await restored(
                groupDialog.locator('.bp6-dialog-header'),
            ).toContainText('Editing 2 Regions');
        };
    });
});

test('Workspace restores a floating catalog scatter plot, row selection, and Show Selected Data', async ({
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
        const choose = async (dropdown: Locator, option: string) => {
            await dropdown.click();
            await page
                .getByRole('menuitem', { name: option, exact: true })
                .click();
        };

        await catalog.getByTestId('catalog-plot-button').click();
        await expect
            .poll(() =>
                overlayHasInk(page.locator('#catalog-canvas'), [0, 163, 150]),
            )
            .toBe(true);

        await choose(
            catalog.getByTestId('catalog-rendering-type-dropdown'),
            '2D scatter',
        );
        await choose(
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
            'Flux',
        );
        await choose(
            catalog.getByTestId('catalog-rendering-column-y-dropdown'),
            'Size',
        );
        await catalog.getByTestId('catalog-plot-button').click();

        const scatterPlot = page.getByTestId('catalog-scatter-plot');
        const scatterCanvas = scatterPlot.locator('canvas[data-overlay]');
        await expect(scatterCanvas).toBeVisible();
        await expect
            .poll(() => overlayHasInk(scatterCanvas, [33, 93, 176]))
            .toBe(true);

        // Select two rows and enable "Show selected data"
        await page.evaluate(() => {
            const app = (window as any).app;
            const catalogId = app.catalogStore.activeCatalogFiles[0];
            const profileStore =
                app.catalogStore.catalogProfileStores.get(catalogId);
            const displayStore =
                app.catalogStore.getCatalogDisplayStore(catalogId);
            profileStore.setSelectedPointIndices([1, 3], false);
            displayStore.setShowSelectedData(true);
        });

        const selectionState = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const catalogId = app.catalogStore.activeCatalogFiles[0];
                const profileStore =
                    app.catalogStore.catalogProfileStores.get(catalogId);
                const displayStore =
                    app.catalogStore.getCatalogDisplayStore(catalogId);
                return {
                    selected: Array.from(
                        profileStore?.selectedPointIndices ?? [],
                    ).sort((a: any, b: any) => a - b),
                    showSelectedOnly: displayStore?.isShowingSelectedData,
                };
            });

        const scatterWidgetInfo = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const floating = app.widgetsStore.floatingWidgets.find(
                    (w: any) => w.type === 'catalog-plot',
                );
                const plotStore = floating
                    ? app.widgetsStore.catalogPlotWidgets.get(floating.id)
                    : undefined;
                return {
                    title: floating?.title,
                    xColumn: plotStore?.xColumnName,
                    yColumn: plotStore?.yColumnName,
                    plotType: plotStore?.plotType,
                };
            });

        const savedScatter = await scatterWidgetInfo();

        return async (stage) => {
            const restored = expect.configure({ soft: true });
            await restored(scatterCanvas).toBeVisible();
            await restored
                .poll(() => overlayHasInk(scatterCanvas, [33, 93, 176]))
                .toBe(true);
            await restored.poll(selectionState).toEqual({
                selected: [1, 3],
                showSelectedOnly: true,
            });
            await restored.poll(scatterWidgetInfo).toEqual(savedScatter);
            await attachWorkspacePng(
                info,
                `${stage}-catalog-scatter`,
                scatterPlot,
            );
        };
    });
});

test('Workspace restores a color-blended image, spatial matching, alpha values, and layer visibility', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('m16_f0444w.fits');
        await load(page, 'm16_f0770w.fits', true);
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);
        const list = page.locator('.layer-list-widget').last();
        await list.getByTestId('image-list-1-matching-xy').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.frames[1]?.spatialReference
                            ?.filename ?? null,
                ),
            )
            .toBe('m16_f0444w.fits');

        await page.evaluate(() => {
            const app = (window as any).app;
            const blend = app.imageViewConfigStore.createColorBlending();
            blend.setAlpha(0, 0.8);
            blend.setAlpha(1, 0.45);
            blend.setTitleCustomText('Blended M16');
            blend.toggleContourVisible();
            app.updateActiveImage({ type: 1, store: blend });
        });

        const blendState = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const active = app.activeImage;
                const blend =
                    active?.type === 1
                        ? active.store
                        : Array.from(
                              app.imageViewConfigStore.colorBlendingImageMap.values(),
                          )[0];
                return {
                    activeIsBlend: active?.type === 1,
                    title: blend?.titleCustomText,
                    alpha: blend ? Array.from(blend.alpha) : [],
                    selectedFrames: blend
                        ? blend.selectedFrames.map((f: any) => f.filename)
                        : [],
                    rasterVisible: blend?.isRasterVisible,
                    contourVisible: blend?.isContourVisible,
                    vectorVisible: blend?.isVectorOverlayVisible,
                    spatialMatched: app.frames.map((f: any) => ({
                        filename: f.filename,
                        ref: f.spatialReference?.filename ?? null,
                    })),
                };
            });

        const expected = await blendState();
        expect(expected).toMatchObject({
            activeIsBlend: true,
            title: 'Blended M16',
            alpha: [0.8, 0.45],
            selectedFrames: ['m16_f0770w.fits'],
            rasterVisible: true,
            contourVisible: false,
            vectorVisible: true,
        });

        return async () => {
            await expect
                .configure({ soft: true })
                .poll(blendState)
                .toEqual(expected);
        };
    });
});

test('Workspace restores Image Fitting results, ellipses, and generated model and residual images', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('Gaussian_triple.fits');
        await carta.selectMenuItem('View', 'Image Fitting');

        const dialog = page.locator('.fitting-dialog');
        await dialog
            .locator('.bp6-form-group')
            .filter({ hasText: 'Region' })
            .locator('select')
            .selectOption({ label: 'Image' });
        const components = page.getByTestId('image-fitting-component-input');
        await components.fill('1');
        await components.press('Tab');
        await page.getByTestId('image-fitting-fit-button').click();

        const result = page.getByTestId('image-fitting-result-tab');
        await expect(result).toContainText('Component #1:', { timeout: 30000 });
        await expect(page.getByText(/Image fitting processing/)).toBeHidden({
            timeout: 10000,
        });
        await page.getByRole('tab', { name: 'Full Log' }).click();
        await expect(
            page.getByTestId('image-fitting-full-log-tab'),
        ).toContainText('Gaussian_triple.fits');

        const fittingState = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const source = app.frames.find(
                    (f: any) => f.filename === 'Gaussian_triple.fits',
                );
                return {
                    frames: app.frames.map((f: any) => ({
                        filename: f.filename,
                        width: f.frameInfo.fileInfoExtended.width,
                        height: f.frameInfo.fileInfoExtended.height,
                        generated: !!f.frameInfo.generated,
                    })),
                    hasResult: !!source?.fittingResult,
                    ellipseCount:
                        source?.fittingResultRegionParams?.length ?? 0,
                    components: app.imageFittingStore.components.length,
                };
            });

        const saved = await fittingState();
        expect(saved.frames).toHaveLength(3);
        expect(saved.hasResult).toBe(true);
        expect(saved.ellipseCount).toBe(1);

        return async () => {
            const restored = expect.configure({ soft: true });
            await restored(dialog).toBeVisible();
            await restored(
                dialog.getByRole('tab', { name: 'Full Log', selected: true }),
            ).toBeVisible();
            await restored.poll(fittingState).toEqual(saved);
        };
    });
});

test('Workspace restores region annotations, lock, opacity, dash style, and line sample width', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('cube.fits');
        await page.evaluate(async () => {
            const frame = (window as any).app.activeFrame;
            const rs = frame.regionSet;
            // 3 = RECTANGLE, 1 = LINE, 10 = ANNTEXT, 14 = ANNCOMPASS, 13 = ANNRULER
            const rect = await rs.addRegionAsync(
                3,
                [
                    { x: 6, y: 6 },
                    { x: 4, y: 4 },
                ],
                15,
                'LockedRect',
            );
            rect.setLocked(true);
            rect.setDashLength(0);
            rect.setOpacity(0.5);

            const line = await rs.addRegionAsync(
                1,
                [
                    { x: 2, y: 8 },
                    { x: 14, y: 8 },
                ],
                0,
                'WideLine',
            );
            line.setLineRegionSampleWidth(5);

            const text = await rs.addRegionAsync(
                10,
                [
                    { x: 8, y: 12 },
                    { x: 4, y: 2 },
                ],
                0,
                'NoteAnn',
            );
            text.setText?.('Workspace Note');

            await rs.addRegionAsync(
                14,
                [
                    { x: 4, y: 12 },
                    { x: 2, y: 2 },
                ],
                0,
                'CompassAnn',
            );
            await rs.addRegionAsync(
                13,
                [
                    { x: 3, y: 3 },
                    { x: 12, y: 3 },
                ],
                0,
                'RulerAnn',
            );
        });

        const regionSummary = () =>
            page.evaluate(() => {
                const rs = (window as any).app.activeFrame.regionSet;
                return rs.regions
                    .filter((r: any) => r.regionId > 0)
                    .map((r: any) => ({
                        name: r.name,
                        type: r.regionType,
                        locked: r.isLocked,
                        dashLength: r.dashLength,
                        opacity: r.opacity,
                        sampleWidth: r.lineRegionSampleWidth,
                        text: r.text ?? null,
                    }))
                    .sort((a: any, b: any) => a.name.localeCompare(b.name));
            });

        const saved = await regionSummary();
        expect(saved).toHaveLength(5);

        return async () => {
            await expect
                .configure({ soft: true })
                .poll(regionSummary)
                .toEqual(saved);
        };
    });
});

test('Workspace restores animator settings, time series membership, multi-panel grid, and offset coordinates', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('cube.fits');
        await load(page, 'time-early.fits', true);
        await load(page, 'time-late.fits', true);
        await activate(page, 'cube.fits');

        await page.evaluate(() => {
            const app = (window as any).app;
            const [cube, early, late] = app.frames;
            cube.setAnimationRange([1, 3]);
            cube.setTitleCustomText('Custom Cube Title');
            cube.setOffsetCenter(8, 8);
            if (!cube.isOffsetCoord) cube.toggleOffsetCoord();
            app.setTimeSeriesMember(early, true);
            app.setTimeSeriesMember(late, true);
            app.animatorStore.setFrameRate(10);
            app.animatorStore.setStep(2);
            app.animatorStore.setPlayMode(2); // BOUNCING
            app.imageViewConfigStore.setMultiPanelEnabled(true);
            app.imageViewConfigStore.setMultiPanelMode('fixed');
            app.imageViewConfigStore.setPanelRows(1);
            app.imageViewConfigStore.setPanelColumns(2);
            app.preferenceStore.setPreference('pixelGridVisible', true);
        });

        const sessionState = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const cube = app.frames.find(
                    (f: any) => f.filename === 'cube.fits',
                );
                return {
                    animRange: cube?.animationChannelRange
                        ? Array.from(cube.animationChannelRange)
                        : null,
                    title: cube?.titleCustomText,
                    offsetCoord: cube?.isOffsetCoord,
                    timeSeries: app.timeSeriesStore.members
                        .map((f: any) => f.filename)
                        .sort(),
                    frameRate: app.animatorStore.frameRate,
                    step: app.animatorStore.step,
                    playMode: app.animatorStore.playMode,
                    multiPanel: app.imageViewConfigStore.isMultiPanelEnabled,
                    panelMode: app.imageViewConfigStore.multiPanelMode,
                    panelRows: app.imageViewConfigStore.panelRows,
                    panelColumns: app.imageViewConfigStore.panelColumns,
                    pixelGrid: app.imageViewConfigStore.isPixelGridVisible,
                };
            });

        const saved = await sessionState();
        expect(saved).toMatchObject({
            animRange: [1, 3],
            title: 'Custom Cube Title',
            offsetCoord: true,
            timeSeries: ['time-early.fits', 'time-late.fits'],
            frameRate: 10,
            step: 2,
            playMode: 2,
            multiPanel: true,
            panelMode: 'fixed',
            panelRows: 1,
            panelColumns: 2,
            pixelGrid: true,
        });

        return async () => {
            await expect
                .configure({ soft: true })
                .poll(sessionState)
                .toEqual(saved);
            await expect.soft(page.locator('.image-panel-div')).toHaveCount(2);
        };
    });
});

test('Workspace restores a floating PV preview viewer, per-cube histogram, and statistics/histogram widgets', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await workspaceRegion(page, 'line');

        // Enable per-cube histogram on active frame
        await page.evaluate(() => {
            const app = (window as any).app;
            const frame = app.activeFrame;
            frame.renderConfig.setUseCubeHistogram(true);
            app.requestCubeHistogram(frame.frameInfo.fileId, 'z');
        });
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame.renderConfig
                                .cubeHistogramProgress,
                    ),
                { timeout: 30000 },
            )
            .toBe(1);

        // Open PV Generator and launch floating PV Preview Viewer
        await carta.selectMenuItem('Widgets', 'PV Generator');
        await pvCutDropdown(page).selectOption({ label: 'Region 1' });
        await previewButton(page).click();
        const preview = page.locator('.floating-widget').filter({
            has: page
                .locator('.floating-title')
                .filter({ hasText: 'PV Preview Viewer' }),
        });
        await expect(preview).toBeVisible({ timeout: 30000 });
        await expect
            .poll(
                () =>
                    page.evaluate(() => {
                        const pvStore = Array.from(
                            (
                                window as any
                            ).app.widgetsStore.pvGeneratorWidgets.values(),
                        )[0] as any;
                        return !!pvStore?.previewFrame;
                    }),
                { timeout: 30000 },
            )
            .toBe(true);

        // Open Statistics and Histogram widgets
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Statistics Widget',
        ]);
        await carta.selectMenuItem('Widgets', 'Histogram Widget');

        const state = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const cube = app.frames.find(
                    (f: any) =>
                        f.filename === 'HD163296_13CO_2-1_subimage.fits',
                );
                const pvStore = Array.from(
                    app.widgetsStore.pvGeneratorWidgets.values(),
                )[0] as any;
                return {
                    useCubeHist: cube?.renderConfig.isUsingCubeHistogram,
                    cubeHistProgress: cube?.renderConfig.cubeHistogramProgress,
                    hasPreviewFrame: !!pvStore?.previewFrame,
                    previewWidth:
                        pvStore?.previewFrame?.frameInfo?.fileInfoExtended
                            ?.width ?? 0,
                    previewHeight:
                        pvStore?.previewFrame?.frameInfo?.fileInfoExtended
                            ?.height ?? 0,
                };
            });

        const saved = await state();
        expect(saved.useCubeHist).toBe(true);
        expect(saved.hasPreviewFrame).toBe(true);
        expect(saved.previewWidth).toBeGreaterThan(0);

        return async (stage) => {
            const restored = expect.configure({ soft: true });
            await restored(preview).toBeVisible();
            await restored.poll(state, { timeout: 30000 }).toEqual(saved);
            await attachWorkspacePng(info, `${stage}-pv-preview`, preview);
        };
    });
});

test('Opening a single-panel workspace clears Channel Map mode from the current session', async ({
    page,
}, info) => {
    info.setTimeout(90000);
    page.setDefaultTimeout(10000);
    const name = 'e2e-single-panel-workspace';
    let saved: { date: number } | undefined;
    await page.route('**/database/list/workspaces', (route) =>
        route.fulfill({
            json: {
                success: true,
                workspaces: saved ? [{ name, date: saved.date }] : [],
            },
        }),
    );
    await page.route(/\/database\/workspace(?:\/.*)?$/, async (route) => {
        if (route.request().method() === 'PUT') {
            saved = route.request().postDataJSON().workspace;
        }
        await route.fulfill({ json: { success: !!saved, workspace: saved } });
    });

    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.loadImage('cube.fits');

    // Save a normal single-panel workspace (channel map disabled)
    await carta.selectMenuItem('File', 'Save Workspace');
    const save = page.getByRole('dialog', {
        name: 'Save Workspace',
        exact: true,
    });
    await save.getByPlaceholder('Enter workspace name').fill(name);
    await save.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(save).toBeHidden();
    expect(saved).toBeDefined();

    // Now enable Channel Map mode in the current live session
    await carta.selectMenuItem('Widgets', 'Channel Map Control');
    await toggle(page, 'Enable channel map mode');
    await toggle(page, 'Show channel string');
    await setNumber(
        widget(page).getByRole('spinbutton', { name: 'Number of rows' }),
        1,
    );
    await expectChannels(page, [0, 1]);

    // Open the saved single-panel workspace directly from this dirty session
    await carta.selectMenuItem('File', 'Open Workspace');
    const open = page.getByRole('dialog', {
        name: 'Open Workspace',
        exact: true,
    });
    await open.getByText(name, { exact: true }).first().click();
    await open.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(open).toBeHidden({ timeout: 30000 });
    await expect
        .poll(() => page.evaluate(() => (window as any).app.isLoadingWorkspace))
        .toBe(false);

    // Channel Map mode should be cleared, restoring the single-panel view
    const restored = expect.configure({ soft: true });
    await restored
        .poll(() =>
            page.evaluate(
                () => (window as any).app.channelMapStore.isChannelMapEnabled,
            ),
        )
        .toBe(false);
    await restored(labels(page)).toHaveCount(0);
    await attachWorkspacePng(
        info,
        'restored-from-channel-map-session',
        page.getByTestId('viewer-div').first(),
    );
});

test('Restored floating catalog scatter plot keeps its componentId, updates title, and closes cleanly', async ({
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
        const choose = async (dropdown: Locator, option: string) => {
            await dropdown.click();
            await page
                .getByRole('menuitem', { name: option, exact: true })
                .click();
        };
        await choose(
            catalog.getByTestId('catalog-rendering-type-dropdown'),
            '2D scatter',
        );
        await choose(
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
            'Flux',
        );
        await choose(
            catalog.getByTestId('catalog-rendering-column-y-dropdown'),
            'Size',
        );
        await catalog.getByTestId('catalog-plot-button').click();

        const scatterPlot = page.getByTestId('catalog-scatter-plot');
        await expect(scatterPlot.locator('canvas[data-overlay]')).toBeVisible();

        const plotBindingInfo = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const floating = app.widgetsStore.floatingWidgets.find(
                    (w: any) => w.type === 'catalog-plot',
                );
                const bindingComponentIds =
                    app.catalogStore.widgetBindings.componentIds();
                return {
                    floatingId: floating?.id,
                    floatingComponentId: floating?.componentId,
                    bindingComponentIds,
                    matchesBinding: bindingComponentIds.includes(
                        floating?.componentId,
                    ),
                    title: floating?.title,
                };
            });

        const saved = await plotBindingInfo();
        expect(saved.matchesBinding).toBe(true);

        return async (stage) => {
            const restored = expect.configure({ soft: true });
            await restored.poll(plotBindingInfo).toMatchObject({
                matchesBinding: true,
                title: saved.title,
            });
            if (stage === 'restored') {
                const floatingWidget = page
                    .locator('.floating-widget')
                    .filter({ has: scatterPlot });
                await floatingWidget
                    .locator(
                        '.floating-header button[title="Close"], .floating-header .bp6-icon-cross',
                    )
                    .first()
                    .click();
                await restored(scatterPlot).toBeHidden();
                await restored
                    .poll(() =>
                        page.evaluate(
                            () =>
                                (
                                    window as any
                                ).app.catalogStore.widgetBindings.componentIds()
                                    .length,
                        ),
                    )
                    .toBe(0);
            }
        };
    });
});

test('Workspace restores rest frequency, beam styling, WCS Galactic system, custom axis labels, and unlocked Contour source', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await load(page, 'HD163296_C18O_2-1_subimage.fits', true);

        await page.evaluate(() => {
            const app = (window as any).app;
            const [first, second] = app.frames;
            // Custom rest frequency on first frame
            first.restFreqStore.setCustomVal(220.5);
            // Custom beam styling on first frame
            first.overlayBeamSettings.setVisible(true);
            first.overlayBeamSettings.setColor('#00FF00');
            first.overlayBeamSettings.setShiftX(15);
            first.overlayBeamSettings.setShiftY(20);
            // Custom WCS system + custom axis label
            app.overlaySettings.global.setSystem('GALACTIC');
            app.overlaySettings.labels.setCustomText(true);
            app.overlaySettings.labels.setCustomLabelX('Custom Lon');
            // Unlock Contour dialog to point to first frame while second is active
            app.setContourDataSourceUnlocked(first);
            app.updateActiveImageByFrame(second);
        });

        const state = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const first = app.frames.find(
                    (f: any) =>
                        f.filename === 'HD163296_13CO_2-1_subimage.fits',
                );
                return {
                    restFreq: first?.restFreqStore.customRestFreq.value,
                    beamColor: first?.overlayBeamSettings.color,
                    beamShiftX: first?.overlayBeamSettings.shiftX,
                    beamShiftY: first?.overlayBeamSettings.shiftY,
                    wcsSystem: app.overlaySettings.global.system,
                    hasCustomLabel: app.overlaySettings.labels.hasCustomText,
                    customLabelX: app.overlaySettings.labels.customLabelX,
                    contourLocked: app.isFrameLockedToContour,
                    contourSource: app.contourDataSource?.filename,
                };
            });

        const saved = await state();
        expect(saved).toMatchObject({
            restFreq: 220.5,
            beamColor: '#00FF00',
            beamShiftX: 15,
            beamShiftY: 20,
            wcsSystem: 'GALACTIC',
            hasCustomLabel: true,
            customLabelX: 'Custom Lon',
            contourLocked: false,
            contourSource: 'HD163296_13CO_2-1_subimage.fits',
        });

        return async () => {
            await expect.configure({ soft: true }).poll(state).toEqual(saved);
        };
    });
});

async function workspaceProfileCheck(
    page: Page,
    info: Parameters<typeof attachWorkspacePng>[0],
    x: number,
    y: number,
    spectral = false,
) {
    for (const id of [
        'spatial-profiler-0-content',
        'spatial-profiler-1-content',
    ]) {
        await page
            .getByTestId(id)
            .getByTestId('region-dropdown')
            .selectOption({ label: 'Cursor' });
    }
    if (spectral) {
        await page
            .getByTestId('spectral-profiler-0-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await page
            .getByRole('menuitem', { name: 'Cursor', exact: true })
            .click();
    }
    let saved: number[][];
    return async (stage: 'saved' | 'restored') => {
        await pixel(page, x, y, true);
        const values = () =>
            page.evaluate(
                ({ includeSpectral, x, y }) => {
                    const app = (window as any).app;
                    const profile = app.spatialProfiles.get(
                        `${app.activeFrame.frameInfo.fileId}-0`,
                    );
                    // Compare the same coordinates even when the backend streams a wider profile after reopening.
                    const spatial = (['x', 'y'] as const).map((axis) => {
                        const data = profile?.getProfile(axis);
                        const center = axis === 'x' ? x : y;
                        return [-2, -1, 0, 1, 2].map(
                            (offset) =>
                                data?.values[
                                    (center + offset - (data.start ?? 0)) /
                                        (data.mip || 1)
                                ],
                        );
                    });
                    if (!includeSpectral) return spatial;
                    const points =
                        app.widgetsStore.spectralProfileWidgets.get(
                            'spectral-profiler-0',
                        )?.plotData?.data?.[0] ?? [];
                    return [
                        ...spatial,
                        points.map(
                            (point: { y: number }) => point.y,
                        ) as number[],
                    ];
                },
                { includeSpectral: spectral, x, y },
            );
        await expect
            .poll(async () =>
                (await values()).every(
                    (profile) =>
                        profile.length > 0 && profile.every(Number.isFinite),
                ),
            )
            .toBe(true);
        if (stage === 'saved') saved = await values();
        else await expect.poll(values).toEqual(saved);

        const spatial = page.locator(
            '.spatial-profiler-widget:visible .profile-plot',
        );
        await expect(spatial).toHaveCount(2);
        for (const [index, plot] of (await spatial.all()).entries()) {
            await attachWorkspacePng(
                info,
                `${stage}-spatial-profile-${index}`,
                plot,
            );
        }
        if (spectral) {
            const plot = page
                .getByTestId('spectral-profiler-0-content')
                .locator('.line-plot-component .annotation-stage canvas')
                .first();
            await expect(plot).toBeVisible();
            await attachWorkspacePng(info, `${stage}-spectral-profile`, plot);
        }
    };
}

test('Workspace restores two appended spatial matches, a shared region, and the active view', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async (carta) => {
        const files = ['cube.fits', 'matching-cube.fits', 'time-late.fits'];
        const reference = files[1];
        await carta.loadImage(files[0]);
        for (const file of files.slice(1)) {
            await load(page, file, true);
        }

        await page.getByTestId('layer-list-0-header-title').click();
        const image = (index: number) =>
            page.getByTestId(`image-list-${index}-image-name`);
        await image(1).click({ button: 'right' });
        await page
            .getByRole('menuitem', {
                name: 'Set as spatial reference',
                exact: true,
            })
            .click();
        for (const index of [0, 2]) {
            await page.getByTestId(`image-list-${index}-matching-xy`).click();
        }

        const matching = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                return {
                    reference: app.spatialReference?.filename,
                    links: app.frames.map(
                        (frame: any) =>
                            frame.spatialReference?.filename ?? null,
                    ),
                };
            });
        const expectedMatching = {
            reference,
            links: [reference, null, reference],
        };
        await expect.poll(matching).toEqual(expectedMatching);
        await activate(page, reference);
        await workspaceRegion(page, 'rectangle');
        await activate(page, files[2]);

        // Pan through a matched image. Its WCS is shifted from the reference.
        await page.evaluate(() =>
            (window as any).app.activeFrame.setCenter(6, 8),
        );
        const view = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const round = (value: number) => Number(value.toFixed(5));
                const sharedRegion =
                    app.spatialReference.regionSet.regions.find(
                        (region: any) => region.regionId > 0,
                    );
                return {
                    center: [
                        round(app.spatialReference.center.x),
                        round(app.spatialReference.center.y),
                    ],
                    zoom: round(app.spatialReference.zoomLevel),
                    rectangle: sharedRegion?.controlPoints.map(
                        ({ x, y }: { x: number; y: number }) => [
                            round(x),
                            round(y),
                        ],
                    ),
                    sharedBy: app.frames
                        .filter(
                            (frame: any) =>
                                frame.regionSet ===
                                app.spatialReference.regionSet,
                        )
                        .map((frame: any) => frame.filename),
                };
            });
        const initialZoom = (await view()).zoom;
        await page.getByTestId('viewer-div').hover();
        await page.getByTestId('zoom-in-button').click();
        await expect
            .poll(async () => (await view()).zoom)
            .toBeGreaterThan(initialZoom);
        const savedView = await view();
        expect(savedView.center[0]).toBeGreaterThan(7.5);
        expect(savedView.rectangle).toHaveLength(2);
        expect(savedView.sharedBy).toEqual(files);

        await page.locator('#SpectralProfilerButton').click();
        const checkProfiles = await workspaceProfileCheck(
            page,
            info,
            8,
            8,
            true,
        );
        const samples: number[][] = [];
        return async (stage) => {
            await expect.poll(matching).toEqual(expectedMatching);
            await expect.poll(view).toEqual(savedView);
            await expect(
                page.getByTestId('image-view-header-title'),
            ).toContainText(files[2]);
            await checkProfiles(stage);
            for (const [index, file] of files.entries()) {
                await activate(page, file);
                await page.evaluate(() =>
                    (window as any).app.waitForImageData(),
                );
                const rgba = () => renderedPixelRgb(page, 8, 8);
                if (stage === 'saved') {
                    await expect.poll(async () => (await rgba())[3]).toBe(255);
                    samples.push(await rgba());
                } else {
                    await expect.poll(rgba).toEqual(samples[index]);
                }
            }
        };
    });
});

test('Workspace restores a loaded Time Series on its middle epoch and keeps navigation working', async ({
    page,
}, info) => {
    await workspaceRoundTrip(page, info, async () => {
        const dates = ['2015-05-24', '2020-03-17', '2024-08-13'];
        const files = dates.map((date) => `J0423-0120_${date}.fits`);
        const browser = page.getByTestId('file-browser-dialog');
        await browser.locator('.edit-path-button').click();
        const directory = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await directory.fill(`${fixtureBrowserPath}/time_series`);
        await directory.press('Enter');
        for (const [index, file] of [files[2], files[0], files[1]].entries()) {
            await browser
                .getByText(file, { exact: true })
                .click({ modifiers: index ? ['ControlOrMeta'] : [] });
        }
        await browser
            .getByTestId('file-browser-load-as-time-series-button')
            .click();
        await expect(browser).toBeHidden();
        const mode = page.getByTestId('animator-time-series-mode');
        const slider = page.getByTestId('animator-time-series-slider');
        const next = page.getByTestId('animator-next-button');
        const previous = page.getByTestId('animator-previous-button');
        const series = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                return {
                    epochs: app.timeSeriesStore.elements.map(
                        (element: any) => ({
                            file: element.frame.filename,
                            date: element.isoUtc.slice(0, 10),
                            reference:
                                element.frame.spatialReference?.filename ??
                                null,
                        }),
                    ),
                };
            });
        const epochs = files.map((file, index) => ({
            file,
            date: dates[index],
            reference: index === 2 ? null : files[2],
        }));
        await next.click();

        const checkProfiles = await workspaceProfileCheck(page, info, 150, 150);
        const checkEpoch = async (index: number, value: number) => {
            await expect(
                page.getByTestId('image-view-header-title'),
            ).toContainText(files[index]);
            await expect
                .poll(() => pixel(page, 150, 150, true))
                .toBeCloseTo(value, 5);
            await expect
                .poll(async () => (await renderedPixelRgb(page, 150, 150))[3])
                .toBe(255);
        };
        return async (stage) => {
            await expect(mode).toBeChecked();
            await expect(slider).toBeVisible();
            await checkEpoch(1, 1.8255513);
            await checkProfiles(stage);
            if (stage === 'restored') {
                await expect.poll(series).toEqual({ epochs });
                await next.click();
                await checkEpoch(2, 3.5052781);
                await attachWorkspacePng(
                    info,
                    'restored-next-epoch',
                    page.getByTestId('viewer-div'),
                );
                await previous.click();
                await checkEpoch(1, 1.8255513);
            }
        };
    });
});

test('Workspace reopens a saved cube after unsaved image, cursor and widget edits', async ({
    page,
}, info) => {
    const frozen = () =>
        page.evaluate(() => (window as any).app.isCursorFrozen);
    const histogram = page.locator('.histogram-widget');
    const contour = contourDialog(page);
    await workspaceRoundTrip(
        page,
        info,
        async (carta) => {
            await carta.loadImage('cube.fits');
            await page.getByTestId('animator-0-header-title').click();
            await page.getByTestId('animator-next-button').click();
            return async (stage) => {
                await expect.configure({ soft: true }).poll(frozen).toBe(false);
                await expect.soft(histogram).toBeHidden();
                await expect.soft(contour).toBeHidden();
                await expect(
                    page.getByTestId('image-view-header-title'),
                ).toContainText('cube.fits');
                await expect
                    .poll(() => pixel(page, 8, 8, true))
                    .toBeCloseTo(3, 5);
                if (stage === 'restored') {
                    await page.getByTestId('contour-dialog-button').click();
                    await expect(contour).toBeVisible();
                    await expect(contour.locator('.bp6-tag')).toHaveCount(0);
                }
            };
        },
        {
            editAfterSave: async (carta) => {
                await load(page, 'single.fits', true);
                await page.keyboard.press('f');
                await expect.poll(frozen).toBe(true);
                await carta.selectMenuItem('Widgets', 'Histogram Widget');
                await expect(histogram).toBeVisible();
                await page.getByTestId('contour-dialog-button').click();
                const level = contour
                    .getByTestId('contour-config-level-input-form')
                    .locator('input');
                await level.fill('0.75');
                await level.press('Enter');
                await expect(contour.locator('.bp6-tag')).toContainText('0.75');
            },
        },
    );
});
