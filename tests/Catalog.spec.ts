import {
    expect,
    test,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const imageDirectory =
    process.env.CATALOG_IMAGE_DIRECTORY ??
    '/carta_build/e2e-lite/test_data/catalogs';
const catalogDirectory = process.env.CATALOG_TABLE_DIRECTORY ?? imageDirectory;
const fileBrowser = (page: Page) => page.locator('.file-browser-dialog');
const catalogWidget = (page: Page) =>
    page
        .locator('.catalog-overlay')
        .filter({ has: page.getByTestId('catalog-file-dropdown') });

async function pickFile(
    page: Page,
    name: string,
    directory: string,
    list: 'fileList' | 'catalogFileList',
    action: string,
) {
    const dialog = fileBrowser(page);
    await expect(dialog).toBeVisible();
    await dialog.locator('.edit-path-button').click();
    const input = dialog.getByPlaceholder(
        'Input directory path with respect to the top level folder',
    );
    await input.fill(directory);
    await input.press('Enter');
    await expect
        .poll(() =>
            page.evaluate(
                ({ list, directory, name }) => {
                    const files = (window as any).app?.fileBrowserStore?.[list];
                    return (
                        files?.directory === directory &&
                        files.files?.some((file: any) => file.name === name)
                    );
                },
                { list, directory, name },
            ),
        )
        .toBe(true);
    const filter = dialog.getByRole('textbox', {
        name: 'Filter by filename with fuzzy',
    });
    await filter.fill(name);
    await filter.press('Enter');
    await dialog.getByText(name, { exact: true }).first().click();
    await dialog.getByRole('button', { name: action, exact: true }).click();
    await expect(dialog).toBeHidden();
}

async function openImage(page: Page, name = 'catalog-image.fits') {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await expect(fileBrowser(page)).toBeVisible();
    const usage = page.getByRole('button', {
        name: 'No, do not send usage data',
    });
    if (await usage.isVisible()) await usage.click();
    const alert = page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'OK' });
    if (await alert.isVisible()) await alert.click();
    await pickFile(page, name, imageDirectory, 'fileList', 'Load');
    await expect(page.getByTestId('spatial-profiler-0-content')).toBeVisible();
    await expectCanvasInk(page, '#raster-canvas');
    return carta;
}

async function openCatalog(page: Page, name: string, expectedEntries = 5) {
    await new PlaywrightDevPage(page).selectMenuItem('File', 'Import Catalog');
    await pickFile(
        page,
        name,
        catalogDirectory,
        'catalogFileList',
        'Load catalog',
    );
    const catalog = catalogWidget(page);
    await expectCatalogInfo(catalog, `total ${expectedEntries} entries`);
    return catalog;
}

async function ink(page: Page, selector: string) {
    return page.evaluate((selector) => {
        const source = document.querySelector<HTMLCanvasElement>(selector);
        if (!source?.width || !source.height) return 0;
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d')!;
        context.drawImage(source, 0, 0);
        const rgba = context.getImageData(0, 0, copy.width, copy.height).data;
        let visible = 0;
        for (let offset = 3; offset < rgba.length; offset += 4)
            if (rgba[offset]) visible++;
        return visible;
    }, selector);
}

async function visibleSources(page: Page, imageSize = 16) {
    return page.evaluate((imageSize) => {
        const store = (window as any).app.catalogStore;
        const ids = store.activeCatalogFiles;
        const points = store.catalogGLData.get(ids[ids.length - 1]);
        const x = points.x as Float32Array;
        const y = points.y as Float32Array;
        return Array.from(x).filter(
            (value, i) =>
                value >= 0 &&
                value < imageSize &&
                y[i] >= 0 &&
                y[i] < imageSize,
        ).length;
    }, imageSize);
}

async function expectCanvasInk(page: Page, selector: string) {
    await expect.poll(() => ink(page, selector)).toBeGreaterThan(0);
}

async function expectCatalogInfo(catalog: Locator, text: string) {
    await expect(
        catalog.getByTestId('catalog-table-filtering-info'),
    ).toContainText(text);
}

async function plotOverlay(
    page: Page,
    catalog: Locator,
    expectedSources: number,
    imageSize = 16,
) {
    await catalog.getByTestId('catalog-plot-button').click();
    await expect
        .poll(() => visibleSources(page, imageSize))
        .toBe(expectedSources);
    if (expectedSources > 0) await expectCanvasInk(page, '#catalog-canvas');
}

async function plotChart(
    page: Page,
    catalog: Locator,
    type: 'histogram' | 'scatter',
) {
    await catalog.getByTestId('catalog-plot-button').click();
    await expect(
        page
            .getByTestId(`catalog-${type}-plot`)
            .locator('svg.main-svg')
            .first(),
    ).toBeVisible();
}

