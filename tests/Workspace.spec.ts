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
