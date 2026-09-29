import { expect, test } from '@playwright/test';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { getFrames, LayoutName, PlaywrightDevPage } from '../utilities';

const directory = '/carta_build/e2e-lite/test_data';

test.describe('Loading files', () => {
    test.setTimeout(60_000);

    test('small mock images load into the viewer and profiler', async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const fixtureDirectory = path.resolve(__dirname, '../test_data');
        for (const name of readdirSync(fixtureDirectory, {
            recursive: true,
        }).filter((name) => name.endsWith('.fits'))) {
            expect(
                statSync(path.join(fixtureDirectory, name)).size,
                name,
            ).toBeLessThanOrEqual(2_500_000);
        }

        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        for (const name of [
            'm16_f0444w.fits',
            'm16_f0770w.fits',
            'm16_f1130w.fits',
            'm16_f1500w.fits',
            'M17_SWex.fits',
            'HD163296_13CO_2-1_subimage.fits',
            'HD163296_C18O_2-1_subimage.fits',
            'Gaussian_array_wide.fits',
            'IRCp10216_sci.spw0.cube.I.manual.pbcor.fits',
        ]) {
            await carta.loadImage(name);
            if (name === 'm16_f0444w.fits')
                await carta.applyLayout(LayoutName.Default);
            await expect
                .poll(() => getFrames(page))
                .toMatchObject([{ filename: name }]);
            await expect(page.getByTestId('viewer-div')).toBeVisible();
            await page
                .locator('.region-stage > .konvajs-content > canvas')
                .first()
                .hover();
            await expect(page.getByText(/^Data:/).first()).toContainText(
                'Data:',
            );
        }
    });

    test('opens and appends images in the viewer and profiler', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        const browser = page.getByTestId('file-browser-dialog');
        await expect(browser).toBeVisible();
        await browser.locator('.edit-path-button').click();
        const path = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await path.fill(directory);
        await path.press('Enter');

        await carta.loadImage('M17_SWex.fits');
        await carta.applyLayout(LayoutName.Default);
        await expect(browser).toBeHidden();
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([{ filename: 'M17_SWex.fits' }]);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'M17_SWex.fits',
        );
        const firstImage = await page.getByTestId('viewer-div').screenshot();
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .first()
            .hover({ position: { x: 300, y: 200 } });
        await expect(page.getByText(/^Data:/).first()).toContainText('Data:');
        const profile = page
            .locator('.spatial-profiler-widget .profile-plot')
            .first();
        await expect(profile.locator('canvas').first()).toBeVisible();
        const firstProfile = await profile.screenshot();

        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([
                { filename: 'M17_SWex.fits' },
                { filename: 'HD163296_13CO_2-1_subimage.fits' },
            ]);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        expect(
            (await page.getByTestId('viewer-div').screenshot()).equals(
                firstImage,
            ),
        ).toBe(false);
        await page.evaluate(() => {
            const frame = (window as any).app.activeFrame;
            frame.setCursorPosition({ x: 45, y: 45 });
            frame.updateCursorRegion({ x: 45, y: 45 });
        });
        await expect(page.getByText(/^Data:/).first()).toContainText('Data:');
        expect((await profile.screenshot()).equals(firstProfile)).toBe(false);
    });

    test('rejects an invalid FITS file and then loads a valid image', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        const browser = page.getByTestId('file-browser-dialog');
        await browser.locator('.edit-path-button').click();
        const path = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await path.fill(directory);
        await path.press('Enter');

        const filter = browser.getByRole('textbox', {
            name: 'Filter by filename with fuzzy',
        });
        await filter.fill('invalid.fits');
        await filter.press('Enter');
        await expect(browser.getByText('No results')).toBeVisible();
        await expect(
            browser.getByRole('button', { name: 'Load' }),
        ).toBeDisabled();
        await expect.poll(() => getFrames(page)).toHaveLength(0);

        await carta.loadImage('cube.fits');
        await carta.applyLayout(LayoutName.Default);
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([
                { filename: 'cube.fits', width: 16, height: 16, channels: 5 },
            ]);
        await expect(page.locator('#raster-canvas').first()).toBeVisible();
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .first()
            .hover();
        await expect(page.getByText(/^Data:/).first()).toContainText('Data:');
    });
});

