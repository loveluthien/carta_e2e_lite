import { expect, test, type Page } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const raster = (page: Page) => page.locator('#raster-canvas').first();
async function rasterImage(page: Page) {
    const dataUrl = await raster(page).evaluate((source: HTMLCanvasElement) => {
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        copy.getContext('2d')!.drawImage(source, 0, 0);
        return copy.toDataURL('image/png');
    });
    return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function rasterCenter(page: Page) {
    return raster(page).evaluate((source: HTMLCanvasElement) => {
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d')!;
        context.drawImage(source, 0, 0);
        return Array.from(
            context.getImageData(
                Math.floor(copy.width / 2),
                Math.floor(copy.height / 2),
                1,
                1,
            ).data,
        );
    });
}

async function matchingState(page: any, type: string) {
    return page.evaluate((type: string) => {
        const app = (window as any).app;
        return app.frames.map((frame: any) => ({
            filename: frame.filename,
            reference:
                frame[
                    type === 'xy'
                        ? 'spatialReference'
                        : type === 'z'
                          ? 'spectralReference'
                          : 'rasterScalingReference'
                ]?.filename ?? null,
        }));
    }, type);
}

test.describe('Image Layer Widget', () => {
    test('Reports and preserves an unmatched frame when spectral matching fails', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        await carta.goto();
        await carta.loadImage('cube.fits');
        await carta.loadImage('incompatible-spectral.fits', true);
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);

        const widget = page
            .locator('[data-testid^="layer-list-"][data-testid$="-content"]')
            .filter({ has: page.locator('.layer-list-widget') })
            .last();
        const spectralMatching = widget.getByTestId('image-list-0-matching-z');
        const unmatched = [
            { filename: 'cube.fits', reference: null },
            { filename: 'incompatible-spectral.fits', reference: null },
        ];

        if ((await matchingState(page, 'z'))[1].reference) {
            await spectralMatching.click();
            await expect
                .poll(() => matchingState(page, 'z'))
                .toEqual(unmatched);
        }

        await expect
            .poll(() => rasterCenter(page).then((pixels) => pixels[3]))
            .toBe(255);
        const unchangedRaster = await rasterImage(page);

        await spectralMatching.click();
        await expect(
            page.getByText(/Could not enable spectral matching/),
        ).toBeVisible();
        await expect.poll(() => matchingState(page, 'z')).toEqual(unmatched);
        expect(await rasterImage(page)).toEqual(unchangedRaster);
    });

    test('Selecting an image and toggling its raster layer updates the canvas', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        await carta.loadImage('stokes.Q.fits', true);
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);

        const widget = page.locator('.layer-list-widget').last();
        await widget.getByTestId('image-list-0-image-name').click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame.filename),
            )
            .toBe('cube.fits');
        await expect
            .poll(() => rasterCenter(page).then((pixels) => pixels[3]))
            .toBe(255);
        const [red, green, blue, alpha] = await rasterCenter(page);
        expect(red).toBeGreaterThanOrEqual(235);
        expect(red).toBeLessThanOrEqual(250);
        expect(green).toBeGreaterThanOrEqual(210);
        expect(green).toBeLessThanOrEqual(235);
        expect(blue).toBeGreaterThanOrEqual(65);
        expect(blue).toBeLessThanOrEqual(105);
        expect(alpha).toBe(255);
        expect(await rasterImage(page)).toMatchSnapshot(
            'image-layer-raster-visible.png',
        );

        const rasterToggle = widget
            .getByRole('button', { name: 'R', exact: true })
            .first();
        await rasterToggle.click();
        await expect.poll(() => rasterCenter(page)).toEqual([0, 0, 0, 0]);
        expect(await rasterImage(page)).toMatchSnapshot(
            'image-layer-raster-hidden.png',
        );
        await rasterToggle.click();
        await expect
            .poll(() => rasterCenter(page).then((pixels) => pixels[3]))
            .toBe(255);
        expect(await rasterImage(page)).toMatchSnapshot(
            'image-layer-raster-visible.png',
        );

        await widget.getByTestId('image-list-1-image-name').click();
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame.filename),
            )
            .toBe('stokes.Q.fits');
        await expect(
            widget.getByTestId('image-list-1-image-name'),
        ).toContainText('stokes.Q.fits');
        await expect(
            widget.getByTestId('image-list-0-matching-t'),
        ).toBeDisabled();
    });

    test('Time-series membership, sorting, references, and close actions use the selected rows', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        for (const [index, name] of [
            'time-late.fits',
            'cube.fits',
            'time-early.fits',
        ].entries()) {
            await carta.loadImage(name, index > 0);
        }
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);
        const widget = page.locator('.layer-list-widget').last();
        const names = () =>
            page.evaluate(() =>
                (window as any).app.imageViewConfigStore.imageList.map(
                    (image: any) => image.store.filename,
                ),
            );
        const members = () =>
            page.evaluate(() =>
                (window as any).app.timeSeriesStore.elements.map(
                    (element: any) => element.frame.filename,
                ),
            );
        const choose = async (row: number, action: string) => {
            await widget
                .getByTestId(`image-list-${row}-image-name`)
                .click({ button: 'right' });
            await page
                .getByRole('menuitem', { name: action, exact: true })
                .click();
        };

        await expect
            .poll(names)
            .toEqual(['time-late.fits', 'cube.fits', 'time-early.fits']);
        await expect(
            widget.getByTestId('image-list-1-matching-t'),
        ).toBeDisabled();
        await widget.getByTestId('image-list-0-image-name').click();
        await widget.getByTestId('image-list-0-matching-t').click();
        await expect
            .poll(members)
            .toEqual(['time-early.fits', 'time-late.fits']);
        await widget.getByTestId('image-list-2-matching-t').click();
        await expect.poll(members).toEqual(['time-late.fits']);
        await widget.getByTestId('image-list-0-matching-t').click();
        await expect
            .poll(members)
            .toEqual(['time-early.fits', 'time-late.fits']);
        await widget.getByTestId('image-list-0-matching-t').click();
        await expect.poll(members).toEqual([]);

        await choose(0, 'Sort images by time');
        await expect
            .poll(names)
            .toEqual(['time-early.fits', 'time-late.fits', 'cube.fits']);
        await expect(widget.getByTestId('image-list-0-image-name')).toHaveText(
            'time-early.fits',
        );
        await expect
            .poll(() => rasterCenter(page).then((pixels) => pixels[3]))
            .toBe(255);
        expect(await rasterImage(page)).toMatchSnapshot(
            'image-layer-raster-visible.png',
        );

        await choose(0, 'Set as spatial reference');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.spatialReference.filename,
                ),
            )
            .toBe('time-early.fits');
        await choose(0, 'Set as spectral reference');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.spectralReference.filename,
                ),
            )
            .toBe('time-early.fits');
        await choose(0, 'Set as raster scaling reference');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.rasterScalingReference.filename,
                ),
            )
            .toBe('time-early.fits');
        await choose(1, 'Set as all references');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (window as any).app;
                    return [
                        app.spatialReference.filename,
                        app.spectralReference.filename,
                        app.rasterScalingReference.filename,
                    ];
                }),
            )
            .toEqual(Array(3).fill('time-late.fits'));

        await choose(0, 'Set rest frequency');
        const restFrequency = page.locator('.layer-list-settings-panel');
        await expect(restFrequency).toBeVisible();
        await expect(
            restFrequency.getByRole('tab', { name: 'Rest Frequency' }),
        ).toHaveAttribute('aria-selected', 'true');
        await expect(
            restFrequency.getByTestId('rest-freq-input-3').first(),
        ).toBeVisible();
        await page
            .locator('.floating-widget')
            .filter({ has: restFrequency })
            .locator('[data-testid$="-header-close-button"]')
            .click();
        await expect(restFrequency).toBeHidden();

        await choose(2, 'Close image');
        await expect.poll(names).toEqual(['time-early.fits', 'time-late.fits']);
        await choose(0, 'Close other images');
        await expect.poll(names).toEqual(['time-early.fits']);
        await carta.loadImage('cube.fits', true);
        await expect.poll(names).toEqual(['time-early.fits', 'cube.fits']);
        await choose(0, 'Close all images');
        await expect(widget.getByText('No file loaded')).toBeVisible();
    });

    test('Matches and unmatches every frame when four images are open', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const filenames = [
            'cube.fits',
            'stokes.I.fits',
            'stokes.Q.fits',
            'stokes.U.fits',
        ];

        await carta.goto();
        await carta.loadImage(filenames[0]);
        for (const filename of filenames.slice(1)) {
            await carta.loadImage(filename, true);
        }
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);

        const widget = page
            .locator('[data-testid^="layer-list-"][data-testid$="-content"]')
            .filter({ has: page.locator('.layer-list-widget') })
            .last();
        const unmatched = filenames.map((filename) => ({
            filename,
            reference: null,
        }));

        await expect
            .poll(() => page.evaluate(() => (window as any).app.frames.length))
            .toBe(filenames.length);

        for (const type of ['xy', 'z', 'r']) {
            const button = widget.getByTestId(`image-list-0-matching-${type}`);
            if (
                (await matchingState(page, type)).some(
                    (frame: { reference: string | null }) => frame.reference,
                )
            ) {
                await button.click();
                await expect
                    .poll(() => matchingState(page, type))
                    .toEqual(unmatched);
            }

            await button.click();
            await expect
                .poll(() => matchingState(page, type))
                .toEqual(
                    filenames.map((filename, index) => ({
                        filename,
                        reference: index === 0 ? null : filenames[0],
                    })),
                );
            await button.click();
            await expect
                .poll(() => matchingState(page, type))
                .toEqual(unmatched);

            const oneFrame = widget.getByTestId(
                `image-list-2-matching-${type}`,
            );
            await oneFrame.click();
            await expect
                .poll(() => matchingState(page, type))
                .toEqual(
                    unmatched.map((frame, index) => ({
                        ...frame,
                        reference: index === 2 ? filenames[0] : null,
                    })),
                );
            await oneFrame.click();
            await expect
                .poll(() => matchingState(page, type))
                .toEqual(unmatched);
        }
        await expect
            .poll(() => rasterCenter(page).then((pixels) => pixels[3]))
            .toBe(255);
        expect(await rasterImage(page)).toMatchSnapshot(
            'image-layer-four-frames.png',
        );
    });

    test('Spatial and spectral matching align shifted lightweight cubes', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        await carta.loadImage('matching-cube.fits', true);
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);

        const widget = page
            .locator('[data-testid^="layer-list-"][data-testid$="-content"]')
            .filter({ has: page.locator('.layer-list-widget') })
            .last();
        const state = () =>
            page.evaluate(() => {
                const [reference, matched] = (window as any).app.frames;
                return {
                    center: matched.center,
                    channel: matched.channel,
                    spatial: matched.spatialReference?.filename ?? null,
                    spectral: matched.spectralReference?.filename ?? null,
                    referenceCenter: reference.center,
                    referenceChannel: reference.channel,
                };
            });

        for (const type of ['xy', 'z']) {
            if ((await matchingState(page, type))[1].reference) {
                await widget
                    .getByTestId(`image-list-0-matching-${type}`)
                    .click();
            }
        }
        await expect
            .poll(state)
            .toMatchObject({ spatial: null, spectral: null });

        await page.evaluate(() => {
            const reference = (window as any).app.frames[0];
            reference.setCenter(5, 7);
            reference.setChannel(3);
        });
        await expect.poll(state).toMatchObject({ channel: 0 });

        await widget.getByTestId('image-list-0-matching-xy').click();
        await widget.getByTestId('image-list-0-matching-z').click();
        await expect.poll(state).toMatchObject({
            spatial: 'cube.fits',
            spectral: 'cube.fits',
            referenceCenter: { x: 5, y: 7 },
            referenceChannel: 3,
        });

        await page.evaluate(() => {
            const reference = (window as any).app.frames[0];
            reference.setCenter(6, 6);
            reference.setChannel(4);
        });
        await expect.poll(state).toMatchObject({
            channel: 2,
            spatial: 'cube.fits',
            spectral: 'cube.fits',
        });
        expect((await state()).center.x).toBeCloseTo(7.732, 2);
        expect((await state()).center.y).toBeCloseTo(6, 2);

        await expect(page.getByTestId('viewer-div')).toBeVisible();
        await page.locator('#SpectralProfilerButton').click();
        await expect(
            page.getByTestId('spectral-profiler-0-content'),
        ).toBeVisible();
        await page.evaluate(() => {
            const frame = (window as any).app.frames[1];
            frame.setCursorPosition({ x: 8, y: 6 });
            frame.updateCursorRegion({ x: 8, y: 6 });
        });
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Value:  1.1e+1 K',
        );
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Velocity: 4.0000 km/s',
        );
        await expect(
            page
                .getByTestId('spectral-profiler-0-content')
                .getByTestId('spectral-profiler-info-0'),
        ).toContainText('Data:');
        await expect(
            page
                .getByTestId('spectral-profiler-0-content')
                .locator('.line-plot-component canvas')
                .first(),
        ).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).app.widgetsStore.spectralProfileWidgets
                        .get('spectral-profiler-0')
                        ?.plotData?.data[0]?.map((point: any) => point.y),
                ),
            )
            .toEqual([2.75, 5.5, 11, 22, 44]);
        const plot = page
            .getByTestId('spectral-profiler-0-content')
            .locator(
                '.line-plot-component > .annotation-stage > .konvajs-content > canvas',
            )
            .first();
        await expect(plot).toHaveScreenshot(
            'image-layer-matched-spectral-profile.png',
        );
        await expect(page.locator('#raster-canvas').first()).toBeVisible();
        expect(await rasterImage(page)).toMatchSnapshot(
            'image-layer-matched-raster.png',
        );
    });

    test('Reorders layers by dragging and toggles all matching modes', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        await carta.goto();
        await carta.loadImage('cube.fits');
        await carta.loadImage('iquv.fits', true);
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);

        const widget = page
            .locator('[data-testid^="layer-list-"][data-testid$="-content"]')
            .filter({ has: page.locator('.layer-list-widget') })
            .last();
        await expect(widget).toBeVisible();

        for (const type of ['xy', 'z', 'r']) {
            const button = widget.getByTestId(`image-list-0-matching-${type}`);
            if ((await matchingState(page, type))[1].reference) {
                await button.click();
                await expect
                    .poll(() => matchingState(page, type))
                    .toEqual([
                        { filename: 'cube.fits', reference: null },
                        { filename: 'iquv.fits', reference: null },
                    ]);
            }
            await button.click();
            await expect
                .poll(() => matchingState(page, type))
                .toEqual([
                    { filename: 'cube.fits', reference: null },
                    { filename: 'iquv.fits', reference: 'cube.fits' },
                ]);
            await button.click();
            await expect
                .poll(() => matchingState(page, type))
                .toEqual([
                    { filename: 'cube.fits', reference: null },
                    { filename: 'iquv.fits', reference: null },
                ]);
            await button.click();
            await expect
                .poll(() => matchingState(page, type))
                .toEqual([
                    { filename: 'cube.fits', reference: null },
                    { filename: 'iquv.fits', reference: 'cube.fits' },
                ]);
        }

        const rowNames = widget.locator('.bp6-table-row-name');
        const firstRow = rowNames.filter({ hasText: /^0$/ }).last();
        const secondRow = rowNames.filter({ hasText: /^1$/ }).last();
        await expect(firstRow).toBeVisible();
        await expect(secondRow).toBeVisible();
        await secondRow.click();
        await secondRow.dragTo(firstRow, {
            targetPosition: { x: 10, y: 1 },
        });
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).app.imageViewConfigStore.imageList.map(
                        (image: any) => image.store.filename,
                    ),
                ),
            )
            .toEqual(['iquv.fits', 'cube.fits']);
        await expect(widget.getByTestId('image-list-0-image-name')).toHaveText(
            'iquv.fits',
        );
        await expect(widget.getByTestId('image-list-1-image-name')).toHaveText(
            'cube.fits',
        );
        await expect(widget).toHaveScreenshot('image-layer-reordered-list.png');
        await expect
            .poll(() => rasterCenter(page).then((pixels) => pixels[3]))
            .toBe(255);
        expect(await rasterImage(page)).toMatchSnapshot(
            'image-layer-raster-visible.png',
        );
    });
});
