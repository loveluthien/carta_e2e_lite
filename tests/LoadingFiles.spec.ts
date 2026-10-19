import { expect, test } from '@playwright/test';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    utimesSync,
    writeFileSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
    fixtureBrowserPath,
    fixtureFolder,
    getFrames,
    LayoutName,
    PlaywrightDevPage,
    pixel,
    renderedRgb,
} from '../utilities';

const directory = fixtureBrowserPath;

test.describe('Loading Files', () => {
    test.setTimeout(60_000);

    test('Saves a spectral subset and reopens its pixels', async ({
        page,
    }, testInfo) => {
        const carta = new PlaywrightDevPage(page);
        const filename = `e2e-save-${randomUUID()}.fits`;
        const output = path.join(fixtureFolder, filename);
        await carta.goto();
        await carta.loadImage('cube.fits');
        try {
            await carta.selectMenuItem('File', 'Save Image');
            const browser = page.getByTestId('file-browser-dialog');
            await browser.locator('.edit-path-button').click();
            const directory = browser.getByPlaceholder(
                'Input directory path with respect to the top level folder',
            );
            await directory.fill(fixtureBrowserPath.slice(1));
            await directory.press('Enter');
            const name = browser.getByPlaceholder('Enter file name');
            await name.fill('');
            const save = browser.getByRole('button', {
                name: 'Save',
                exact: true,
            });
            await expect(save).toBeDisabled();
            await browser
                .locator('.coordinate-select select')
                .first()
                .selectOption('Channel');
            await browser.getByPlaceholder('First channel').fill('1');
            await browser.getByPlaceholder('First channel').press('Tab');
            await browser.getByPlaceholder('Last channel').fill('3');
            await browser.getByPlaceholder('Last channel').press('Tab');
            await name.fill(filename);
            await save.click();
            await expect(browser).toBeHidden({ timeout: 30_000 });
            await expect.poll(() => existsSync(output)).toBe(true);
            const header = readFileSync(output)
                .subarray(0, 2880)
                .toString('ascii');
            expect(header).toMatch(/NAXIS3\s*=\s*3\s/);
            await carta.loadImage(filename);
            await expect
                .poll(() => getFrames(page))
                .toMatchObject([{ filename, channels: 3 }]);
            expect(await pixel(page, 8, 8)).toBeCloseTo(3, 5);
            await page.getByTestId('animator-0-header-title').click();
            await page.getByTestId('animator-last-button').click();
            expect(await pixel(page, 8, 8)).toBeCloseTo(12, 5);
            await testInfo.attach('saved-subset-viewer.png', {
                body: await page.getByTestId('viewer-div').screenshot(),
                contentType: 'image/png',
            });
        } finally {
            // Only this test's UUID-named export is removed.
            if (existsSync(output)) rmSync(output);
        }
    });

    test('Small mock images load into the viewer and profiler', async ({
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

    test('Opens and appends images in the viewer and profiler', async ({
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
        const profile = page.locator('.line-plot-component').first();
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

    test('Rejects an invalid FITS file and then loads a valid image', async ({
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

// PR #3027: blank keyword cards must remain visible without poisoning AST WCS.
for (const kind of ['cube', 'yx', 'swapped', 'pv'] as const) {
    test(`Blank FITS keywords preserve ${kind} WCS and rendered profiles`, async ({
        page,
    }) => {
        test.setTimeout(60_000);
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.setTestPreferences();
        const coordinates = () =>
            page.evaluate(() => {
                const frame = (window as any).app.activeFrame;
                return {
                    pv: frame.isPVImage,
                    yx: frame.isYX,
                    swapped: frame.isSwappedZ,
                    hasWcs: Boolean(frame.wcsInfo),
                    points: [
                        { x: 1, y: 2 },
                        { x: 3, y: 4 },
                    ].map((point) => frame.getCursorInfo(point).posWCS),
                };
            });
        let expectedCoordinates: Awaited<ReturnType<typeof coordinates>>;
        let expectedRgb: number[];
        let expectedPixel: number;
        let expectedProfile: number[];
        const profileAxis = kind === 'swapped' ? 'y' : 'x';
        const profile = () =>
            page.evaluate((axis) => {
                const app = (window as any).app;
                const frame = app.activeFrame;
                return Array.from(
                    app.spatialProfiles
                        .get(`${frame.frameInfo.fileId}-0`)
                        ?.getProfile(axis)?.values ?? [],
                ) as number[];
            }, profileAxis);
        for (const variant of ['clean', 'blank']) {
            await carta.loadImage(`wcs-${kind}-${variant}.fits`);
            await carta.applyLayout(LayoutName.Default);
            await page.mouse.move(0, 0);
            await page.evaluate(() => {
                const app = (window as any).app;
                app.overlaySettings.grid.setVisible(true);
                app.activeFrame.setCursorPosition({ x: 3, y: 4 });
                app.activeFrame.updateCursorRegion({ x: 3, y: 4 });
            });
            const state = await coordinates();
            expect(state).toMatchObject({
                pv: kind === 'pv',
                yx: kind === 'yx',
                swapped: kind === 'swapped' || kind === 'pv',
                hasWcs: true,
            });
            for (const point of state.points) {
                expect(point).toBeTruthy();
                expect(Number.isFinite(point?.x)).toBe(true);
                expect(Number.isFinite(point?.y)).toBe(true);
            }
            expect(state.points[0]).not.toEqual(state.points[1]);
            await expect
                .poll(async () => (await renderedRgb(page))[3])
                .toBe(255);
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const app = (window as any).app;
                        const profile = app.spatialProfiles.get(
                            `${app.activeFrame.frameInfo.fileId}-0`,
                        );
                        return { x: profile?.x, y: profile?.y };
                    }),
                )
                .toEqual({ x: 3, y: 4 });
            await expect.poll(profile).toHaveLength(16);
            const value = await pixel(page, 3, 4);
            expect(Number.isFinite(value)).toBe(true);
            if (variant === 'clean') {
                expectedCoordinates = state;
                expectedRgb = await renderedRgb(page);
                expectedPixel = value;
                expectedProfile = await profile();
                expect(expectedProfile.some(Number.isFinite)).toBe(true);
                continue;
            }
            expect(state).toEqual(expectedCoordinates!);
            await expect.poll(() => renderedRgb(page)).toEqual(expectedRgb!);
            expect(value).toBeCloseTo(expectedPixel!, 5);
            await expect.poll(profile).toEqual(expectedProfile!);
            expect(
                await page.evaluate(() =>
                    (
                        window as any
                    ).app.activeFrame.frameInfo.fileInfoExtended.headerEntries.some(
                        (entry: any) => !entry.name?.trim(),
                    ),
                ),
            ).toBe(true);
            await carta.selectMenuItem('View', 'File Header');
            const header = page.locator('.file-info-dialog');
            await expect(header).toContainText('PR3027 blank-keyword');
            await carta.closeDialog('file-info-dialog');
            await expect(header).toBeHidden();
            await page.mouse.move(0, 0);
            await expect(
                page.getByTestId('viewer-div').locator('.image-ratio-popup'),
            ).toHaveCSS('opacity', '0');
            await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
                `wcs-${kind}-blank-viewer.png`,
            );
            await expect(
                page
                    .getByTestId(
                        `spatial-profiler-${profileAxis === 'x' ? 0 : 1}-content`,
                    )
                    .locator('.profile-plot'),
            ).toHaveScreenshot(`wcs-${kind}-blank-profile.png`);
        }
    });
}

// Real backend file lists encode sizes/dates as protobuf Longs, even for tiny files.
function makeSortingFiles(catalog: boolean) {
    const root = mkdtempSync(path.join(path.dirname(fixtureFolder), 'sort-'));
    const names = ['middle-small', 'zeta-medium', 'alpha-large'].map(
        (name) => `${name}.${catalog ? 'vot' : 'fits'}`,
    );
    const dates = [900_000_000, 1_500_000_000, 1_000_000_000];
    for (const [index, name] of names.entries()) {
        let data: Buffer;
        if (catalog) {
            const table = readFileSync(
                path.join(fixtureFolder, 'catalogs/catalog-sky.vot'),
            );
            data = Buffer.alloc([9000, 75000, 1800000][index], ' ');
            table.copy(data);
        } else {
            const cube = readFileSync(path.join(fixtureFolder, 'cube.fits'));
            const channels = [5, 65, 1750][index];
            data = Buffer.alloc(
                2880 + Math.ceil((channels * 1024) / 2880) * 2880,
            );
            cube.copy(data, 0, 0, 2880);
            const offset = data.indexOf('NAXIS3  ');
            data.write(
                `NAXIS3  = ${String(channels).padStart(20)}`.padEnd(80),
                offset,
                'ascii',
            );
            for (let z = 0; z < channels; z++)
                cube.copy(
                    data,
                    2880 + z * 1024,
                    2880 + (z % 5) * 1024,
                    2880 + ((z % 5) + 1) * 1024,
                );
        }
        writeFileSync(path.join(root, name), data);
        utimesSync(path.join(root, name), dates[index], dates[index]);
    }
    const folders = ['dir-c-one', 'dir-a-two', 'dir-b-ten'];
    for (const [index, folder] of folders.entries()) {
        const dir = path.join(root, folder);
        mkdirSync(dir);
        for (let item = 0; item < [1, 2, 10][index]; item++)
            writeFileSync(path.join(dir, `item-${item}.txt`), 'fixture');
        utimesSync(dir, dates[index], dates[index]);
    }
    return { root, names, folders };
}

for (const catalog of [false, true]) {
    test(`${catalog ? 'Catalog' : 'Image'} browser loads the intended row after sorting and filtering`, async ({
        page,
    }, testInfo) => {
        test.setTimeout(90_000);
        page.setDefaultTimeout(10_000);
        const files = makeSortingFiles(catalog);
        try {
            const carta = new PlaywrightDevPage(page);
            await carta.goto();
            await carta.setTestPreferences();
            if (catalog) {
                await carta.loadImage('cube.fits');
                await carta.selectMenuItem('File', 'Import Catalog');
            }
            const browser = page.getByTestId('file-browser-dialog');
            await browser.locator('.edit-path-button').click();
            const directory = browser.getByPlaceholder(
                'Input directory path with respect to the top level folder',
            );
            await directory.fill(
                `${path.posix.dirname(fixtureBrowserPath)}/${path.basename(files.root)}`,
            );
            await directory.press('Enter');
            const entries = browser.locator(
                '.filename-cell .cell-text, .folder-cell .cell-text',
            );
            await expect(entries).toHaveCount(6);
            await expect(
                browser.getByText('1.8 MB', { exact: true }),
            ).toBeVisible();
            const size = browser
                .locator('.bp6-table-quadrant-top .sort-label')
                .filter({ hasText: /^Size$/ });
            await size.click();
            await expect(entries).toHaveText([
                ...files.folders,
                ...files.names,
            ]);
            await expect(
                browser
                    .locator('.bp6-table-quadrant-top .sort-label')
                    .filter({ hasText: /^Size$/ })
                    .locator('[data-icon="sort-asc"]'),
            ).toBeVisible();
            await size.click();
            await expect(size.locator('[data-icon="sort-desc"]')).toBeVisible();

            const date = browser
                .locator('.bp6-table-quadrant-top .sort-label')
                .filter({ hasText: /^Date$/ });
            // FileListTableComponent.test.ts owns the numeric sort matrix.
            // Here, exercise header wiring and load from the resulting table.
            await date.click();
            await expect(date.locator('[data-icon="sort-asc"]')).toBeVisible();
            await date.click();
            await expect(date.locator('[data-icon="sort-desc"]')).toBeVisible();
            await size.click();
            await expect(entries).toHaveText([
                ...files.folders,
                ...files.names,
            ]);
            const filter = browser.getByRole('textbox', {
                name: 'Filter by filename with fuzzy',
            });
            await filter.fill('no-matching-sort-file');
            await filter.press('Enter');
            await expect(
                browser.getByText('No results', { exact: true }),
            ).toBeVisible();
            await expect(
                browser.getByRole('button', {
                    name: catalog ? 'Load catalog' : 'Load',
                    exact: true,
                }),
            ).toBeDisabled();
            await filter.fill('');
            await filter.press('Enter');
            await expect(entries).toHaveText([
                ...files.folders,
                ...files.names,
            ]);
            await browser.screenshot({
                path: testInfo.outputPath('sorted-file-browser.png'),
            });
            await browser.getByText(files.names[0], { exact: true }).click();
            await browser
                .getByRole('button', {
                    name: catalog ? 'Load catalog' : 'Load',
                    exact: true,
                })
                .click();
            await expect(browser).toBeHidden();
            if (catalog) {
                const widget = page
                    .locator('.catalog-overlay')
                    .filter({ has: page.getByTestId('catalog-file-dropdown') });
                await widget.getByTestId('catalog-file-dropdown').click();
                await expect(
                    page.getByRole('menuitem', { name: /middle-small\.vot/ }),
                ).toBeVisible();
                await page.keyboard.press('Escape');
                await expect(
                    widget.getByTestId('catalog-table-filtering-info'),
                ).toContainText('total 5 entries');
                await widget.getByTestId('catalog-plot-button').click();
                await expect
                    .poll(() =>
                        page.evaluate(() => {
                            const store = (window as any).app.catalogStore;
                            const points = store.catalogGLData.get(
                                store.activeCatalogFiles.at(-1),
                            );
                            return Array.from(points?.x ?? []).filter(
                                (x: number, index) =>
                                    x >= 0 &&
                                    x < 16 &&
                                    points.y[index] >= 0 &&
                                    points.y[index] < 16,
                            ).length;
                        }),
                    )
                    .toBe(4);
                await expect
                    .poll(() =>
                        page
                            .locator('#catalog-canvas')
                            .evaluate((canvas: HTMLCanvasElement) => {
                                const copy = document.createElement('canvas');
                                copy.width = canvas.width;
                                copy.height = canvas.height;
                                const ctx = copy.getContext('2d')!;
                                ctx.drawImage(canvas, 0, 0);
                                const pixels = ctx.getImageData(
                                    0,
                                    0,
                                    copy.width,
                                    copy.height,
                                ).data;
                                let count = 0;
                                for (let i = 0; i < pixels.length; i += 4)
                                    if (
                                        pixels[i] === 0 &&
                                        pixels[i + 1] === 163 &&
                                        pixels[i + 2] === 150 &&
                                        pixels[i + 3]
                                    )
                                        count++;
                                return count;
                            }),
                    )
                    .toBeGreaterThan(0);
                await carta.closeWidget('catalog-overlay');
            } else {
                await expect
                    .poll(() => getFrames(page))
                    .toMatchObject([
                        {
                            filename: files.names[0],
                            width: 16,
                            height: 16,
                            channels: 5,
                        },
                    ]);
            }
            await page.evaluate(() => {
                const frame = (window as any).app.activeFrame;
                frame.setCursorPosition({ x: 8, y: 8 });
                frame.updateCursorRegion({ x: 8, y: 8 });
            });
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const app = (window as any).app;
                        const profile = app.spatialProfiles.get(
                            `${app.activeFrame.frameInfo.fileId}-0`,
                        );
                        return profile?.x === 8 && profile?.y === 8
                            ? Array.from(profile.getProfile('x')?.values ?? [])
                            : [];
                    }),
                )
                .toEqual(
                    Array.from({ length: 16 }, (_, x) => (x === 2 ? -3 : 1.5)),
                );
            await page.mouse.move(0, 0);
            await expect(page.locator('.image-ratio-popup')).toHaveCSS(
                'opacity',
                '0',
            );
            await expect
                .poll(async () => (await renderedRgb(page))[3])
                .toBe(255);
            await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
                `sorted-${catalog ? 'catalog' : 'image'}-viewer.png`,
            );
            await expect(
                page.locator('.spatial-profiler-widget .profile-plot').first(),
            ).toHaveScreenshot(
                `sorted-${catalog ? 'catalog' : 'image'}-spatial-profile.png`,
            );
        } finally {
            rmSync(files.root, { recursive: true, force: true });
        }
    });
}