const plotGraph = (page: Page, type: 'histogram' | 'scatter') =>
    page.getByTestId(`catalog-${type}-plot`).locator('.js-plotly-plot');

async function selectedSourceIndices(page: Page) {
    return page.evaluate(() => {
        const catalogStore = (window as any).app.catalogStore;
        const ids = catalogStore.activeCatalogFiles;
        return Array.from(
            catalogStore.catalogProfileStores.get(ids[ids.length - 1])
                .selectedPointIndices,
        );
    });
}

async function expectSelectedSources(
    page: Page,
    catalog: Locator,
    indices: number[],
) {
    await expect.poll(() => selectedSourceIndices(page)).toEqual(indices);
    for (const index of indices) {
        await expect(
            catalog
                .getByTestId(`filterable-table-${index}-0`)
                .locator(
                    'xpath=ancestor::div[contains(@class,"bp6-table-cell")][1]',
                ),
        ).toHaveClass(/intent-danger/);
    }
}

async function clickPlotPoint(
    page: Page,
    type: 'histogram' | 'scatter',
    x: number,
    y: number,
) {
    const graph = plotGraph(page, type);
    const position = await graph.evaluate(
        (element: any, point) => {
            const bounds = element.getBoundingClientRect();
            const scaleX = bounds.width / element.offsetWidth;
            const scaleY = bounds.height / element.offsetHeight;
            return {
                x:
                    (element._fullLayout.xaxis.d2p(point.x) +
                        element._fullLayout.xaxis._offset) *
                    scaleX,
                y:
                    (element._fullLayout.yaxis.d2p(point.y) +
                        element._fullLayout.yaxis._offset) *
                    scaleY,
            };
        },
        { x, y },
    );
    await graph.click({ position });
}

async function choose(page: Page, button: Locator, option: string) {
    await button.click();
    await page
        .getByRole('menuitem', { name: option, exact: true })
        .last()
        .click();
}

async function checkViewerAndProfiler(
    page: Page,
    testInfo: TestInfo,
    label: string,
) {
    await expect(page.locator('#raster-canvas').first()).toBeVisible();
    await expect(page.getByTestId('x-profiler-info')).toBeVisible();
    const profile = page
        .locator('.spatial-profiler-widget .profile-plot')
        .first();
    await expect(profile.locator('canvas').first()).toBeVisible();
    await expectCanvasInk(
        page,
        '.spatial-profiler-widget .profile-plot canvas',
    );
    await page
        .getByTestId('viewer-div')
        .screenshot({ path: testInfo.outputPath(`${label}-viewer.png`) });
    await profile.screenshot({
        path: testInfo.outputPath(`${label}-spatial-profile.png`),
    });
}

