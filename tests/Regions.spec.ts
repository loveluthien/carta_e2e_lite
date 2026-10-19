import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fixtureBrowserPath, PlaywrightDevPage } from '../utilities';

async function regionRgbCount(page: Page, rgb: [number, number, number]) {
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
        await expect(viewer.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
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
            await expect(
                list.getByTestId(`region-list-table-row-${index + 2}`),
            ).toContainText(`Region ${index + 1}`);
        }
        await expect
            .poll(() => regionRgbCount(page, [46, 230, 214]))
            .toBeGreaterThan(0);
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
                page.evaluate(() =>
                    (window as any).app.activeFrame.regionSet.regions
                        .filter((r: any) => r.regionId > 0 || r.isTemporary)
                        .map((r: any) => ({
                            id: r.regionId,
                            temporary: r.isTemporary,
                        })),
                ),
            )
            .toEqual(
                Array.from({ length: 6 }, (_, index) => ({
                    id: index + 1,
                    temporary: false,
                })),
            );

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

    test('Creates and edits every annotation type in the viewer and region list', async ({
        page,
    }) => {
        test.setTimeout(90_000);
        page.setDefaultTimeout(10_000);
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        await createAnnotations(page);
        await expect
            .poll(() => regionRgbCount(page, [255, 186, 1]))
            .toBeGreaterThan(0);

        // An incomplete annotation must leave no temporary object or rendered path.
        const canvas = page.locator('.region-stage canvas').first();
        await page.getByTestId('annotation-shortcut-dropdown').click();
        await page.getByTestId('annotation-shortcut-dropdown-polygon').click();
        await canvas.click({ position: { x: 50, y: 60 } });
        await canvas.click({ position: { x: 90, y: 60 } });
        await page.keyboard.press('Escape');
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as any
                        ).app.activeFrame.regionSet.regions.filter(
                            (r: any) => r.isTemporary,
                        ).length,
                ),
            )
            .toBe(0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'all-annotations-created.png',
        );

        await page.getByTestId('region-list-0-header-title').click();
        const list = page.getByTestId('region-list-table');
        const dialog = page.locator('.region-dialog');
        const formGroup = (label: string) =>
            dialog.locator('.bp6-form-group').filter({
                has: page.getByText(label, { exact: true }),
            });
        const setInput = async (placeholder: string, value: string) => {
            const input = dialog
                .getByPlaceholder(placeholder, { exact: true })
                .filter({ visible: true })
                .first();
            await input.fill(value);
            await input.press('Tab');
        };
        for (const [index, annotation] of annotationTypes.entries()) {
            await list
                .locator(':scope > div')
                .last()
                .evaluate((element, index) => {
                    element.scrollTop = index * 35;
                }, index);
            const row = list.getByTestId(`region-list-table-row-${index + 2}`);
            await expect(row).toContainText(annotation.name);
            await row.dblclick();
            await dialog.getByTestId('region-dialog-config-tab-title').click();
            await setInput(
                'Enter an annotation name',
                `Science ${annotation.name}`,
            );
            await expect(dialog.locator('.bp6-dialog-header')).toContainText(
                `Science ${annotation.name}`,
            );
            if (annotation.name === 'Text')
                await setInput('Enter text annotation', 'Signal\nROI');
            if (annotation.name === 'Compass') {
                await setInput('Enter north label', 'North');
                await setInput('Enter east label', 'East');
            }

            await dialog.getByTestId('region-dialog-styling-tab-title').click();
            await dialog.locator('.color-swatch-button').click();
            await page.getByTitle('#FFFFFF').click();
            await page.keyboard.press('Escape');
            const expected: Record<string, unknown> = {
                name: `Science ${annotation.name}`,
                color: '#ffffff',
            };
            if (annotation.name === 'Point') {
                await formGroup('Shape').getByRole('button').click();
                await page
                    .locator('.catalog-select')
                    .getByRole('menuitem')
                    .nth(2)
                    .click();
                await setInput('Point size', '18');
                Object.assign(expected, { pointShape: 2, pointWidth: 18 });
            } else if (annotation.name === 'Text') {
                await setInput('Font size', '18');
                await formGroup('Font style')
                    .locator('select')
                    .selectOption({ label: 'Bold' });
                await formGroup('Text alignment')
                    .locator('select')
                    .selectOption({ label: 'Upper left' });
                Object.assign(expected, {
                    textLabel0: 'Signal\nROI',
                    fontSize: 18,
                    fontStyle: 'Bold',
                    textPosition: 1,
                });
            } else {
                await setInput('Line width', '4');
                await setInput('Dash length', '6');
                Object.assign(expected, { lineWidth: 4, dashLength: 6 });
                if (
                    annotation.name === 'Vector' ||
                    annotation.name === 'Compass'
                ) {
                    await setInput('Length', '16');
                    await setInput('Width', '12');
                    Object.assign(expected, {
                        pointerLength: 16,
                        pointerWidth: 12,
                    });
                }
                if (annotation.name === 'Compass') {
                    await formGroup('Show arrowhead')
                        .locator('select')
                        .selectOption('north');
                    await setInput('North label X offset', '-6');
                    await setInput('East label Y offset', '8');
                    Object.assign(expected, {
                        textLabel0: 'North',
                        textLabel1: 'East',
                        isNorthArrow: true,
                        isEastArrow: false,
                        northTextOffset: { x: -6 },
                        eastTextOffset: { y: 8 },
                    });
                }
                if (annotation.name === 'Ruler') {
                    await setInput('Number of decimals', '1');
                    const auxiliaryLines = formGroup(
                        'Show auxiliary lines',
                    ).getByRole('checkbox');
                    const auxiliaryLabels = formGroup(
                        'Show auxiliary labels',
                    ).getByRole('checkbox');
                    await formGroup('Show auxiliary lines')
                        .locator('.bp6-control-indicator')
                        .click();
                    await expect(auxiliaryLabels).toBeDisabled();
                    await formGroup('Show auxiliary lines')
                        .locator('.bp6-control-indicator')
                        .click();
                    await expect(auxiliaryLines).toBeChecked();
                    await formGroup('Show auxiliary labels')
                        .locator('.bp6-control-indicator')
                        .click();
                    await setInput('Text X offset', '8');
                    Object.assign(expected, {
                        decimals: 1,
                        auxiliaryLineVisible: true,
                        auxiliaryTextVisible: true,
                        textOffset: { x: 8 },
                    });
                }
            }
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const r = (window as any).app.activeFrame.regionSet
                            .focusedRegion;
                        return {
                            name: r.nameString,
                            color: r.color,
                            lineWidth: r.lineWidth,
                            dashLength: r.dashLength,
                            decimals: r.decimals,
                            ...r.getAnnotationStyles?.(),
                        };
                    }),
                )
                .toMatchObject(expected);
            await page.getByTestId('region-dialog-header-close-button').click();
            await expect(row).toContainText(`Science ${annotation.name}`);
        }
        await expect
            .poll(() => regionRgbCount(page, [255, 255, 255]))
            .toBeGreaterThan(0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'all-annotations-styled.png',
        );
        await expect(list).toHaveScreenshot('all-annotations-list.png');

        // Exercise the annotation dialog's lock and visibility actions on the ruler.
        const visibleWhitePixels = await regionRgbCount(page, [255, 255, 255]);
        await list.getByTestId('region-list-table-row-11').dblclick();
        await dialog.getByTestId('region-dialog-lock-button').click();
        await expect(
            dialog.getByTestId('region-dialog-delete-button'),
        ).toBeDisabled();
        await dialog.getByTestId('region-dialog-lock-button').click();
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await dialog.getByTestId('region-dialog-visibility-button').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame.regionSet.focusedRegion
                            .opacity,
                ),
            )
            .toBe(0);
        await page.getByTestId('region-dialog-header-close-button').click();
        await expect
            .poll(() => regionRgbCount(page, [255, 255, 255]))
            .toBeLessThan(visibleWhitePixels);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'all-annotations-ruler-hidden.png',
        );

        // Text exclusion has a separate expected-failure regression below.
        await list
            .locator(':scope > div')
            .last()
            .evaluate((element) => {
                element.scrollTop = 0;
            });
        await list.getByTestId('region-list-table-row-1').click();
        const canvasBounds = await canvas.boundingBox();
        await canvas.hover({
            position: {
                x: canvasBounds!.width / 2,
                y: canvasBounds!.height / 2,
            },
        });
        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        for (const annotation of annotationTypes.filter(
            (a) => a.name !== 'Text',
        )) {
            await expect(
                page.getByRole('menuitem', {
                    name: `Science ${annotation.name}`,
                    exact: true,
                }),
            ).toHaveCount(0);
        }
        await page
            .getByRole('menuitem', { name: 'Cursor', exact: true })
            .click();
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await expect(page.locator('.spectral-profiler-dropdown')).toBeHidden();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const samples = (
                        window as any
                    ).app.widgetsStore.spectralProfileWidgets.get(
                        'spectral-profiler-0',
                    )?.plotData?.data?.[0];
                    return (
                        samples?.length === 5 &&
                        samples.every((sample: any) =>
                            Number.isFinite(sample.y),
                        )
                    );
                }),
            )
            .toBe(true);
        await expect(
            page
                .locator(
                    '.spectral-profiler-widget .line-plot-component .annotation-stage canvas',
                )
                .first(),
        ).toHaveScreenshot('all-annotations-cursor-profile.png', {
            maxDiffPixelRatio: 0.02,
        });
    });

    test('Excludes text annotations from spectral profiler region choices', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        await page.getByTestId('annotation-shortcut-dropdown').click();
        await page.getByTestId('annotation-shortcut-dropdown-text').click();
        const canvas = page.locator('.region-stage canvas').first();
        await canvas.dragTo(canvas, {
            sourcePosition: { x: 330, y: 250 },
            targetPosition: { x: 430, y: 350 },
        });
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).app.activeFrame.regionSet.regions.some(
                        (r: any) => r.regionId === 1 && r.regionType === 15,
                    ),
                ),
            )
            .toBe(true);
        await expect
            .poll(() => regionRgbCount(page, [255, 186, 1]))
            .toBeGreaterThan(0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'text-annotation-profiler-exclusion.png',
        );
        await page.locator('#SpectralProfilerButton').click();
        await page.getByTestId('spectral-profiler-region-dropdown').click();
        // RegionStore.isClosedRegion includes ANNTEXT, so the profiler currently offers it.
        test.fail(
            true,
            'Text annotations leak into spectral region choices; the backend only accepts data regions',
        );
        await expect(
            page.getByRole('menuitem', { name: 'Annotation 1', exact: true }),
        ).toHaveCount(0);
    });

    test('Saves and reloads all annotation types through CRTF and DS9 dialogs', async ({
        page,
    }) => {
        test.setTimeout(90_000);
        page.setDefaultTimeout(10_000);
        const carta = new PlaywrightDevPage(page);
        const formats = [
            { type: 'CRTF', extension: 'crtf' },
            { type: 'DS9', extension: 'reg' },
        ];
        const files = formats.map((format) => ({
            ...format,
            name: `annotations-roundtrip-e2e.${format.extension}`,
            path: path.resolve(
                __dirname,
                `../test_data/annotations-roundtrip-e2e.${format.extension}`,
            ),
        }));
        try {
            for (const file of files) rmSync(file.path, { force: true });
            await carta.goto();
            await carta.loadImage('cube.fits');
            await createAnnotations(page);
            await page.getByTestId('point-region-shortcut-button').click();
            await page
                .locator('.region-stage canvas')
                .first()
                .click({ position: { x: 100, y: 100 } });
            const browser = page.getByTestId('file-browser-dialog');
            const directory = browser.getByPlaceholder(
                'Input directory path with respect to the top level folder',
            );
            for (const file of files) {
                await carta.selectMenuItem('File', 'Export Regions');
                await browser.locator('.edit-path-button').click();
                await directory.fill(fixtureBrowserPath);
                await directory.press('Enter');
                await browser
                    .getByTestId('export-region-file-type-dropdown')
                    .click();
                await page
                    .getByRole('menuitem', { name: `${file.type} region file` })
                    .click();
                const selectAnnotations = browser.getByRole('checkbox', {
                    name: 'Select all annotations',
                    exact: true,
                });
                await browser
                    .getByPlaceholder('Enter file name')
                    .fill(file.name);
                const exportButton = browser.getByRole('button', {
                    name: 'Export regions',
                    exact: true,
                });
                await expect(exportButton).toBeEnabled();
                await browser.getByText('Select all', { exact: true }).click();
                await expect(exportButton).toBeDisabled();
                await browser
                    .getByText('Select all annotations', { exact: true })
                    .click();
                await expect(selectAnnotations).toBeChecked();
                await expect(
                    browser.getByText('Selected 10 / 11 elements.', {
                        exact: true,
                    }),
                ).toBeVisible();
                await exportButton.click();
                await expect(browser).toBeHidden();
                await expect.poll(() => existsSync(file.path)).toBe(true);
            }
            await page.getByTestId('region-list-0-header-title').click();
            const deleteAll = async () => {
                await page
                    .locator('.region-list-widget .float .bp6-button')
                    .first()
                    .click();
                await expect(
                    page.getByText(
                        'Are you sure you want to delete all regions?',
                    ),
                ).toBeVisible();
                await page.keyboard.press('Enter');
                await expect
                    .poll(() =>
                        page.evaluate(
                            () =>
                                (window as any).app.activeFrame.regionSet
                                    .regions.length,
                        ),
                    )
                    .toBe(1);
            };
            await deleteAll();
            for (const file of files) {
                await carta.selectMenuItem('File', 'Import Regions');
                await browser.locator('.edit-path-button').click();
                await directory.fill(fixtureBrowserPath);
                await directory.press('Enter');
                await browser.getByText(file.name, { exact: true }).click();
                await browser
                    .getByRole('button', { name: 'Load region', exact: true })
                    .click();
                await expect(browser).toBeHidden();
                await expect
                    .poll(() =>
                        page.evaluate(() =>
                            (window as any).app.activeFrame.regionSet.regions
                                .filter((r: any) => r.regionId > 0)
                                .map((r: any) => r.regionType)
                                .sort((a: number, b: number) => a - b),
                        ),
                    )
                    .toEqual(
                        annotationTypes
                            .map((a) => a.type)
                            .sort((a, b) => a - b),
                    );
                await expect
                    .poll(() => regionRgbCount(page, [255, 186, 1]))
                    .toBeGreaterThan(0);
                await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
                    `all-annotations-${file.type.toLowerCase()}-imported.png`,
                );
                await deleteAll();
            }
        } finally {
            for (const file of files) rmSync(file.path, { force: true });
        }
    });

    test('Applies shared style and color only to selected regions', async ({
        page,
    }) => {
        test.setTimeout(60_000);
        page.setDefaultTimeout(10_000);
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        const canvas = page.locator('.region-stage canvas').first();
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        for (const [index, type] of [
            'rectangle',
            'ellipse',
            'rectangle',
        ].entries()) {
            const x = box!.width * (0.3 + index * 0.22);
            await page.getByTestId(`${type}-region-shortcut-button`).click();
            await canvas.dragTo(canvas, {
                sourcePosition: { x: x - 40, y: box!.height * 0.35 },
                targetPosition: { x: x + 40, y: box!.height * 0.5 },
            });
        }
        await page.getByTestId('annotation-shortcut-dropdown').click();
        await page.getByTestId('annotation-shortcut-dropdown-point').click();
        await canvas.click({
            position: { x: box!.width * 0.5, y: box!.height * 0.7 },
        });
        const state = () =>
            page.evaluate(() =>
                (window as any).app.activeFrame.regionSet.regions
                    .filter((r: any) => r.regionId > 0)
                    .map((r: any) => ({
                        id: r.regionId,
                        color: r.color,
                        lineWidth: r.lineWidth,
                        dashLength: r.dashLength,
                        controlPoints: r.controlPoints.map((point: any) => ({
                            x: point.x,
                            y: point.y,
                        })),
                        rotation: r.rotation,
                    })),
            );
        await expect
            .poll(async () => (await state()).map((r) => r.id))
            .toEqual([1, 2, 3, 4]);
        const original = await state();
        await page.getByTestId('region-list-0-header-title').click();
        const list = page.getByTestId('region-list-table');
        const row = (id: number) =>
            list.getByTestId(`region-list-table-row-${id + 1}`);
        const dialog = page.locator('.region-dialog');
        const openGroup = async (count: number) => {
            await list.press('Enter');
            await expect(dialog.locator('.bp6-dialog-header')).toContainText(
                `Editing ${count} Regions`,
            );
            await expect(
                dialog.getByTestId('region-dialog-config-tab-title'),
            ).toHaveCount(0);
        };
        const setColor = async (hex: string) => {
            await dialog.locator('.color-swatch-button').click();
            await page.getByTitle(hex).click();
            await page.keyboard.press('Escape');
        };
        const setStyle = async (width: string, dash: string) => {
            for (const [placeholder, value] of [
                ['Line width', width],
                ['Dash length', dash],
            ]) {
                const input = dialog.getByPlaceholder(placeholder, {
                    exact: true,
                });
                await input.fill(value);
                await input.press('Tab');
            }
        };

        await row(1).click();
        await row(2).click({ modifiers: ['ControlOrMeta'] });
        for (const id of [1, 2])
            await expect(row(id)).toHaveClass(/selected|active/);
        for (const id of [3, 4])
            await expect(row(id)).not.toHaveClass(/selected|active/);
        await openGroup(2);
        await setColor('#FFFFFF');
        await setStyle('5', '8');
        await expect.poll(state).toEqual(
            original.map((r) =>
                r.id <= 2
                    ? {
                          ...r,
                          color: '#ffffff',
                          lineWidth: 5,
                          dashLength: 8,
                      }
                    : r,
            ),
        );
        await page.getByTestId('region-dialog-header-close-button').click();
        await expect
            .poll(() => regionRgbCount(page, [255, 255, 255]))
            .toBeGreaterThan(0);
        await expect
            .poll(() => regionRgbCount(page, [46, 230, 214]))
            .toBeGreaterThan(0);
        await expect
            .poll(() => regionRgbCount(page, [255, 186, 1]))
            .toBeGreaterThan(0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'multi-region-selected-style.png',
        );
        await expect(list).toHaveScreenshot('multi-region-selected-list.png');

        // Reset the range anchor through normal clicks, then select three rows with Shift.
        await row(3).click();
        await row(1).click();
        await row(3).click({ modifiers: ['Shift'] });
        for (const id of [1, 2, 3])
            await expect(row(id)).toHaveClass(/selected|active/);
        await expect(row(4)).not.toHaveClass(/selected|active/);
        await openGroup(3);
        await setColor('#111418');
        await setStyle('3', '2');
        await expect.poll(state).toEqual(
            original.map((r) =>
                r.id <= 3
                    ? {
                          ...r,
                          color: '#111418',
                          lineWidth: 3,
                          dashLength: 2,
                      }
                    : r,
            ),
        );
        await page.getByTestId('region-dialog-header-close-button').click();
        await expect
            .poll(() => regionRgbCount(page, [17, 20, 24]))
            .toBeGreaterThan(0);
        await expect
            .poll(() => regionRgbCount(page, [255, 186, 1]))
            .toBeGreaterThan(0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'multi-region-range-style.png',
        );

        // A mixed selection exposes only controls shared by regions and point annotations.
        await row(4).click({ modifiers: ['ControlOrMeta'] });
        await openGroup(4);
        await expect(
            dialog.getByPlaceholder('Line width', { exact: true }),
        ).toHaveCount(0);
        await expect(
            dialog.getByPlaceholder('Dash length', { exact: true }),
        ).toHaveCount(0);
        await setColor('#FFFFFF');
        await expect.poll(state).toEqual(
            original.map((r) =>
                r.id <= 3
                    ? {
                          ...r,
                          color: '#ffffff',
                          lineWidth: 3,
                          dashLength: 2,
                      }
                    : { ...r, color: '#ffffff' },
            ),
        );
        await page.getByTestId('region-dialog-header-close-button').click();
        await expect.poll(() => regionRgbCount(page, [255, 186, 1])).toBe(0);
        await expect
            .poll(() => regionRgbCount(page, [255, 255, 255]))
            .toBeGreaterThan(0);
        await expect(page.getByTestId('viewer-div')).toHaveScreenshot(
            'multi-region-mixed-color.png',
        );

        await row(1).click();
        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByRole('menuitem', { name: 'Region 1', exact: true })
            .click();
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await expect(page.locator('.spectral-profiler-dropdown')).toBeHidden();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const values = (
                        window as any
                    ).app.widgetsStore.spectralProfileWidgets.get(
                        'spectral-profiler-0',
                    )?.plotData?.data?.[0];
                    return (
                        values?.length === 5 &&
                        values.every((point: any) => Number.isFinite(point.y))
                    );
                }),
            )
            .toBe(true);
        await expect(
            page
                .locator('.spectral-profiler-widget .annotation-stage canvas')
                .first(),
        ).toHaveScreenshot('multi-region-profile.png', {
            maxDiffPixelRatio: 0.02,
        });
    });
});

