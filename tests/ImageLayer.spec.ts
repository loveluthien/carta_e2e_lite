import { expect, test } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

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

test.describe('Image layer widget E2E set', () => {
    test('reports and preserves an unmatched frame when spectral matching fails', async ({
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

        await spectralMatching.click();
        await expect(
            page.getByText(/Could not enable spectral matching/),
        ).toBeVisible();
        await expect.poll(() => matchingState(page, 'z')).toEqual(unmatched);
    });

    test('matches and unmatches every frame when four images are open', async ({
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
        }
    });

    test('spatial and spectral matching align shifted lightweight cubes', async ({
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
    });

    test('reorders layers by dragging and toggles all matching modes', async ({
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
    });
});
