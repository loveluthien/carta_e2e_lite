import { expect, test } from '@playwright/test';
import {
    fixtureBrowserPath,
    LayoutName,
    PlaywrightDevPage,
} from '../utilities';

for (const database of ['SIMBAD', 'VizieR']) {
    test(`${database} online catalog query recovers from a failed mirror and plots sources`, async ({
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
            process.env.CATALOG_IMAGE_DIRECTORY ??
                `${fixtureBrowserPath}/catalogs`,
        );
        await directory.press('Enter');
        await carta.loadImage('catalog-image.fits');
        await carta.applyLayout(LayoutName.Default);
        await expect(
            page.getByTestId('spatial-profiler-0-content'),
        ).toBeVisible();

        const votable = `<?xml version="1.0"?>
        <VOTABLE><RESOURCE><TABLE name="e2e/sources">
        <DESCRIPTION>E2E sources</DESCRIPTION>
        <FIELD name="ra" datatype="double" unit="deg"/>
        <FIELD name="dec" datatype="double" unit="deg"/>
        <FIELD name="main_id" datatype="char" arraysize="*"/>
        <DATA><TABLEDATA>
        <TR><TD>180.004</TD><TD>-30.003</TD><TD>Alpha</TD></TR>
        <TR><TD>179.999</TD><TD>-30</TD><TD>Beta</TD></TR>
        </TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
        let discoveries = 0;
        let requests = 0;
        await page.route('**/viz-bin/votable?**', async (route) => {
            const params = new URL(route.request().url()).searchParams;
            expect(params.get('-c.eq')).toBe('J2000');
            if (!params.has('-source')) {
                discoveries++;
                expect(params.get('-words')).toBe('E2E sources');
                await route.fulfill({
                    contentType: 'application/xml',
                    body: votable,
                });
            } else {
                requests++;
                expect(params.get('-source')).toBe('e2e/sources,');
                expect(params.get('-out.max')).toBe('2');
                await route.fulfill({
                    status: requests === 1 ? 503 : 200,
                    contentType: 'application/xml',
                    body: requests === 1 ? 'Mirror unavailable' : votable,
                });
            }
        });
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
        const query = dialog.getByRole('button', {
            name: 'Query',
            exact: true,
        });
        if (database === 'VizieR') {
            await dialog
                .getByTestId('catalog-query-database-select-button')
                .click();
            await page
                .getByRole('menuitem', { name: 'VizieR', exact: true })
                .click();
            await dialog
                .getByTestId('catalog-query-keyword-input')
                .fill('E2E sources');
            await dialog
                .getByTestId('catalog-query-max-objects-input')
                .fill('2');
            await dialog
                .getByTestId('catalog-query-max-objects-input')
                .press('Tab');
            await query.click();
            await expect(
                dialog.getByTestId('catalog-query-info'),
            ).toContainText('1');
            await expect(page.locator('.catalog-overlay')).toHaveCount(0);
            const selection = dialog.getByPlaceholder(
                'Please select catalog tables',
            );
            await selection.click();
            await page.getByRole('menuitem', { name: /E2E sources/ }).click();
            await dialog.getByTestId('catalog-query-keyword-input').click();
            await dialog
                .getByTestId('catalog-query-clear-vizier-selection-button')
                .click();
            await expect(
                dialog.getByTestId('catalog-query-load-selected-button'),
            ).toHaveCount(0);
            await selection.click();
            await page.getByRole('menuitem', { name: /E2E sources/ }).click();
            await dialog.getByTestId('catalog-query-keyword-input').click();
            expect(discoveries).toBe(1);
        }
        const submit =
            database === 'VizieR'
                ? dialog.getByTestId('catalog-query-load-selected-button')
                : query;
        await expect(submit).toBeEnabled();
        await submit.click();
        await expect(
            page.getByText(
                /(?:Request to mirror .* failed|Request failed with status code 503)/,
            ),
        ).toBeVisible();
        await expect(dialog).toBeVisible();
        await expect(query).toBeEnabled();
        await expect(page.locator('.catalog-overlay')).toHaveCount(0);

        await submit.click();
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
            // VizieR uses FK5 J2000; the image uses ICRS. Allow 0.05 pixel
            // for the reference-frame bias (about 0.008 pixel in this fixture).
            .toEqual(
                expected.map((point) => ({
                    x: expect.closeTo(point.x, database === 'VizieR' ? 1 : 3),
                    y: expect.closeTo(point.y, database === 'VizieR' ? 1 : 3),
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
            page
                .locator('.spatial-profiler-widget .profile-plot canvas')
                .first(),
        ).toBeVisible();
    });
}
