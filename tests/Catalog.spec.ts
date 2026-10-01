import {
    expect,
    test,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import { LayoutName, PlaywrightDevPage } from '../utilities';

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
    await carta.applyLayout(LayoutName.Default);
    await expect(page.getByTestId('x-profiler-info')).toBeVisible();
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

async function rgbPixelCount(
    page: Page,
    selector: string,
    rgb: [number, number, number],
) {
    return page.evaluate(
        ({ selector, rgb }) => {
            const source = document.querySelector<HTMLCanvasElement>(selector);
            if (!source?.width || !source.height) return 0;
            const copy = document.createElement('canvas');
            copy.width = source.width;
            copy.height = source.height;
            const context = copy.getContext('2d')!;
            context.drawImage(source, 0, 0);
            const rgba = context.getImageData(
                0,
                0,
                copy.width,
                copy.height,
            ).data;
            let count = 0;
            for (let offset = 0; offset < rgba.length; offset += 4)
                if (
                    rgba[offset] === rgb[0] &&
                    rgba[offset + 1] === rgb[1] &&
                    rgba[offset + 2] === rgb[2] &&
                    rgba[offset + 3] > 0
                )
                    count++;
            return count;
        },
        { selector, rgb },
    );
}

async function expectCanvasRgb(
    page: Page,
    selector: string,
    rgb: [number, number, number],
) {
    await expect
        .poll(() => rgbPixelCount(page, selector, rgb))
        .toBeGreaterThan(0);
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
    if (expectedSources > 0) {
        await expectCanvasInk(page, '#catalog-canvas');
        await expectCanvasRgb(page, '#catalog-canvas', [0, 163, 150]);
    }
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

async function overlayGeometry(page: Page) {
    return page.evaluate(() => {
        const catalogStore = (window as any).app.catalogStore;
        const ids = catalogStore.activeCatalogFiles;
        const display = catalogStore.getCatalogDisplayStore(
            ids[ids.length - 1],
        );
        const values = (array: Float32Array) =>
            Array.from(array, (value) =>
                Number.isFinite(value) ? value : null,
            );
        return {
            majorInput: values(display.sizeMapData),
            minorInput: values(display.sizeMinorMapData),
            angleInput: values(display.orientationMapData),
            major: values(display.sizeArray()),
            minor: values(display.sizeMinorArray()),
            angles: values(display.orientationArray()),
        };
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
    const profile = page.locator('.line-plot-component').first();
    await expect(profile.locator('canvas').first()).toBeVisible();
    await expectCanvasInk(page, '.line-plot-component canvas');
    await page
        .getByTestId('viewer-div')
        .screenshot({ path: testInfo.outputPath(`${label}-viewer.png`) });
    await profile.screenshot({
        path: testInfo.outputPath(`${label}-spatial-profile.png`),
    });
}

test.describe('Catalog Widget', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(90_000);

    test('Viewer toolbar selects a rendered catalog source', async ({
        page,
    }) => {
        page.setDefaultTimeout(10_000);
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        const usage = page.getByRole('button', {
            name: 'No, do not send usage data',
        });
        if (await usage.isVisible()) await usage.click();
        const alert = page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'OK' });
        if (await alert.isVisible()) await alert.click();
        await pickFile(
            page,
            'catalog-image.fits',
            imageDirectory,
            'fileList',
            'Load',
        );
        await expectCanvasInk(page, '#raster-canvas');
        const catalog = await openCatalog(page, 'catalog-sky.vot');
        await catalog.getByTestId('catalog-plot-button').click();
        await expectCanvasInk(page, '#catalog-canvas');
        await expectCanvasRgb(page, '#catalog-canvas', [0, 163, 150]);
        await carta.closeWidget('catalog-overlay');

        const viewer = page.getByTestId('viewer-div');
        await viewer.hover();
        const selection = page.getByTestId('toolbar-catalog-selection-button');
        await expect(selection).toBeEnabled();
        await selection.click();
        await expect(selection).toHaveClass(/bp6-active/);
        await page
            .locator('#catalog-canvas')
            .click({ position: { x: 100, y: 100 } });
        await expect.poll(() => selectedSourceIndices(page)).toHaveLength(1);
        await expectCanvasRgb(page, '#catalog-canvas', [172, 47, 51]);
        await page.mouse.move(0, 0);
        await expect(viewer.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer).toHaveScreenshot(
            'image-viewer-catalog-selection.png',
            { maxDiffPixelRatio: 0.02 },
        );
    });

    test('Loads sky sources, filters and sorts the table, and edits overlay styling', async ({
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
        const sizes = await overlayGeometry(page);
        expect(sizes.majorInput).toEqual([4, 6, 8, 10, 12]);
        expect(sizes.major).toHaveLength(5);
        expect(
            sizes.major.every(
                (value, index, all) =>
                    index === 0 ||
                    (value !== null &&
                        all[index - 1] !== null &&
                        value > all[index - 1]!),
            ),
        ).toBe(true);
        await expectCanvasInk(page, '#catalog-canvas');
        await expectCanvasRgb(page, '#catalog-canvas', [0, 163, 150]);
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

    test('Verifies histogram bins and selects catalog rows from a bar', async ({
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

    test('Verifies scatter values and selects a catalog row from a point', async ({
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

    test('Renders angular major and minor axes with position angles and missing values', async ({
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
        const sizeTab = settings.getByRole('tabpanel', { name: 'Size' });
        await expect(
            sizeTab.getByRole('button', { name: 'MajorAxis', exact: true }),
        ).toBeVisible();
        await expect(
            sizeTab.getByRole('button', { name: 'MinorAxis', exact: true }),
        ).toBeVisible();
        await page
            .getByTestId('catalog-settings-orientation-tab-title')
            .click();
        const orientationColumn = page.getByTestId(
            'catalog-settings-orientation-column-dropdown',
        );
        await choose(page, orientationColumn, 'PositionAngle');

        await expect(orientationColumn).toContainText('PositionAngle');
        const diameter = await overlayGeometry(page);
        expect(diameter.majorInput).toEqual([
            4,
            8,
            12,
            16,
            10,
            null,
            6,
            null,
            9,
            7,
        ]);
        expect(diameter.minorInput).toEqual([
            2,
            3,
            5,
            8,
            null,
            4,
            3,
            2,
            null,
            3,
        ]);
        expect(diameter.angleInput).toEqual([
            0,
            30,
            75,
            120,
            45,
            90,
            null,
            -30,
            150,
            null,
        ]);
        expect(diameter.major).toEqual(diameter.majorInput);
        expect(diameter.minor).toEqual(diameter.minorInput);
        expect(diameter.angles).toEqual([
            25, 50, 87.5, 125, 62.5, 100, 0, 0, 150, 0,
        ]);
        await expectCanvasInk(page, '#catalog-canvas');
        await expectCanvasRgb(page, '#catalog-canvas', [0, 163, 150]);
        await expect(page.locator('#catalog-canvas')).toHaveScreenshot(
            'catalog-angular-axes.png',
            { maxDiffPixels: 5 },
        );

        await settings.getByRole('tab', { name: 'Size', exact: true }).click();
        await settings
            .getByTestId('catalog-settings-axis-type-radius-button')
            .click();
        const radius = await overlayGeometry(page);
        expect(radius.major).toEqual(
            diameter.major.map((value) => (value === null ? null : value * 2)),
        );
        expect(radius.minor).toEqual(
            diameter.minor.map((value) => (value === null ? null : value * 2)),
        );
        expect(radius.angles).toEqual(diameter.angles);
        await expectCanvasInk(page, '#catalog-canvas');
        await expect(page.locator('#catalog-canvas')).toHaveScreenshot(
            'catalog-angular-axes-radius.png',
            { maxDiffPixels: 5 },
        );
        await settings
            .getByTestId('catalog-settings-axis-type-diameter-button')
            .click();
        const restored = await overlayGeometry(page);
        expect(restored.major).toEqual(diameter.major);
        expect(restored.minor).toEqual(diameter.minor);

        await carta.closeWidget('catalog-overlay-floating-settings');
        await expectCanvasInk(page, '#catalog-canvas');
        await checkViewerAndProfiler(page, testInfo, 'angular-size-catalog');
    });

    test('Handles pixel and invalid coordinates, closes and switches catalogs', async ({
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

    test('Keeps sky sources off a shifted image while pixel sources remain visible', async ({
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
