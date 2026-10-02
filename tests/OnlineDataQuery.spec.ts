import { expect, test } from '@playwright/test';
import {
    fixtureBrowserPath,
    LayoutName,
    PlaywrightDevPage,
} from '../utilities';

test('Online catalog query recovers from a failed mirror and plots sources', async ({
    page,
}, testInfo) => {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();

    const fileBrowser = page.getByTestId('file-browser-dialog');
    await fileBrowser.locator('.edit-path-button').click();
    const directory = fileBrowser.getByPlaceholder(
        'Input directory path with respect to the top level folder',
    );
    await directory.fill(
        process.env.CATALOG_IMAGE_DIRECTORY ?? `${fixtureBrowserPath}/catalogs`,
    );
    await directory.press('Enter');
    await carta.loadImage('catalog-image.fits');
    await carta.applyLayout(LayoutName.Default);
    await expect(page.getByTestId('spatial-profiler-0-content')).toBeVisible();

    let requests = 0;
    await page.route('**/sim-tap/sync?**', async (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get('query')).toContain('FROM basic');
        requests++;
        if (requests === 1) {
            await route.fulfill({
                status: 503,
                headers: { 'access-control-allow-origin': '*' },
                body: 'Mirror unavailable',
            });
        } else {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'access-control-allow-origin': '*' },
                body: JSON.stringify({
                    metadata: [
                        { name: 'ra', datatype: 'DOUBLE', unit: 'deg' },
                        { name: 'dec', datatype: 'DOUBLE', unit: 'deg' },
                        { name: 'main_id', datatype: 'CHAR' },
                    ],
                    data: [
                        [180.004, -30.003, 'Alpha'],
                        [179.999, -30, 'Beta'],
                    ],
                }),
            });
        }
    });

    await carta.selectMenuItem('View', 'Online Data Query');
    const dialog = page.getByRole('dialog', { name: 'Online Data Query' });
    const query = dialog.getByRole('button', { name: 'Query', exact: true });
    await expect(query).toBeEnabled();
    await query.click();
    await expect(
        page.getByText(
            /(?:Request to mirror .* failed|Request failed with status code 503)/,
        ),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(query).toBeEnabled();
    await expect(page.locator('.catalog-overlay')).toHaveCount(0);

    await query.click();
    await expect(dialog).toBeHidden();
    expect(requests).toBe(2);

    const catalog = page.locator('.catalog-overlay');
    await expect(
        catalog.getByTestId('catalog-table-filtering-info'),
    ).toContainText('total 2 entries');
    await expect(catalog.getByTestId('filterable-table-0-2')).toHaveText(
        'Alpha',
    );
    await expect(
        catalog.getByTestId('catalog-rendering-column-x-dropdown'),
    ).toContainText('ra');
    await expect(
        catalog.getByTestId('catalog-rendering-column-y-dropdown'),
    ).toContainText('dec');
    await catalog.getByTestId('catalog-plot-button').click();
    // Independent SIN projection from the fixture's reference pixel and WCS.
    const radians = Math.PI / 180;
    const expected = [
        [180.004, -30.003],
        [179.999, -30],
    ].map(([ra, dec]) => {
        const delta = (ra - 180) * radians;
        const latitude = dec * radians;
        const reference = -30 * radians;
        return {
            x: 7 - (Math.cos(latitude) * Math.sin(delta)) / radians / 0.001,
            y:
                7 +
                (Math.sin(latitude) * Math.cos(reference) -
                    Math.cos(latitude) *
                        Math.sin(reference) *
                        Math.cos(delta)) /
                    radians /
                    0.001,
        };
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const store = (window as any).app.catalogStore;
                const points = store.catalogGLData.get(
                    store.activeCatalogFiles.at(-1),
                );
                return points
                    ? Array.from(points.x as Float32Array, (x, index) => ({
                          x,
                          y: points.y[index],
                      }))
                    : [];
            }),
        )
        .toEqual(
            expected.map((point) => ({
                x: expect.closeTo(point.x, 3),
                y: expect.closeTo(point.y, 3),
            })),
        );
    await expect
        .poll(() =>
            page.evaluate(() => {
                const canvas =
                    document.querySelector<HTMLCanvasElement>(
                        '#catalog-canvas',
                    );
                if (!canvas?.width || !canvas.height) return 0;
                const copy = document.createElement('canvas');
                copy.width = canvas.width;
                copy.height = canvas.height;
                const context = copy.getContext('2d')!;
                context.drawImage(canvas, 0, 0);
                const rgba = context.getImageData(
                    0,
                    0,
                    copy.width,
                    copy.height,
                ).data;
                let count = 0;
                for (let i = 0; i < rgba.length; i += 4) {
                    if (
                        rgba[i] === 0 &&
                        rgba[i + 1] === 163 &&
                        rgba[i + 2] === 150 &&
                        rgba[i + 3] > 0
                    )
                        count++;
                }
                return count;
            }),
        )
        .toBeGreaterThan(0);
    await testInfo.attach('online-catalog-sources.png', {
        body: await page.getByTestId('viewer-div').screenshot(),
        contentType: 'image/png',
    });
    await expect(page.locator('#raster-canvas').first()).toBeVisible();
    await expect(page.getByTestId('x-profiler-info')).toBeVisible();
    await expect(
        page.locator('.spatial-profiler-widget .profile-plot canvas').first(),
    ).toBeVisible();
});