for (const [format, name] of [
    ['FITS', 'M17_SWex-channel0-addOneGaussian.fits'],
    ['HDF5', 'M17_SWex-channel0-addOneGaussian.hdf5'],
    ['CASA', 'M17_SWex-channel0-addOneGaussian.image'],
] as const) {
    test(`${format} file information, header, image, and profile`, async ({
        page,
    }) => {
        test.setTimeout(90_000);
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        const browser = page.getByTestId('file-browser-dialog');
        await browser.locator('.edit-path-button').click();
        const directoryPath = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await directoryPath.fill(directory);
        await directoryPath.press('Enter');
        const filter = browser.getByRole('textbox', {
            name: 'Filter by filename with fuzzy',
        });
        await filter.fill(name);
        await filter.press('Enter');
        await browser.getByText(name, { exact: true }).first().click();
        await expect(
            browser.getByRole('button', { name: 'Load' }),
        ).toBeEnabled();
        await expect(
            browser.getByRole('tab', { name: 'File Information' }),
        ).toBeVisible();
        await expect(browser.getByTestId('header-entry-0')).toContainText(name);
        const info = await page.evaluate(() => {
            const details = (window as any).app.fileBrowserStore
                .fileInfoExtended;
            return {
                width: details?.width,
                height: details?.height,
                depth: details?.depth,
                computed: details?.computedEntries,
                headers: details?.headerEntries,
            };
        });
        expect(info).toMatchObject({ width: 640, height: 800, depth: 1 });
        expect(info.computed).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Name', value: name }),
                expect.objectContaining({ name: 'Data type', value: 'float' }),
                expect.objectContaining({
                    name: 'Shape',
                    value: '[640, 800, 1, 1] (RA, DEC, FREQ, STOKES)',
                }),
                expect.objectContaining({
                    name: 'Number of channels',
                    value: '1',
                }),
                expect.objectContaining({
                    name: 'Pixel unit',
                    value: 'Jy/beam',
                }),
            ]),
        );
        if (format === 'HDF5') {
            expect(info.computed).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Has mipmaps',
                        value: 'T',
                    }),
                ]),
            );
        }
        expect(info.headers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'NAXIS1', value: '640' }),
                expect.objectContaining({ name: 'NAXIS2', value: '800' }),
                expect.objectContaining({ name: 'BUNIT', value: 'Jy/beam' }),
                expect.objectContaining({ name: 'CTYPE1', value: 'RA---SIN' }),
                expect.objectContaining({
                    name: format === 'CASA' ? 'XTENSION' : 'SIMPLE',
                    value: format === 'CASA' ? 'IMAGE' : 'T',
                }),
            ]),
        );
        await browser.getByRole('tab', { name: 'Header' }).click();
        await expect(browser.locator('.header-list')).toContainText(
            'NAXIS1 = 640',
        );
        await browser.getByRole('tab', { name: 'File Information' }).click();
        await expect(browser.locator('.header-list')).toContainText(
            'Shape = [640, 800, 1, 1]',
        );
        await browser.getByRole('button', { name: 'Load' }).click();
        await expect(browser).toBeHidden();
        await carta.applyLayout(LayoutName.Default);
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([
                {
                    filename: name,
                    width: 640,
                    height: 800,
                    channels: 1,
                    unit: 'Jy/beam',
                },
            ]);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            `${format.toLowerCase()}-image.png`,
        );
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .first()
            .hover();
        await expect(page.getByText(/^Data:/).first()).toContainText('Data:');
        const profile = page
            .locator('.spatial-profiler-widget .profile-plot')
            .first();
        await expect(profile).toHaveScreenshot(
            `${format.toLowerCase()}-profile.png`,
            {
                maxDiffPixelRatio: 0.02,
            },
        );
        const rgb = await page.evaluate(() => {
            const canvas =
                document.querySelector<HTMLCanvasElement>('#raster-canvas')!;
            const copy = document.createElement('canvas');
            copy.width = canvas.width;
            copy.height = canvas.height;
            const context = copy.getContext('2d')!;
            context.drawImage(canvas, 0, 0);
            return [
                [0.25, 0.25],
                [0.5, 0.25],
                [0.5, 0.5],
            ].map(([x, y]) =>
                Array.from(
                    context.getImageData(
                        Math.floor(copy.width * x),
                        Math.floor(copy.height * y),
                        1,
                        1,
                    ).data,
                ),
            );
        });
        expect(rgb).toEqual([
            [19, 124, 189, 255],
            [0, 0, 3, 255],
            [252, 254, 164, 255],
        ]);
    });
}

