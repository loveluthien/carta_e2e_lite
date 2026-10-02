import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fixtureBrowserPath, PlaywrightDevPage } from '../utilities';

async function regionRgbCount(
    page: import('@playwright/test').Page,
    rgb: [number, number, number],
) {
    return page.evaluate((rgb) => {
        let matches = 0;
        document.querySelectorAll('.region-stage canvas').forEach((canvas) => {
            const context = (canvas as HTMLCanvasElement).getContext('2d');
            if (!context) return;
            const pixels = context.getImageData(
                0,
                0,
                context.canvas.width,
                context.canvas.height,
            ).data;
            for (let i = 0; i < pixels.length; i += 4) {
                if (
                    pixels[i] === rgb[0] &&
                    pixels[i + 1] === rgb[1] &&
                    pixels[i + 2] === rgb[2] &&
                    pixels[i + 3] > 0
                )
                    matches++;
            }
        });
        return matches;
    }, rgb);
}

test.describe('Regions', () => {
    test('Rectangle name and style edits update the viewer and profiler; invalid edits and locked deletion are rejected', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        const viewer = page.getByTestId('viewer-div');
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        await page.getByTestId('rectangle-region-shortcut-button').click();
        await canvas.dragTo(canvas, {
            sourcePosition: { x: box!.width * 0.35, y: box!.height * 0.35 },
            targetPosition: { x: box!.width * 0.65, y: box!.height * 0.65 },
        });

        const region = () =>
            page.evaluate(() => {
                const r = (
                    window as any
                ).app.activeFrame.regionSet.regions.find(
                    (r: any) => r.regionId === 1,
                );
                return (
                    r && {
                        name: r.nameString,
                        width: r.size.x,
                        color: r.color,
                        lineWidth: r.lineWidth,
                        opacity: r.opacity,
                        locked: r.isLocked,
                        center: r.center,
                    }
                );
            });
        await expect.poll(region).toMatchObject({ opacity: 1, locked: false });
        await page.getByTestId('region-list-0-header-title').click();
        const list = page.getByTestId('region-list-table');
        const row = list.getByTestId('region-list-table-row-2');
        await expect(row).toContainText('Rectangle');
        await row.click();
        await expect(row).toHaveClass(/active/);
        await expect(list).toHaveScreenshot('region-list-selected.png');
        await expect(viewer).toHaveScreenshot('region-created.png');

        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await expect(
            profiler.getByTestId('spectral-profiler-region-dropdown'),
        ).toContainText('Region 1');
        await page.keyboard.press('Escape');
        const plot = page
            .locator(
                '.spectral-profiler-widget .line-plot-component .annotation-stage canvas',
            )
            .first();
        await expect(plot).toBeVisible();
        await expect(plot).toHaveScreenshot('region-profile.png', {
            maxDiffPixelRatio: 0.02,
        });

        await row.dblclick();
        const dialog = page.locator('.region-dialog');
        await expect(dialog).toBeVisible();
        const name = dialog.getByPlaceholder('Enter a region name');
        await name.fill('Science ROI');
        const imageCoordinates = dialog
            .getByRole('radiogroup')
            .getByText('Image');
        await imageCoordinates.click();
        const width = dialog.getByRole('spinbutton', { name: 'Width' });
        await width.fill('80');
        await width.press('Tab');
        await expect
            .poll(region)
            .toMatchObject({ name: 'Science ROI', width: 80 });
        await expect(dialog.locator('.bp6-dialog-header')).toContainText(
            'Science ROI',
        );
        await expect(row).toContainText('Science ROI');

        await dialog.getByTestId('region-dialog-styling-tab-title').click();
        await dialog.locator('.color-swatch-button').click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        const lineWidth = dialog.getByTestId('region-dialog-line-width-input');
        await lineWidth.fill('5');
        await lineWidth.press('Tab');
        await expect
            .poll(region)
            .toMatchObject({ color: '#ffffff', lineWidth: 5 });
        await expect
            .poll(() => regionRgbCount(page, [255, 255, 255]))
            .toBeGreaterThan(0);

        await dialog.getByTestId('region-dialog-config-tab-title').click();

        await width.fill('-5');
        await width.press('Tab');
        await expect.poll(async () => (await region()).width).toBe(80);

        await page.getByTestId('region-dialog-header-close-button').click();
        await expect(viewer).toHaveScreenshot('region-edited.png');
        await expect(plot).toHaveScreenshot('region-profile-edited.png', {
            maxDiffPixelRatio: 0.02,
        });
        await row.dblclick();

        await dialog.getByTestId('region-dialog-focus-button').click();
        await expect
            .poll(async () => {
                const { center } = await region();
                return page
                    .evaluate(() => (window as any).app.activeFrame.center)
                    .then((frameCenter) => ({
                        dx: Math.abs(frameCenter.x - center.x),
                        dy: Math.abs(frameCenter.y - center.y),
                    }));
            })
            .toMatchObject({ dx: 0, dy: 0 });
        await dialog.getByTestId('region-dialog-export-button').click();
        const exportDialog = page.getByTestId('file-browser-dialog');
        await expect(exportDialog).toBeVisible();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();

        await dialog.getByTestId('region-dialog-lock-button').click();
        await expect.poll(region).toMatchObject({ locked: true });
        await expect(
            dialog.getByTestId('region-dialog-delete-button'),
        ).toBeDisabled();
        await dialog.getByTestId('region-dialog-lock-button').click();
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await expect
            .poll(region)
            .toMatchObject({ opacity: 0.5, locked: false });
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await expect.poll(region).toMatchObject({ opacity: 0 });
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await expect.poll(region).toMatchObject({ opacity: 1 });

        await dialog.getByTestId('region-dialog-delete-button').click();
        await expect.poll(region).toBeFalsy();
        await expect(row).toHaveCount(0);
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await expect(
            page.getByTestId('spectral-profiler-region-dropdown-region-1'),
        ).toHaveCount(0);
    });

    test('Creates every region shape and cancels an incomplete polygon', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');

        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        const center = { x: box!.width / 2, y: box!.height / 2 };
        const draw = async (type: string) => {
            await page.getByTestId(`${type}-region-shortcut-button`).click();
            if (type === 'point') {
                await canvas.click({ position: center });
            } else if (type === 'polygon' || type === 'polyline') {
                const vertices = [
                    { x: center.x - 100, y: center.y - 70 },
                    { x: center.x + 100, y: center.y - 70 },
                    { x: center.x + 30, y: center.y + 80 },
                ];
                for (const vertex of vertices)
                    await canvas.click({ position: vertex });
                await canvas.dblclick({ position: vertices[2] });
            } else {
                await canvas.dragTo(canvas, {
                    sourcePosition: {
                        x: center.x - 100,
                        y: center.y - 70,
                    },
                    targetPosition: {
                        x: center.x + 100,
                        y: center.y + 70,
                    },
                });
            }
        };

        for (const type of [
            'point',
            'line',
            'rectangle',
            'ellipse',
            'polygon',
            'polyline',
        ]) {
            await draw(type);
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (
                                window as any
                            ).app.activeFrame.regionSet.regions.filter(
                                (r: any) => r.regionId > 0 && !r.isTemporary,
                            ).length,
                    ),
                )
                .toBe(
                    [
                        'point',
                        'line',
                        'rectangle',
                        'ellipse',
                        'polygon',
                        'polyline',
                    ].indexOf(type) + 1,
                );
        }

        await page.getByTestId('region-list-0-header-title').click();
        const list = page.getByTestId('region-list-table');
        for (const [index, type] of [
            'Point',
            'Line',
            'Rectangle',
            'Ellipse',
            'Polygon',
            'Polyline',
        ].entries()) {
            await expect(
                list.getByTestId(`region-list-table-row-${index + 2}`),
            ).toContainText(type);
        }
        await expect(list).toHaveScreenshot('all-region-shapes-list.png');
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'all-region-shapes-viewer.png',
        );

        await page.getByTestId('polygon-region-shortcut-button').click();
        await canvas.click({
            position: { x: center.x - 60, y: center.y - 40 },
        });
        await canvas.click({
            position: { x: center.x + 60, y: center.y - 40 },
        });
        await page.keyboard.press('Escape');
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as any
                        ).app.activeFrame.regionSet.regions.filter(
                            (r: any) => r.regionId > 0 && !r.isTemporary,
                        ).length,
                ),
            )
            .toBe(6);

        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await page.keyboard.press('Escape');
        const profile = page
            .locator(
                '.spectral-profiler-widget .line-plot-component .annotation-stage canvas',
            )
            .first();
        await expect(profile).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as any
                        ).app.widgetsStore.spectralProfileWidgets.get(
                            'spectral-profiler-0',
                        )?.plotData?.data?.[0]?.length ?? 0,
                ),
            )
            .toBe(5);
        expect(
            await page.evaluate(() =>
                (window as any).app.widgetsStore.spectralProfileWidgets
                    .get('spectral-profiler-0')
                    ?.plotData?.data?.[0]?.every((point: any) =>
                        Number.isFinite(point.y),
                    ),
            ),
        ).toBe(true);
        await expect(profile).toHaveScreenshot(
            'all-region-shapes-profile.png',
            {
                maxDiffPixelRatio: 0.02,
            },
        );
    });

    test('Region list actions control regions and open import/export flows', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .first();
        await page.getByTestId('point-region-shortcut-button').click();
        await canvas.click({ position: { x: 280, y: 220 } });
        await page.getByTestId('rectangle-region-shortcut-button').click();
        await canvas.dragTo(canvas, {
            sourcePosition: { x: 330, y: 250 },
            targetPosition: { x: 430, y: 350 },
        });

        await page.getByTestId('region-list-0-header-title').click();
        const widget = page.locator('.region-list-widget');
        const list = widget.getByTestId('region-list-table');
        const first = list.getByTestId('region-list-table-row-2');
        const second = list.getByTestId('region-list-table-row-3');
        await expect(first).toContainText('Point');
        await expect(second).toContainText('Rectangle');
        await first.click();
        await expect(first).toHaveClass(/active/);

        const state = (regionId: number) =>
            page.evaluate((regionId) => {
                const region = (
                    window as any
                ).app.activeFrame.regionSet.regions.find(
                    (r: any) => r.regionId === regionId,
                );
                return {
                    opacity: region.opacity,
                    locked: region.isLocked,
                };
            }, regionId);
        await first.locator('.cell').nth(1).click();
        await expect.poll(() => state(1)).toMatchObject({ opacity: 0.5 });
        await first.locator('.cell').nth(1).click();
        await expect.poll(() => state(1)).toMatchObject({ opacity: 0 });
        await first.locator('.cell').nth(1).click();
        await expect.poll(() => state(1)).toMatchObject({ opacity: 1 });
        await second.locator('.cell').nth(0).click();
        await expect.poll(() => state(2)).toMatchObject({ locked: true });
        await second.locator('.cell').nth(0).click();
        await expect.poll(() => state(2)).toMatchObject({ locked: false });

        const headerIcons = list
            .locator('.row-header .cell')
            .first()
            .locator('svg');
        await expect(headerIcons).toHaveCount(2);
        await headerIcons.nth(0).click();
        await expect.poll(() => state(1)).toMatchObject({ locked: true });
        await expect.poll(() => state(2)).toMatchObject({ locked: true });
        await headerIcons.nth(0).click();
        await expect.poll(() => state(1)).toMatchObject({ locked: false });
        await headerIcons.nth(1).click();
        await expect.poll(() => state(1)).toMatchObject({ opacity: 0.5 });
        await expect.poll(() => state(2)).toMatchObject({ opacity: 0.5 });
        await headerIcons.nth(1).click();
        await expect.poll(() => state(1)).toMatchObject({ opacity: 0 });
        await headerIcons.nth(1).click();
        await expect.poll(() => state(1)).toMatchObject({ opacity: 1 });

        const actions = widget.locator('.float .bp6-button');
        await expect(actions).toHaveCount(3);
        for (const index of [0, 1, 2])
            await expect(actions.nth(index)).toBeEnabled();
        for (const index of [1, 2]) {
            await actions.nth(index).click();
            const fileBrowser = page.getByTestId('file-browser-dialog');
            await expect(fileBrowser).toBeVisible();
            await page
                .getByTestId('file-browser-dialog-header-close-button')
                .click();
            await expect(fileBrowser).toBeHidden();
        }
        await first.locator('.cell').nth(3).click();
        const regionExportDialog = page.getByTestId('file-browser-dialog');
        await expect(regionExportDialog).toBeVisible();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();
        await expect(regionExportDialog).toBeHidden();
        await actions.nth(0).click();
        await expect(
            page.getByText('Are you sure you want to delete all regions?'),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect.poll(() => state(1)).toMatchObject({ opacity: 1 });

        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'region-list-actions-viewer.png',
        );
        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await page.keyboard.press('Escape');
        await expect(
            page
                .locator(
                    '.spectral-profiler-widget .line-plot-component .annotation-stage canvas',
                )
                .first(),
        ).toHaveScreenshot('region-list-actions-profile.png', {
            maxDiffPixelRatio: 0.02,
        });
    });

    test('Saves regions to a file and loads them back into the image', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const formats = [
            {
                fileName: 'regions-roundtrip-e2e.crtf',
                filePath: path.resolve(
                    __dirname,
                    '../test_data/regions-roundtrip-e2e.crtf',
                ),
                snapshot: 'region-load-save-crtf-viewer.png',
            },
            {
                fileName: 'regions-roundtrip-e2e.reg',
                filePath: path.resolve(
                    __dirname,
                    '../test_data/regions-roundtrip-e2e.reg',
                ),
                snapshot: 'region-load-save-ds9-viewer.png',
                ds9: true,
            },
        ];
        const regionDirectory = fixtureBrowserPath;
        for (const format of formats) rmSync(format.filePath, { force: true });

        try {
            await carta.goto();
            await carta.loadImage('cube.fits');

            const canvas = page
                .locator('.region-stage > .konvajs-content > canvas')
                .first();
            await page.getByTestId('rectangle-region-shortcut-button').click();
            await canvas.dragTo(canvas, {
                sourcePosition: { x: 330, y: 250 },
                targetPosition: { x: 430, y: 350 },
            });

            await page.getByTestId('region-list-0-header-title').click();
            const row = page
                .getByTestId('region-list-table')
                .getByTestId('region-list-table-row-2');
            await row.dblclick();
            const regionDialog = page.locator('.region-dialog');
            const regionName = regionDialog.getByPlaceholder(
                'Enter a region name',
            );
            await regionName.fill('Round Trip ROI');
            await regionName.press('Tab');
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame.regionSet.regions[1]
                                .nameString,
                    ),
                )
                .toBe('Round Trip ROI');
            const originalGeometry = await page.evaluate(() => {
                const region = (window as any).app.activeFrame.regionSet
                    .regions[1];
                const rounded = (value: number) =>
                    Math.round(value * 1000) / 1000;
                return {
                    center: {
                        x: rounded(region.center.x),
                        y: rounded(region.center.y),
                    },
                    size: {
                        x: rounded(region.size.x),
                        y: rounded(region.size.y),
                    },
                };
            });
            await page.getByTestId('region-dialog-header-close-button').click();

            const browser = page.getByTestId('file-browser-dialog');
            const directory = browser.getByPlaceholder(
                'Input directory path with respect to the top level folder',
            );
            for (const format of formats) {
                await page.getByRole('menuitem', { name: 'File' }).click();
                await page
                    .getByRole('menuitem', { name: 'Export Regions' })
                    .click();
                await expect(browser).toBeVisible();
                await browser.locator('.edit-path-button').click();
                await directory.fill(regionDirectory);
                await directory.press('Enter');
                if (format.ds9) {
                    await browser
                        .getByTestId('export-region-file-type-dropdown')
                        .click();
                    await page
                        .getByRole('menuitem', { name: 'DS9 region file' })
                        .click();
                }
                await browser
                    .getByPlaceholder('Enter file name')
                    .fill(format.fileName);
                await browser
                    .getByRole('button', { name: 'Export regions' })
                    .click();
                await expect(browser).toBeHidden();
                await expect.poll(() => existsSync(format.filePath)).toBe(true);
                expect(readFileSync(format.filePath, 'utf8')).toContain(
                    'Round Trip ROI',
                );
            }

            await row.dblclick();
            await page.getByTestId('region-dialog-delete-button').click();
            await expect(row).toHaveCount(0);
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame.regionSet.regions
                                .length,
                    ),
                )
                .toBe(1);

            for (const format of formats) {
                await page.getByRole('menuitem', { name: 'File' }).click();
                await page
                    .getByRole('menuitem', { name: 'Import Regions' })
                    .click();
                await expect(browser).toBeVisible();
                await browser.locator('.edit-path-button').click();
                await directory.fill(regionDirectory);
                await directory.press('Enter');
                await browser
                    .getByText(format.fileName, { exact: true })
                    .click();
                await expect(
                    browser.getByRole('button', { name: 'Load region' }),
                ).toBeEnabled();
                await browser
                    .getByRole('button', { name: 'Load region' })
                    .click();
                await expect(browser).toBeHidden();

                await expect
                    .poll(() =>
                        page.evaluate(() => {
                            const regions = (window as any).app.activeFrame
                                .regionSet.regions;
                            return regions
                                .filter((region: any) => region.regionId > 0)
                                .map((region: any) => {
                                    const rounded = (value: number) =>
                                        Math.round(value * 1000) / 1000;
                                    return {
                                        type: region.regionType,
                                        center: {
                                            x: rounded(region.center.x),
                                            y: rounded(region.center.y),
                                        },
                                        size: {
                                            x: rounded(region.size.x),
                                            y: rounded(region.size.y),
                                        },
                                        color: region.color,
                                    };
                                });
                        }),
                    )
                    .toMatchObject([
                        {
                            type: 3,
                            center: originalGeometry.center,
                            size: originalGeometry.size,
                            color: '#2EE6D6',
                        },
                    ]);
                await expect(row).toContainText('Rectangle');
                await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
                    format.snapshot,
                );

                await row.dblclick();
                await page.getByTestId('region-dialog-delete-button').click();
                await expect(row).toHaveCount(0);
            }
        } finally {
            for (const format of formats)
                rmSync(format.filePath, { force: true });
        }
    });

    test('Spatially matched images share region selection and profiler data', async ({
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

        const imageList = page
            .locator('[data-testid^="layer-list-"][data-testid$="-content"]')
            .filter({ has: page.locator('.layer-list-widget') })
            .last();
        const matching = imageList.getByTestId('image-list-0-matching-xy');
        await imageList.getByTestId('image-list-1-image-name').click();
        if (
            await page.evaluate(
                () => !!(window as any).app.frames[1].spatialReference,
            )
        )
            await matching.click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.frames[1].spatialReference
                            ?.filename ?? null,
                ),
            )
            .toBeNull();
        await matching.click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.frames[1].spatialReference
                            ?.filename ?? null,
                ),
            )
            .toBe('cube.fits');
        await carta.closeWidget('layer-list');
        await carta.closeWidget('region-list');

        const canvas = page
            .locator('.region-stage > .konvajs-content > canvas')
            .last();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        await page.getByTestId('rectangle-region-shortcut-button').click();
        await canvas.dragTo(canvas, {
            sourcePosition: { x: box!.width * 0.35, y: box!.height * 0.15 },
            targetPosition: { x: box!.width * 0.65, y: box!.height * 0.35 },
        });
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const [reference, matched] = (window as any).app.frames;
                    return {
                        sharedRegionSet:
                            reference.regionSet === matched.regionSet,
                        regions: matched.regionSet.regions.filter(
                            (r: any) => r.regionId > 0 && !r.isTemporary,
                        ).length,
                    };
                }),
            )
            .toMatchObject({ sharedRegionSet: true, regions: 1 });
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'spatially-matched-region-viewer.png',
        );

        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await page.keyboard.press('Escape');
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as any
                        ).app.widgetsStore.spectralProfileWidgets.get(
                            'spectral-profiler-0',
                        )?.plotData?.data?.[0]?.length ?? 0,
                ),
            )
            .toBe(5);
        await expect(
            page
                .locator(
                    '.spectral-profiler-widget .line-plot-component .annotation-stage canvas',
                )
                .first(),
        ).toHaveScreenshot('spatially-matched-region-profile.png', {
            maxDiffPixelRatio: 0.02,
        });
    });
});