test.describe('Catalog widget', () => {
    test.setTimeout(90_000);

    test('loads sky sources, filters and sorts the table, and edits overlay styling', async ({
        page,
    }, testInfo) => {
        const carta = await openImage(page);
        const catalog = await openCatalog(page, 'catalog-sky.vot');
        await expect(
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
        ).toContainText('RAJ2000');
        await expect(
            catalog.getByTestId('catalog-rendering-column-y-dropdown'),
        ).toContainText('DEJ2000');
        await expect(catalog.getByTestId('filterable-table-0-0')).toHaveText(
            'Alpha',
        );
        await expect(catalog.getByTestId('filterable-table-0-3')).toHaveText(
            '10',
        );
        await plotOverlay(page, catalog, 4);

        await catalog
            .getByTestId('filterable-table-filter-input-3')
            .first()
            .fill('>=30');
        await catalog.getByTestId('catalog-filter-button').click();
        await expectCatalogInfo(catalog, '3 filtered entries');
        await catalog.getByTestId('filterable-table-header-3').last().click();
        await expectCatalogInfo(catalog, '3 filtered entries');
        await catalog.getByTestId('catalog-reset-button').click();
        await expectCatalogInfo(catalog, 'total 5 entries');
        await catalog.getByTestId('catalog-plot-button').click();

        const maxRows = catalog.locator('.catalog-max-rows input');
        await maxRows.fill('2');
        await maxRows.press('Tab');
        await expectCatalogInfo(catalog, 'top 2 entries');
        await maxRows.fill('5');
        await maxRows.press('Tab');

        await catalog.getByTestId('catalog-size-button').click();
        const size = page.getByTestId('catalog-settings-size-input');
        await expect(size).toBeVisible();
        await size.fill('14');
        await size.press('Tab');
        const sizeColumn = page.getByTestId(
            'catalog-settings-major-size-column-dropdown',
        );
        await choose(page, sizeColumn, 'Size');
        await expect(sizeColumn).toContainText('Size');
        const sizeMapping = await page.evaluate(() => {
            const catalogStore = (window as any).app.catalogStore;
            const ids = catalogStore.activeCatalogFiles;
            const store = catalogStore.getCatalogWidgetStore(
                ids[ids.length - 1],
            );
            return {
                catalogValues: Array.from(store.sizeMapData) as number[],
                overlaySizes: Array.from(store.sizeArray()) as number[],
            };
        });
        expect(sizeMapping.catalogValues).toEqual([4, 6, 8, 10, 12]);
        expect(new Set(sizeMapping.overlaySizes).size).toBe(5);
        expect(sizeMapping.overlaySizes).toEqual(
            [...sizeMapping.overlaySizes].sort((a, b) => a - b),
        );
        await page.getByTestId('catalog-settings-color-tab-title').click();
        await expect(
            page.getByTestId('catalog-settings-color-column-dropdown'),
        ).toBeVisible();
        await choose(
            page,
            page.getByTestId('catalog-settings-color-column-dropdown'),
            'Flux',
        );
        await expect(
            page.getByTestId('catalog-settings-color-column-dropdown'),
        ).toContainText('Flux');
        await page
            .getByTestId('catalog-settings-orientation-tab-title')
            .click();
        await expect(
            page.getByTestId('catalog-settings-orientation-column-dropdown'),
        ).toBeVisible();
        await choose(
            page,
            page.getByTestId('catalog-settings-orientation-column-dropdown'),
            'Size',
        );
        await carta.closeWidget('catalog-overlay-floating-settings');
        await expectCanvasInk(page, '#catalog-canvas');
        await checkViewerAndProfiler(page, testInfo, 'sky-catalog');
    });

    test('verifies histogram bins and selects catalog rows from a bar', async ({
        page,
    }, testInfo) => {
        await openImage(page);
        const catalog = await openCatalog(page, 'catalog-sky.vot');
        await choose(
            page,
            catalog.getByTestId('catalog-rendering-type-dropdown'),
            'Histogram',
        );
        await choose(
            page,
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
            'Flux',
        );
        await plotChart(page, catalog, 'histogram');
        const graph = plotGraph(page, 'histogram');
        const histogram = await graph.evaluate((element: any) => ({
            values: Array.from(element.data[0].x),
            counts: element.calcdata[0].map((bin: any) => bin.y),
        }));
        expect(histogram.values).toEqual([10, 20, 30, 40, 50]);
        expect(histogram.counts).toEqual([2, 1, 2]);
        const bars = graph.locator('.barlayer .point path');
        await expect(bars).toHaveCount(3);
        await clickPlotPoint(page, 'histogram', 15, 1.5);
        await expectSelectedSources(page, catalog, [0, 1]);
        await checkViewerAndProfiler(page, testInfo, 'histogram-selection');
    });

    test('verifies scatter values and selects a catalog row from a point', async ({
        page,
    }, testInfo) => {
        await openImage(page);
        const catalog = await openCatalog(page, 'catalog-sky.vot');
        await choose(
            page,
            catalog.getByTestId('catalog-rendering-type-dropdown'),
            '2D scatter',
        );
        await choose(
            page,
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
            'Flux',
        );
        await choose(
            page,
            catalog.getByTestId('catalog-rendering-column-y-dropdown'),
            'Size',
        );
        await plotChart(page, catalog, 'scatter');
        const graph = plotGraph(page, 'scatter');
        const scatter = await graph.evaluate((element: any) => ({
            x: Array.from(element.data[0].x),
            y: Array.from(element.data[0].y),
        }));
        expect(scatter).toEqual({
            x: [10, 20, 30, 40, 50],
            y: [4, 6, 8, 10, 12],
        });
        await clickPlotPoint(page, 'scatter', 30, 8);
        await expectSelectedSources(page, catalog, [2]);
        await expect
            .poll(() =>
                graph.evaluate((element: any) =>
                    Array.from(element.data[0].selectedpoints ?? []),
                ),
            )
            .toEqual([2]);
        await checkViewerAndProfiler(page, testInfo, 'scatter-selection');
    });

    test('renders angular major and minor axes with position angles and missing values', async ({
        page,
    }, testInfo) => {
        const carta = await openImage(page, 'catalog-angular-size-image.fits');
        const catalog = await openCatalog(page, 'catalog-angular-size.vot', 10);
        await expect(catalog.getByTestId('filterable-table-0-3')).toHaveText(
            '4',
        );
        await expect(catalog.getByTestId('filterable-table-0-4')).toHaveText(
            '2',
        );
        await expect(catalog.getByTestId('filterable-table-0-5')).toHaveText(
            '0',
        );
        await expect(catalog.getByTestId('filterable-table-4-4')).toHaveText(
            'NaN',
        );
        await expect(catalog.getByTestId('filterable-table-7-3')).toHaveText(
            'NaN',
        );
        await plotOverlay(page, catalog, 10, 24);

        await catalog.getByTestId('catalog-size-button').click();
        const settings = page.locator('.catalog-settings');
        await settings
            .getByRole('button', { name: 'Angular size', exact: true })
            .click();
        await settings.getByTestId('catalog-settings-shape-dropdown').click();
        await page.getByTestId('catalog-settings-shape-ellipse-lined').click();

        const majorSizeColumn = settings.getByTestId(
            'catalog-settings-major-size-column-dropdown',
        );
        await choose(page, majorSizeColumn, 'MajorAxis');
        const minorSizeColumn = settings.getByRole('button', {
            name: 'None',
            exact: true,
        });
        await choose(page, minorSizeColumn, 'MinorAxis');
        await page
            .getByTestId('catalog-settings-orientation-tab-title')
            .click();
        const orientationColumn = page.getByTestId(
            'catalog-settings-orientation-column-dropdown',
        );
        await choose(page, orientationColumn, 'PositionAngle');

        const mappedGeometry = () =>
            page.evaluate(() => {
                const catalogStore = (window as any).app.catalogStore;
                const ids = catalogStore.activeCatalogFiles;
                const store = catalogStore.getCatalogWidgetStore(
                    ids[ids.length - 1],
                );
                const values = (array: Float32Array) =>
                    Array.from(array, (value) =>
                        Number.isNaN(value) ? 'NaN' : value,
                    );
                return {
                    columns: [
                        store.sizeMapColumn,
                        store.sizeMinorMapColumn,
                        store.orientationMapColumn,
                    ],
                    major: values(store.sizeArray()),
                    minor: values(store.sizeMinorArray()),
                    angleData: values(store.orientationMapData),
                    renderedAngles: values(store.orientationArray()),
                };
            });
        await expect.poll(mappedGeometry).toEqual({
            columns: ['MajorAxis', 'MinorAxis', 'PositionAngle'],
            major: [4, 8, 12, 16, 10, 'NaN', 6, 'NaN', 9, 7],
            minor: [2, 3, 5, 8, 'NaN', 4, 3, 2, 'NaN', 3],
            angleData: [0, 30, 75, 120, 45, 90, 'NaN', -30, 150, 'NaN'],
            renderedAngles: [25, 50, 87.5, 125, 62.5, 100, 0, 0, 150, 0],
        });

        await settings.getByRole('tab', { name: 'Size', exact: true }).click();
        await settings
            .getByTestId('catalog-settings-axis-type-radius-button')
            .click();
        await expect.poll(mappedGeometry).toMatchObject({
            major: [8, 16, 24, 32, 20, 'NaN', 12, 'NaN', 18, 14],
            minor: [4, 6, 10, 16, 'NaN', 8, 6, 4, 'NaN', 6],
        });
        await settings
            .getByTestId('catalog-settings-axis-type-diameter-button')
            .click();

        await carta.closeWidget('catalog-overlay-floating-settings');
        await expectCanvasInk(page, '#catalog-canvas');
        await checkViewerAndProfiler(page, testInfo, 'angular-size-catalog');
    });

    test('handles pixel and invalid coordinates, closes and switches catalogs', async ({
        page,
    }, testInfo) => {
        await openImage(page);
        const catalog = await openCatalog(page, 'catalog-sky.vot');
        await openCatalog(page, 'catalog-pixel.vot');
        await choose(
            page,
            catalog.getByTestId('catalog-rendering-type-dropdown'),
            'Image overlay',
        );
        await expect(
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
        ).toContainText('xcentroid');
        await expect(
            catalog.getByTestId('catalog-rendering-column-y-dropdown'),
        ).toContainText('ycentroid');
        await plotOverlay(page, catalog, 4);

        await openCatalog(page, 'catalog-invalid.vot');
        await plotOverlay(page, catalog, 3);
        await catalog.getByTestId('catalog-close-button').click();
        await expectCatalogInfo(catalog, 'total 5 entries');
        await catalog.getByTestId('catalog-file-dropdown').click();
        await page.getByRole('menuitem', { name: /catalog-sky\.vot/ }).click();
        await expect(catalog.getByTestId('filterable-table-0-0')).toHaveText(
            'Alpha',
        );
        await expect(
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
        ).toContainText('RAJ2000');
        await checkViewerAndProfiler(page, testInfo, 'catalog-coordinates');
    });

    test('keeps sky sources off a shifted image while pixel sources remain visible', async ({
        page,
    }, testInfo) => {
        await openImage(page, 'catalog-image-shifted.fits');
        const catalog = await openCatalog(page, 'catalog-sky.vot');
        await plotOverlay(page, catalog, 0);
        await openCatalog(page, 'catalog-pixel.vot');
        await plotOverlay(page, catalog, 4);
        await checkViewerAndProfiler(page, testInfo, 'shifted-image');
    });
});
