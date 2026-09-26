import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const fixtureDirectory = path.resolve(__dirname, '../test_data/catalogs');
const imageDirectory =
    process.env.CATALOG_IMAGE_DIRECTORY ??
    '/carta_build/e2e-lite/test_data/catalogs';
const catalogDirectory =
    process.env.CATALOG_TABLE_DIRECTORY ?? fixtureDirectory;
const browser = (page: Page) => page.locator('.file-browser-dialog');
const widget = (page: Page) =>
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
    const dialog = browser(page);
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
    await expect(browser(page)).toBeVisible();
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
    await expect.poll(() => ink(page, '#raster-canvas')).toBeGreaterThan(0);
    return carta;
}

async function openCatalog(page: Page, name: string) {
    await new PlaywrightDevPage(page).selectMenuItem('File', 'Import Catalog');
    await pickFile(
        page,
        name,
        catalogDirectory,
        'catalogFileList',
        'Load catalog',
    );
    await expect(
        widget(page).getByTestId('catalog-table-filtering-info'),
    ).toContainText('total 5 entries');
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

async function visibleSources(page: Page) {
    return page.evaluate(() => {
        const store = (window as any).app.catalogStore;
        const ids = store.activeCatalogFiles;
        const points = store.catalogGLData.get(ids[ids.length - 1]);
        const x = points.x as Float32Array;
        const y = points.y as Float32Array;
        return Array.from(x).filter(
            (value, i) => value >= 0 && value < 16 && y[i] >= 0 && y[i] < 16,
        ).length;
    });
}

async function choose(page: Page, button: Locator, option: string) {
    await button.click();
    await page
        .getByRole('menuitem', { name: option, exact: true })
        .last()
        .click();
}

async function checkViewerAndProfiler(page: Page) {
    await expect(page.locator('#raster-canvas').first()).toBeVisible();
    await expect(page.getByTestId('x-profiler-info')).toBeVisible();
    await expect(
        page.locator('.spatial-profiler-widget .profile-plot canvas').first(),
    ).toBeVisible();
}

test.describe('Catalog widget', () => {
    test.setTimeout(90_000);

    test('loads sky sources, filters and sorts the table, and edits overlay styling', async ({
        page,
    }) => {
        const carta = await openImage(page);
        await openCatalog(page, 'catalog-sky.vot');
        const catalog = widget(page);
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
        await catalog.getByTestId('catalog-plot-button').click();
        await expect.poll(() => visibleSources(page)).toBe(4);
        await expect
            .poll(() => ink(page, '#catalog-canvas'))
            .toBeGreaterThan(0);

        await catalog
            .getByTestId('filterable-table-filter-input-3')
            .fill('>=30');
        await catalog.getByTestId('catalog-filter-button').click();
        await expect(
            catalog.getByTestId('catalog-table-filtering-info'),
        ).toContainText('3 filtered entries');
        await catalog.getByTestId('filterable-table-header-3').click();
        await expect(
            catalog.getByTestId('catalog-table-filtering-info'),
        ).toContainText('3 filtered entries');
        await catalog.getByTestId('catalog-reset-button').click();
        await expect(
            catalog.getByTestId('catalog-table-filtering-info'),
        ).toContainText('total 5 entries');
        await catalog.getByTestId('catalog-plot-button').click();

        const maxRows = catalog.locator('.catalog-max-rows input');
        await maxRows.fill('2');
        await maxRows.press('Tab');
        await expect(
            catalog.getByTestId('catalog-table-filtering-info'),
        ).toContainText('top 2 entries');
        await maxRows.fill('5');
        await maxRows.press('Tab');

        await catalog.getByTestId('catalog-size-button').click();
        const size = page.getByTestId('catalog-settings-size-input');
        await expect(size).toBeVisible();
        await size.fill('14');
        await size.press('Tab');
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
        await expect
            .poll(() => ink(page, '#catalog-canvas'))
            .toBeGreaterThan(0);
        await checkViewerAndProfiler(page);
    });

    test('plots histogram and scatter, handles pixel and invalid coordinates, and closes catalogs', async ({
        page,
    }) => {
        const carta = await openImage(page);
        await openCatalog(page, 'catalog-sky.vot');
        const catalog = widget(page);
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
        await catalog.getByTestId('catalog-plot-button').click();
        await expect(
            page.getByTestId('catalog-histogram-plot').locator('svg.main-svg'),
        ).toBeVisible();
        await carta.closeWidget('catalog-plot');

        await choose(
            page,
            catalog.getByTestId('catalog-rendering-type-dropdown'),
            '2D scatter',
        );
        await choose(
            page,
            catalog.getByTestId('catalog-rendering-column-y-dropdown'),
            'Size',
        );
        await catalog.getByTestId('catalog-plot-button').click();
        await expect(
            page.getByTestId('catalog-scatter-plot').locator('svg.main-svg'),
        ).toBeVisible();
        await carta.closeWidget('catalog-plot');

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
        await catalog.getByTestId('catalog-plot-button').click();
        await expect.poll(() => visibleSources(page)).toBe(4);
        await expect
            .poll(() => ink(page, '#catalog-canvas'))
            .toBeGreaterThan(0);

        await openCatalog(page, 'catalog-invalid.vot');
        await catalog.getByTestId('catalog-plot-button').click();
        await expect.poll(() => visibleSources(page)).toBe(3);
        await expect
            .poll(() => ink(page, '#catalog-canvas'))
            .toBeGreaterThan(0);
        await catalog.getByTestId('catalog-close-button').click();
        await expect(
            catalog.getByTestId('catalog-table-filtering-info'),
        ).toContainText('total 5 entries');
        await catalog.getByTestId('catalog-file-dropdown').click();
        await page.getByRole('menuitem', { name: /catalog-sky\.vot/ }).click();
        await expect(
            catalog.getByTestId('catalog-rendering-column-x-dropdown'),
        ).toContainText('RAJ2000');
        await checkViewerAndProfiler(page);
    });

    test('keeps sky sources off a shifted image while pixel sources remain visible', async ({
        page,
    }) => {
        await openImage(page, 'catalog-image-shifted.fits');
        await openCatalog(page, 'catalog-sky.vot');
        const catalog = widget(page);
        await catalog.getByTestId('catalog-plot-button').click();
        await expect.poll(() => visibleSources(page)).toBe(0);
        await openCatalog(page, 'catalog-pixel.vot');
        await catalog.getByTestId('catalog-plot-button').click();
        await expect.poll(() => visibleSources(page)).toBe(4);
        await expect
            .poll(() => ink(page, '#catalog-canvas'))
            .toBeGreaterThan(0);
        await checkViewerAndProfiler(page);
    });
});