for (const { name, width, height, depth, bitpix, dataType, cursor, rgb } of [
    {
        name: 'minimal_header1.fits',
        width: 1024,
        height: 1024,
        depth: 1,
        bitpix: '8',
        dataType: 'uChar (rescaled to float)',
        cursor: 'Image: 470 px, 0.0',
        rgb: [
            [252, 254, 164, 255],
            [0, 0, 3, 255],
            [252, 254, 164, 255],
        ],
    },
    {
        name: 'minimal_header2.fits',
        width: 10,
        height: 10,
        depth: 10,
        bitpix: '-32',
        dataType: 'float',
        cursor: 'Image: 4 px, -1.0355',
        rgb: [
            [152, 39, 101, 255],
            [161, 43, 97, 255],
            [95, 18, 110, 255],
        ],
    },
] as const) {
    test(`${name} loads with minimal headers`, async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        const browser = page.getByTestId('file-browser-dialog');
        await browser.locator('.edit-path-button').click();
        const input = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await input.fill(directory);
        await input.press('Enter');
        const filter = browser.getByRole('textbox', {
            name: 'Filter by filename with fuzzy',
        });
        await filter.fill(name);
        await filter.press('Enter');
        await browser.getByText(name, { exact: true }).first().click();
        await expect(
            browser.getByRole('button', { name: 'Load' }),
        ).toBeEnabled();
        await expect(browser.getByTestId('header-entry-0')).toContainText(name);
        const info = await page.evaluate(() => {
            const details = (window as any).app.fileBrowserStore
                .fileInfoExtended;
            return {
                width: details?.width,
                height: details?.height,
                depth: details?.depth,
                computed: details?.computedEntries,
                headers: details?.headerEntries,
            };
        });
        expect(info).toMatchObject({ width, height, depth });
        expect(info.computed).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'Name', value: name }),
                expect.objectContaining({ name: 'Data type', value: dataType }),
                expect.objectContaining({
                    name: 'Shape',
                    value: `[${width}, ${height}, ${depth}] (NA, NA, NA)`,
                }),
                expect.objectContaining({
                    name: 'Number of channels',
                    value: String(depth),
                }),
            ]),
        );
        expect(
            info.computed.map((entry: { name: string }) => entry.name),
        ).not.toContain('Coordinate type');
        expect(info.headers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'SIMPLE', value: 'T' }),
                expect.objectContaining({ name: 'BITPIX', value: bitpix }),
                expect.objectContaining({ name: 'NAXIS', value: '3' }),
                expect.objectContaining({
                    name: 'NAXIS1',
                    value: String(width),
                }),
                expect.objectContaining({
                    name: 'NAXIS2',
                    value: String(height),
                }),
                expect.objectContaining({
                    name: 'NAXIS3',
                    value: String(depth),
                }),
            ]),
        );
        expect(
            info.headers.some((entry: { name: string }) =>
                /^(CTYPE|CRVAL|CRPIX|BUNIT)/.test(entry.name),
            ),
        ).toBe(false);
        await browser.getByRole('tab', { name: 'Header' }).click();
        await expect(browser.locator('.header-list')).toContainText(
            `NAXIS1 = ${width}`,
        );
        await browser.getByRole('tab', { name: 'File Information' }).click();
        await expect(browser.locator('.header-list')).toContainText(
            `Shape = [${width}, ${height}, ${depth}]`,
        );
        await browser.getByRole('button', { name: 'Load' }).click();
        await expect(browser).toBeHidden();
        await carta.applyLayout(LayoutName.Default);
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([
                { filename: name, width, height, channels: depth },
            ]);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            `${name}-image.png`,
        );
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .first()
            .hover({ position: { x: 500, y: 250 } });
        await expect(page.getByTestId('x-profiler-info')).toContainText(cursor);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (window as any).app;
                    const frame = app.activeFrame;
                    const profile = app.spatialProfiles.get(
                        `${frame.frameInfo.fileId}-0`,
                    );
                    const position = frame.cursorInfo?.posImageSpace;
                    const values = profile?.profiles.get('x')?.values;
                    return (
                        profile?.x === Math.round(position?.x) &&
                        profile?.y === Math.round(position?.y) &&
                        values?.length > 1 &&
                        Math.max(...values) - Math.min(...values) > 1
                    );
                }),
            )
            .toBe(true);
        await expect(
            page.locator('.spatial-profiler-widget .profile-plot').first(),
        ).toHaveScreenshot(`${name}-profile.png`, {
            maxDiffPixelRatio: 0.03,
        });
        const samples = await page.evaluate(() => {
            const canvas =
                document.querySelector<HTMLCanvasElement>('#raster-canvas')!;
            const copy = document.createElement('canvas');
            copy.width = canvas.width;
            copy.height = canvas.height;
            const context = copy.getContext('2d')!;
            context.drawImage(canvas, 0, 0);
            return [
                [0.25, 0.25],
                [0.5, 0.25],
                [0.5, 0.5],
            ].map(([x, y]) =>
                Array.from(
                    context.getImageData(
                        Math.floor(copy.width * x),
                        Math.floor(copy.height * y),
                        1,
                        1,
                    ).data,
                ),
            );
        });
        expect(samples).toEqual(rgb);
    });
}