const annotationTypes = [
    { name: 'Point', type: 7 },
    { name: 'Line', type: 8 },
    { name: 'Rectangle', type: 10 },
    { name: 'Ellipse', type: 11 },
    { name: 'Polygon', type: 12 },
    { name: 'Polyline', type: 9 },
    { name: 'Vector', type: 13 },
    { name: 'Text', type: 15 },
    { name: 'Compass', type: 16 },
    { name: 'Ruler', type: 14 },
];

async function createAnnotations(page: Page) {
    const canvas = page.locator('.region-stage canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    for (const [index, annotation] of annotationTypes.entries()) {
        await page.getByTestId('annotation-shortcut-dropdown').click();
        if (index === 0)
            await expect(
                page.locator('[data-testid^="annotation-shortcut-dropdown-"]'),
            ).toHaveCount(annotationTypes.length);
        await page
            .getByTestId(
                `annotation-shortcut-dropdown-${annotation.name.toLowerCase()}`,
            )
            .click();
        const x = box!.width * (0.12 + (index % 5) * 0.18);
        const y = box!.height * (index < 5 ? 0.3 : 0.65);
        if (annotation.name === 'Point' || annotation.name === 'Compass') {
            await canvas.click({ position: { x, y } });
        } else if (
            annotation.name === 'Polygon' ||
            annotation.name === 'Polyline'
        ) {
            const vertices = [
                { x: x - 40, y: y - 30 },
                { x: x + 40, y: y - 30 },
                { x, y: y + 30 },
            ];
            for (const position of vertices) await canvas.click({ position });
            await canvas.dblclick({ position: vertices[2] });
        } else {
            await canvas.dragTo(canvas, {
                sourcePosition: { x: x - 45, y: y - 30 },
                targetPosition: { x: x + 45, y: y + 30 },
            });
        }
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).app.activeFrame.regionSet.regions
                        .filter((r: any) => r.isAnnotation && !r.isTemporary)
                        .map((r: any) => r.regionType),
                ),
            )
            .toEqual(annotationTypes.slice(0, index + 1).map((a) => a.type));
    }
}
