import { readFile } from 'node:fs/promises';
import { test as base, expect, type Locator } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const test = base.extend<{
    carta: PlaywrightDevPage;
    viewerCanvas: Locator;
}>({
    carta: async ({ page }, use) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await use(carta);
    },
    viewerCanvas: async ({ page }, use) => {
        await use(page.getByTestId('viewer-div'));
    },
});

test.describe('Image viewer control coverage', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.setTimeout(90_000);
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10_000));

    test('toolbar toggle and all export resolutions', async ({
        page,
        carta,
        viewerCanvas,
    }, testInfo) => {
        await carta.loadImage('cube.fits');
        await viewerCanvas.hover();

        const toggle = page.getByTestId('toggle-toolbar-button');
        const zoom = page.getByTestId('zoom-in-button');
        await expect(zoom).toBeVisible();
        await toggle.click();
        await expect(zoom).toHaveCount(0);
        await toggle.click();
        await expect(zoom).toBeVisible();

        const sizes: Array<[number, number]> = [];
        for (const [index, label] of [
            'Normal (100%)',
            'High (200%)',
            'Highest (400%)',
        ].entries()) {
            await page.getByTestId('export-image-view-button').click();
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('menuitem', { name: label }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(
                /^cube\.fits-image-.*\.png$/,
            );
            const savedPath = testInfo.outputPath(`export-${index}.png`);
            await download.saveAs(savedPath);
            const png = await readFile(savedPath);
            expect(png.subarray(0, 8)).toEqual(
                Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            );
            sizes.push([png.readUInt32BE(16), png.readUInt32BE(20)]);
        }
        expect(sizes[0][0]).toBeGreaterThan(0);
        expect(sizes[0][1]).toBeGreaterThan(0);
        for (const [index, ratio] of [
            [1, 2],
            [2, 4],
        ]) {
            for (const dimension of [0, 1]) {
                expect(
                    Math.abs(
                        sizes[index][dimension] - sizes[0][dimension] * ratio,
                    ),
                ).toBeLessThanOrEqual(ratio);
            }
        }
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'image-viewer-export-raster.png',
        );
    });

    test('viewer matching controls spatial and spectral alignment', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.setPreferenceDefaults();
        await carta.loadImage('cube.fits');
        await carta.loadImage('matching-cube.fits', true);

        const panel = page.locator('#image-panel-1-0');
        await panel
            .locator('.region-stage canvas')
            .first()
            .click({ position: { x: 100, y: 100 } });
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.activeFrame?.filename),
            )
            .toBe('matching-cube.fits');
        const state = () =>
            page.evaluate(() => {
                const frame = (window as any).app.frames[1];
                return {
                    spatial: frame.spatialReference?.filename ?? null,
                    spectral: frame.spectralReference?.filename ?? null,
                };
            });
        const choose = async (name: string) => {
            await panel.getByTestId('match-button').click();
            await page.getByRole('menuitem', { name, exact: true }).click();
        };

        await choose('None');
        await expect.poll(state).toEqual({ spatial: null, spectral: null });
        await choose('Spatial only');
        await expect
            .poll(state)
            .toEqual({ spatial: 'cube.fits', spectral: null });
        await choose('Spectral (VRAD) only');
        await expect
            .poll(state)
            .toEqual({ spatial: null, spectral: 'cube.fits' });
        await choose('Spectral (VRAD) and spatial');
        await expect
            .poll(state)
            .toEqual({ spatial: 'cube.fits', spectral: 'cube.fits' });
        await expect(viewerCanvas.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewerCanvas).toHaveScreenshot('image-viewer-matched.png');
        await choose('None');
        await expect.poll(state).toEqual({ spatial: null, spectral: null });
    });

    test('header paging, help, maximize, restore, and popout', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.setPreferenceDefaults();
        await carta.loadImage('cube.fits');
        await carta.loadImage('matching-cube.fits', true);

        await page
            .getByTestId('image-view-header-multipanel-view-switch')
            .click();
        await page
            .getByTestId('image-view-header-previous-page-button')
            .click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'cube.fits',
        );
        await page.getByTestId('image-view-header-next-page-button').click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'matching-cube.fits',
        );
        await page
            .getByTestId('image-view-header-previous-page-button')
            .click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'cube.fits',
        );

        const help = page.getByTestId('image-view-header-help-button');
        await help.click();
        await expect(page.locator('.help-drawer')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.help-drawer')).toBeHidden();

        const maximize = page.getByTestId('image-view-header-maximize-button');
        await maximize.click();
        await expect(page.locator('.flexlayout__tabset-maximized')).toHaveCount(
            1,
        );
        await expect(viewerCanvas.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewerCanvas).toHaveScreenshot(
            'image-viewer-maximized.png',
        );
        await maximize.click();
        await expect(page.locator('.flexlayout__tabset-maximized')).toHaveCount(
            0,
        );
        await expect(viewerCanvas).toBeVisible();

        const popupPromise = page.waitForEvent('popup');
        await page.getByTestId('image-view-header-popout-button').click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        await expect(popup.getByTestId('viewer-div')).toBeVisible();
        await popup.close();
    });

    test('ruler creation renders a measured region', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('M17_SWex.fits');
        await viewerCanvas.hover();
        const before = await page.evaluate(
            () => (window as any).app.activeFrame.regionSet.regions.length,
        );
        await page.getByTestId('toolbar-distance-measuring-button').click();
        const canvas = page.locator('.region-stage canvas').first();
        await canvas.dragTo(canvas, {
            sourcePosition: { x: 150, y: 150 },
            targetPosition: { x: 300, y: 250 },
        });
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.activeFrame.regionSet.regions
                            .length,
                ),
            )
            .toBe(before + 1);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const region = (
                        window as any
                    ).app.activeFrame.regionSet.regions.at(-1);
                    return (
                        region && {
                            type: region.regionType,
                            width: region.size.x,
                            height: region.size.y,
                        }
                    );
                }),
            )
            .toMatchObject({
                type: 14,
                width: expect.any(Number),
                height: expect.any(Number),
            });
        await page.mouse.move(0, 0);
        await expect(viewerCanvas.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewerCanvas).toHaveScreenshot('image-viewer-ruler.png');
    });

    test('raster RGB and invalid beam width', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        await carta.loadImage('cube.fits');
        const rgb = () =>
            page
                .locator('#raster-canvas')
                .first()
                .evaluate((source: HTMLCanvasElement) => {
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
        const initial = await rgb();
        for (const [channel, min, max] of [
            [0, 235, 250],
            [1, 210, 235],
            [2, 65, 105],
        ]) {
            expect(initial[channel]).toBeGreaterThanOrEqual(min);
            expect(initial[channel]).toBeLessThanOrEqual(max);
        }
        expect(initial[3]).toBe(255);

        await carta.selectMenuItem('Widgets', 'Render Configuration Widget');
        await page.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'gray', exact: true }).click();
        await expect
            .poll(async () => {
                const [red, green, blue, alpha] = await rgb();
                return { isGray: red === green && green === blue, alpha };
            })
            .toEqual({ isGray: true, alpha: 255 });
        await carta.closeWidget('render-config');
        await page.mouse.move(0, 0);
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'image-viewer-gray-raster.png',
        );

        await carta.loadImage('M17_SWex.fits');
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Beam' }).click();
        const width = page.getByRole('spinbutton', { name: 'Width' });
        const beamWidth = () =>
            page.evaluate(
                () =>
                    (window as any).app.overlaySettings.beam.settingsForDisplay
                        .width,
            );
        const original = await beamWidth();
        await width.fill('20');
        await width.press('Tab');
        await expect.poll(beamWidth).toBe(original);
        await width.fill('2');
        await width.press('Tab');
        await expect.poll(beamWidth).toBe(2);
        await carta.closeWidget('image-view-floating-settings');
        await page.mouse.move(0, 0);
        await expect(viewerCanvas.locator('.image-ratio-popup')).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewerCanvas).toHaveScreenshot(
            'image-viewer-beam-width.png',
        );
    });
});

test.describe('Image viewer E2E set', () => {
    test('Image Viewer', async ({ page, carta, viewerCanvas }) => {
        await page.evaluate(() => {
            const app = (window as any).app;
            app.preferenceStore.setPreference('imagePanelMode', 'fixed');
            app.preferenceStore.setPreference('imagePanelColumns', 1);
            app.preferenceStore.setPreference('imagePanelRows', 1);
            app.widgetsStore.setImageMultiPanelEnabled(true);
        });
        // Load test data cube
        await carta.loadImage('M17_SWex.fits');
        await page.evaluate(() => {
            const app = (window as any).app;
            app.preferenceStore.setPreference('imagePanelMode', 'fixed');
            app.preferenceStore.setPreference('imagePanelColumns', 1);
            app.preferenceStore.setPreference('imagePanelRows', 1);
            app.widgetsStore.setImageMultiPanelEnabled(true);
        });
        await expect(viewerCanvas).toBeVisible();

        await viewerCanvas.hover();
        await expect(
            page.getByTestId('toolbar-distance-measuring-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('toolbar-catalog-selection-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('toolbar-region-moving-button'),
        ).toBeVisible();
        await expect(page.getByTestId('zoom-in-button')).toBeVisible();
        await expect(page.getByTestId('zoom-out-button')).toBeVisible();
        await expect(page.getByTestId('zoom-to-1x-fit-button')).toBeVisible();
        await expect(page.getByTestId('zoom-to-fit-button')).toBeVisible();
        await expect(page.getByTestId('match-button')).toBeVisible();
        await expect(
            page.getByTestId('overlay-coordinate-button'),
        ).toBeVisible();
        await expect(page.getByTestId('grid-button')).toBeVisible();
        await expect(page.getByTestId('toggle-labels-button')).toBeVisible();
        await expect(
            page.getByTestId('export-image-view-button'),
        ).toBeVisible();
        await expect(page.getByTestId('toggle-toolbar-button')).toBeVisible();

        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'M17_SWex.fits',
        );

        await expect(page.locator('.flexlayout__tab_toolbar').first())
            .toMatchAriaSnapshot(`
          - button ""
          - button "" [disabled]
          - button /[]/
          - button "" [disabled]
          - button ""
          - button ""
          - button "Pop out to a new window":
            - img
          - button "Maximise":
            - img
        `);

        await expect(
            page.getByTestId('image-view-header-channel-map-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-multipanel-view-switch'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-settings-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-help-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-popout-button'),
        ).toBeVisible();
        await expect(
            page.getByTestId('image-view-header-maximize-button'),
        ).toBeVisible();
        const panelSwitch = page.getByTestId(
            'image-view-header-multipanel-view-switch',
        );
        await expect(panelSwitch).toHaveAttribute(
            'title',
            'Switch to single panel',
        );
        await carta.screenShot(
            panelSwitch,
            'M17_SWex_viewer_multipanel_view_switch.png',
        );

        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);

        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        await expect(panelSwitch).toHaveAttribute(
            'title',
            'Switch to single panel',
        );
        await panelSwitch.click();
        await expect(panelSwitch).toHaveAttribute(
            'title',
            'Switch to multi-panel',
        );
        await carta.screenShot(
            panelSwitch,
            'M17_SWex_viewer_singlepanel_view_switch_button.png',
        );
        await expect(page.locator('.flexlayout__tab_toolbar').first())
            .toMatchAriaSnapshot(`
          - button ""
          - button ""
          - button /[]/
          - button "" [disabled]
          - button ""
          - button ""
          - button "Pop out to a new window":
            - img
          - button "Maximise":
            - img
        `);

        await carta.screenShot(
            viewerCanvas,
            'HD163296_13CO_2-1_subimage_viewer.png',
        );
        await expect(
            page.getByTestId('image-view-header-next-page-button'),
        ).toBeDisabled();
        await expect(
            page.getByTestId('image-view-header-previous-page-button'),
        ).toBeEnabled();
        await page
            .getByTestId('image-view-header-previous-page-button')
            .click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'M17_SWex.fits',
        );
        await carta.screenShot(viewerCanvas, 'M17_SWex_viewer.png');
        await page.getByTestId('image-view-header-next-page-button').click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        await page.evaluate(() => {
            (window as any).app.preferenceStore.setPreference(
                'imagePanelColumns',
                2,
            );
        });
        await page
            .getByTestId('image-view-header-multipanel-view-switch')
            .click();
        await carta.screenShot(
            page
                .locator('div')
                .filter({ hasText: /^HD163296_13CO_2-1_subimage\.fits$/ })
                .nth(1),
            'M17_SWex_viewer_multipanel.png',
        );

        await page.getByTestId('image-view-header-maximize-button').click();
        await expect(page).toHaveScreenshot(
            'M17_SWex_viewer_multipanel_maximized.png',
            { fullPage: true },
        );
        await carta.screenShot(
            page.getByTestId('image-view-header-maximize-button'),
            'M17_SWex_viewer_maximized_button.png',
        );
        await page.getByTestId('image-view-header-channel-map-button').click();

        await carta.screenShot(
            page.locator('#overlay-canvas').nth(1),
            'M17_SWex_viewer_channel_map.png',
        );
    });

    test('Image Viewer Toolbar', async ({ page, carta, viewerCanvas }) => {
        await carta.setMultiPanelLayout(1, 2);
        // Load test data cube
        await carta.loadImage('M17_SWex.fits');

        await viewerCanvas.hover();

        await page.getByTestId('toolbar-distance-measuring-button').click();
        await viewerCanvas.dragTo(viewerCanvas, {
            sourcePosition: { x: 50, y: 50 },
            targetPosition: { x: 200, y: 150 },
        });

        await page.getByTestId('toolbar-region-creating-button').click();
        await page
            .locator('.bp6-popover-target.bp6-popover-open > .bp6-button')
            .click();
        await expect(
            page.getByText(
                'PointLineRectangleEllipsePolygonPolylineAnnotationsOpen sub menu',
            ),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Point"
            - menuitem "Line"
            - menuitem "Rectangle"
            - menuitem "Ellipse"
            - menuitem "Polygon"
            - menuitem "Polyline"
            - separator
            - menuitem "Annotations Open sub menu":
              - text: ""
              - img "Open sub menu"
        `);
        await page.getByRole('menuitem', { name: 'Ellipse' }).click();
        await viewerCanvas.dragTo(viewerCanvas, {
            sourcePosition: { x: 250, y: 200 },
            targetPosition: { x: 400, y: 300 },
        });
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_region_creating_ellipse.png',
        );
        await carta.screenShot(
            page.getByTestId('toolbar-region-creating-button'),
            'M17_SWex_viewer_toolbar_region_creating_button.png',
        );

        // no need to click moving button, as it is automatically selected after creating a region
        await viewerCanvas.dragTo(viewerCanvas, {
            sourcePosition: { x: 500, y: 300 },
            targetPosition: { x: 200, y: 200 },
        });
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_moving.png',
        );

        await page.getByTestId('zoom-to-fit-button').click();
        await page.getByTestId('zoom-in-button').click();
        await page.getByTestId('zoom-in-button').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_in.png',
        );
        await page.getByTestId('zoom-out-button').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_out.png',
        );
        await page.getByTestId('zoom-to-1x-fit-button').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_1x.png',
        );
        await page.getByTestId('zoom-to-fit-button').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_zoom_fit.png',
        );
        await page.getByTestId('grid-button').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_grid_on.png',
        );
        await page.getByTestId('toggle-labels-button').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_label_off.png',
        );

        await page.getByTestId('overlay-coordinate-button').click();
        await expect(page.getByText('WCSFK5FK4GALECLICRSIMGOffset'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "WCS"
            - menuitem "FK5"
            - menuitem "FK4"
            - menuitem "GAL"
            - menuitem "ECL"
            - menuitem "ICRS"
            - menuitem "IMG"
            - checkbox "Offset"
            - text: Offset
        `);
        await page.getByRole('menuitem', { name: 'GAL' }).click();
        await page.getByTestId('toggle-labels-button').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_toolbar_coordinate_galactic.png',
        );

        await page.getByTestId('match-button').click();
        await expect(
            page.getByText(
                'Spectral (VRAD) and spatialSpectral (VRAD) onlySpatial onlyNone',
            ),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Spectral (VRAD) and spatial" [disabled]
            - menuitem "Spectral (VRAD) only" [disabled]
            - menuitem "Spatial only" [disabled]
            - menuitem "None" [disabled]
        `);

        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);
        await page
            .locator(
                'div:nth-child(9) > .region-stage > .konvajs-content > canvas',
            )
            .click({
                position: {
                    x: 217,
                    y: 122,
                },
            });

        await page
            .locator('#image-panel-1-0')
            .getByTestId('match-button')
            .click();
        await expect(
            page.getByText(
                'Spectral (VRAD) and spatialSpectral (VRAD) onlySpatial onlyNone',
            ),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Spectral (VRAD) and spatial"
            - menuitem "Spectral (VRAD) only"
            - menuitem "Spatial only"
            - menuitem "None"
        `);
    });

    test('Image Viewer Settings - Pan and Zoom', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const useSingleImagePanel = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                app.preferenceStore.setPreference('imagePanelMode', 'fixed');
                app.preferenceStore.setPreference('imagePanelColumns', 1);
                app.preferenceStore.setPreference('imagePanelRows', 1);
                app.widgetsStore.setImageMultiPanelEnabled(true);
            });
        await useSingleImagePanel();

        // Load test data cube
        await carta.loadImage('M17_SWex.fits');
        await useSingleImagePanel();

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();

        await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
          - tablist:
            - tab "Pan and Zoom" [expanded] [selected]
            - tab "Global"
            - tab "Title"
            - tab "Ticks"
            - tab "Grids"
            - tab "Border"
            - tab "Axes"
            - tab "Numbers"
            - tab "Labels"
            - tab "Colorbar"
            - tab "Beam"
            - tab "Conversion" [disabled]
        `);

        await expect(
            page.getByRole('textbox', { name: 'X WCS coordinate' }),
        ).toHaveValue(/^\d+:\d+:\d+\.\d+$/);
        await expect(
            page.getByRole('textbox', { name: 'Y WCS coordinate' }),
        ).toHaveValue(/^-\d+:\d+:\d+\.\d+$/);
        await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await expect(page.getByRole('textbox', { name: 'Height' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await page
            .getByRole('radiogroup')
            .getByText('Image', { exact: true })
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'X Coordinate' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await expect(
            page.getByRole('spinbutton', { name: 'Y Coordinate' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await expect(
            page.getByRole('spinbutton', { name: 'Width' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await expect(
            page.getByRole('spinbutton', { name: 'Height' }),
        ).toHaveValue(/^\d+(?:\.\d+)?$/);
        await page
            .locator(
                '[id="bp6-tab-panel_imageViewSettingsTabs_Pan and Zoom"] select',
            )
            .selectOption('ECLIPTIC');
        await page
            .locator('label:nth-child(2) > .bp6-control-indicator')
            .click();
        await expect(
            page.getByRole('textbox', { name: 'X WCS coordinate' }),
        ).toHaveValue(/^\d+\.\d+$/);
        await expect(
            page.getByRole('textbox', { name: 'Y WCS coordinate' }),
        ).toHaveValue(/^[-\d]+\.\d+$/);
        await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await expect(page.getByRole('textbox', { name: 'Height' })).toHaveValue(
            /^\d+\.\d+["']$/,
        );
        await page
            .locator(
                '[id="bp6-tab-panel_imageViewSettingsTabs_Pan and Zoom"] select',
            )
            .selectOption('CARTESIAN');
        await expect(
            page.getByRole('textbox', { name: 'X WCS coordinate' }),
        ).toBeEmpty();
        await expect(page.getByRole('textbox', { name: 'Width' })).toBeEmpty();

        await page
            .locator(
                '.panel-pan-and-zoom > div:nth-child(6) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '[id="bp6-tab-panel_imageViewSettingsTabs_Pan and Zoom"] select',
            )
            .selectOption('GALACTIC');
        const xCoordinates = page.getByRole('textbox', {
            name: 'X WCS coordinate',
        });
        const yCoordinates = page.getByRole('textbox', {
            name: 'Y WCS coordinate',
        });
        const centerX = xCoordinates.first();
        const centerY = yCoordinates.first();
        const offsetX = xCoordinates.nth(1);
        const offsetY = yCoordinates.nth(1);
        await expect(centerX).toHaveValue(/^\d+\.\d+$/);
        await expect(centerY).toHaveValue(/^[-\d]+\.\d+$/);
        await offsetX.fill('10');
        await offsetX.press('Tab');
        await expect
            .poll(async () => Number(await offsetX.inputValue()))
            .toBeCloseTo(10, 6);
        await offsetY.fill('10');
        await offsetY.press('Tab');
        await expect
            .poll(async () => Number(await offsetX.inputValue()))
            .toBeCloseTo(10, 6);
        await expect
            .poll(async () => Number(await offsetY.inputValue()))
            .toBeCloseTo(10, 6);
        await carta.closeWidget('image-view-floating-settings');
        await expect(page.locator('.image-view-settings')).toBeHidden();
        await expect(viewerCanvas).toHaveScreenshot(
            'M17_SWex_viewer_settings_offset_galactic.png',
            { maxDiffPixelRatio: 0.02 },
        );

        await page.getByTestId('image-view-header-settings-button').click();
        await expect(page.locator('.image-view-settings')).toBeVisible();
        await page
            .locator('.bp6-collapse-body > .bp6-popover-target > .bp6-button')
            .click();
        await expect(offsetX).toHaveValue(await centerX.inputValue());
        await expect(offsetY).toHaveValue(await centerY.inputValue());
        await carta.closeWidget('image-view-floating-settings');
        await expect(page.locator('.image-view-settings')).toBeHidden();
        await expect(viewerCanvas).toHaveScreenshot(
            'M17_SWex_viewer_settings_de_offset_galactic.png',
            { maxDiffPixelRatio: 0.02 },
        );
    });

    test('Image Viewer Settings - Global', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        // set to default multi-panel layout
        await carta.setPreferenceDefaults();

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();

        await page.getByRole('tab', { name: 'Global' }).click();
        await expect(page.getByLabel('Global')).toMatchAriaSnapshot(`
          - tabpanel "Global":
            - text: Enable multi-panel
            - checkbox [checked]
            - text: Multi-panel mode
            - combobox:
              - option "Dynamic grid size" [selected]
              - option "Fixed grid size"
            - img "Open dropdown"
            - text: Columns (Maximum)
            - group:
              - spinbutton "Columns"
              - button "increment"
              - button "decrement"
            - text: Rows (Maximum)
            - group:
              - spinbutton "Rows"
              - button "increment"
              - button "decrement"
            - text: Overlay color
            - combobox:
              - button
            - text: Tolerance (%)
            - group:
              - spinbutton "Tolerance"
              - button "increment"
              - button "decrement"
            - text: Labelling
            - combobox:
              - option "Interior"
              - option "Exterior" [selected]
            - img "Open dropdown"
            - text: Coordinate system
            - combobox:
              - option "Auto" [selected]
              - option "Ecliptic"
              - option "FK4"
              - option "FK5"
              - option "Galactic"
              - option "ICRS"
              - option "Image"
            - img "Open dropdown"
          `);

        await page
            .locator(
                '.panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await expect(page.getByLabel('Global')).toMatchAriaSnapshot(`
            - tabpanel "Global":
              - text: Enable multi-panel
              - checkbox
              - text: Multi-panel mode
              - combobox [disabled]:
                - option "Dynamic grid size" [selected]
                - option "Fixed grid size"
              - img "Open dropdown"
              - text: Columns (Maximum)
              - group:
                - spinbutton "Columns" [disabled]
                - button "increment" [disabled]
                - button "decrement" [disabled]
              - text: Rows (Maximum)
              - group:
                - spinbutton "Rows" [disabled]
                - button "increment" [disabled]
                - button "decrement" [disabled]
              - text: Overlay color
              - combobox:
                - button
              - text: Tolerance (%)
              - group:
                - spinbutton "Tolerance"
                - button "increment"
                - button "decrement"
              - text: Labelling
              - combobox:
                - option "Interior"
                - option "Exterior" [selected]
              - img "Open dropdown"
              - text: Coordinate system
              - combobox:
                - option "Auto" [selected]
                - option "Ecliptic"
                - option "FK4"
                - option "FK5"
                - option "Galactic"
                - option "ICRS"
                - option "Image"
              - img "Open dropdown"
            `);

        await carta.screenShot(
            page.getByTestId('image-view-header-multipanel-view-switch'),
            'M17_SWex_viewer_settings_multi_panel_button.png',
        );

        await page
            .locator(
                '.panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await page.locator('select').nth(5).selectOption('fixed');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_2x2.png',
        );

        await page
            .getByLabel('Global')
            .getByRole('button', { name: 'increment' })
            .first()
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'Columns' }),
        ).toHaveValue('3');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_2x3.png',
        );
        await page
            .getByLabel('Global')
            .getByRole('button', { name: 'decrement' })
            .nth(1)
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'Rows' }),
        ).toHaveValue('1');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_1x3.png',
        );

        await page.locator('.bp6-button.colorselect').first().click();
        await page.locator('li:nth-child(4) > .bp6-menu-item').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_1x3_color.png',
        );

        await page
            .locator(
                'div:nth-child(7) > .bp6-form-content > .bp6-html-select > select',
            )
            .selectOption('Interior');
        await page.locator('select').nth(5).selectOption('dynamic');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_interior_label.png',
        );

        await page
            .locator(
                'div:nth-child(8) > .bp6-form-content > .bp6-html-select > select',
            )
            .selectOption('ECLIPTIC');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_coord_ecliptic.png',
        );
    });

    test('Image Viewer Settings - Title and ticks', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        // set to default multi-panel layout
        await carta.setPreferenceDefaults();

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();

        await page.getByRole('tab', { name: 'Title' }).click();
        await expect(page.getByLabel('Title')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox
          - text: Font
          - combobox [disabled]:
            - button "bold sans-serif" [disabled]
          - group:
            - spinbutton "Font size" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Custom text
          - checkbox [disabled]
          - text: Custom color
          - checkbox [disabled]
          `);

        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Title > .scroll-shadow > .scroll-shadow-cover > .panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await expect(page.getByLabel('Title')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Font
          - combobox:
            - button "bold sans-serif"
          - group:
            - spinbutton "Font size"
            - button "increment"
            - button "decrement"
          - text: Custom text
          - checkbox
          - text: Custom color
          - checkbox
          `);

        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_title_on.png',
        );
        await page
            .locator(
                'div:nth-child(3) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await page
            .getByRole('textbox', { name: 'Enter title text' })
            .fill('I am Title');
        await page
            .locator(
                'div:nth-child(5) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await page
            .locator(
                '.bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(3) > .bp6-menu-item').click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_custom_title.png',
        );

        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Title > .scroll-shadow > .scroll-shadow-cover > .panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();

        await page.getByRole('tab', { name: 'Ticks' }).click();
        await expect(page.getByLabel('Ticks')).toMatchAriaSnapshot(`
          - tabpanel "Ticks":
            - text: Draw on all edges
            - checkbox [checked]
            - text: Custom density
            - checkbox
            - text: Custom color
            - checkbox
            - text: Width (px)
            - group:
              - spinbutton "Width"
              - button "increment"
              - button "decrement"
            - text: Minor length (%)
            - group:
              - spinbutton "Length"
              - button "increment"
              - button "decrement"
            - text: Major length (%)
            - group:
              - spinbutton "Length"
              - button "increment"
              - button "decrement"
          `);
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Ticks > .scroll-shadow > .scroll-shadow-cover > .panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_all_edges_off.png',
        );
        await page
            .locator(
                'div:nth-child(2) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        const ticks = page.getByLabel('Ticks');
        await ticks
            .getByRole('spinbutton', { name: 'Density' })
            .nth(0)
            .fill('10');
        await ticks
            .getByRole('spinbutton', { name: 'Density' })
            .nth(1)
            .fill('2');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_custom_density.png',
        );
        await page
            .locator(
                'div:nth-child(4) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await page
            .locator(
                '.bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(2) > .bp6-menu-item').click();
        await expect(viewerCanvas).toHaveScreenshot(
            'M17_SWex_viewer_settings_ticks_custom_color.png',
            { maxDiffPixelRatio: 0.02 },
        );
        await page.getByRole('spinbutton', { name: 'Width' }).fill('3');
        await ticks
            .getByRole('spinbutton', { name: 'Length' })
            .nth(0)
            .fill('4');
        await ticks
            .locator('.bp6-form-group')
            .filter({ hasText: 'Major length (%)' })
            .getByRole('button', { name: 'decrement' })
            .click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_custom_width.png',
        );
    });

    test('Image Viewer Settings - Grid', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        // set to default preferences
        await carta.setPreferenceDefaults();

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Grid' }).click();

        await expect(page.getByLabel('Grids')).toMatchAriaSnapshot(`
          - text: WCS grid
          - checkbox
          - text: Custom color
          - checkbox [disabled]
          - text: Width (px)
          - group:
            - spinbutton "Width" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Custom gap
          - checkbox [disabled]
          - text: Pixel grid
          - checkbox
          - text: Pixel grid color
          - combobox:
            - button
          `);

        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Grids > .scroll-shadow > .scroll-shadow-cover > .panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_grid.png',
        );

        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Grids > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(2) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '.bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(9) > .bp6-menu-item').click();
        await page
            .getByTestId(
                'image-view-settings-grid-width-input-increment-button',
            )
            .click();
        await page
            .getByTestId(
                'image-view-settings-grid-width-input-increment-button',
            )
            .click();
        await expect(
            page.getByTestId('image-view-settings-grid-width-input'),
        ).toHaveValue('2');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_grid_color.png',
        );

        await carta.setSystem('CARTESIAN');
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Grids > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(5) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        const grids = page.getByLabel('Grids');
        await grids.getByRole('spinbutton', { name: 'Gap' }).nth(0).fill('100');
        await grids.getByRole('spinbutton', { name: 'Gap' }).nth(1).fill('50');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_grid_gap.png',
        );

        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Grids > .scroll-shadow > .scroll-shadow-cover > .panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await page
            .locator(
                'div:nth-child(7) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await page
            .locator(
                'div:nth-child(8) > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('.bp6-menu-item.bp6-active').click();
        await carta.setZoom(0, 25);
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_pixel_grid.png',
        );
    });

    test('Image Viewer Settings - Border and Axes', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        // set to default preferences
        await carta.setPreferenceDefaults();

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Border' }).click();

        await expect(page.getByLabel('Border')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Custom color
          - checkbox
          - text: Width (px)
          - group:
            - spinbutton "Width"
            - button "increment"
            - button "decrement"
          `);
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Border > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(2) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '.bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(6) > .bp6-menu-item').click();
        await page
            .getByLabel('Border')
            .getByRole('button', { name: 'increment' })
            .click();
        await page
            .getByLabel('Border')
            .getByRole('button', { name: 'increment' })
            .click();

        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_border.png',
        );

        await page.getByRole('tab', { name: 'Axes' }).click();
        await expect(page.getByLabel('Axes')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [disabled]
          - text: Does not apply to exterior labelling. Custom color
          - checkbox [disabled]
          - text: Width (px)
          - group:
            - spinbutton "Width" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Does not apply to exterior labelling.
          `);

        await carta.setLabelType('Interior');
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Axes > .scroll-shadow > .scroll-shadow-cover > .panel-container > div > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .first()
            .click();
        await expect(page.getByLabel('Axes')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Custom color
          - checkbox
          - text: Width (px)
          - group:
            - spinbutton "Width"
            - button "increment"
            - button "decrement"
          `);
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Axes > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(2) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Axes > .scroll-shadow > .scroll-shadow-cover > .panel-container > .bp6-collapse > .bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(3) > .bp6-menu-item').click();
        await page
            .getByLabel('Axes')
            .getByRole('button', { name: 'increment' })
            .click();
        await page
            .getByLabel('Axes')
            .getByRole('button', { name: 'increment' })
            .click();

        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_axes.png',
        );
    });

    test('Image Viewer Settings - Numbers and Labels', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        // set to default preferences
        await carta.setPreferenceDefaults();

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Numbers' }).click();

        await expect(page.getByLabel('Numbers')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Font
          - combobox:
            - button "sans-serif"
          - group:
            - spinbutton "Font size"
            - button "increment"
            - button "decrement"
          - text: Custom color
          - checkbox
          - text: Custom format
          - checkbox
          - text: Custom precision
          - checkbox
          `);

        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Numbers > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(3) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '.bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(2) > .bp6-menu-item').click();
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Numbers > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(5) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '.bp6-collapse-body > div > .bp6-form-content > .bp6-html-select > select',
            )
            .first()
            .selectOption('d');
        await page
            .locator(
                '.bp6-collapse-body > div:nth-child(2) > .bp6-form-content > .bp6-html-select > select',
            )
            .selectOption('d');
        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Numbers > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(7) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        const numberPrecision = page
            .getByLabel('Numbers')
            .locator('.bp6-form-group')
            .filter({ hasText: 'Precision' });
        await numberPrecision
            .getByRole('button', { name: 'decrement' })
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'Precision' }),
        ).toHaveValue('2');

        await expect(viewerCanvas).toHaveScreenshot(
            'M17_SWex_viewer_settings_numbers.png',
            { maxDiffPixelRatio: 0.02 },
        );

        // Open image viewer settings - Labels tab
        await page.getByRole('tab', { name: 'Labels' }).click();
        await expect(page.getByLabel('Labels')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Font
          - combobox:
            - button "sans-serif"
          - group:
            - spinbutton "Font size"
            - button "increment"
            - button "decrement"
          - text: Show RA/Dec reference
          - checkbox [checked]
          - text: Custom text
          - checkbox
          - text: Custom color
          - checkbox
          `);

        await page
            .locator(
                '.panel-labels > div:nth-child(3) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '.panel-labels > div:nth-child(4) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .getByRole('textbox', { name: 'Enter label text' })
            .first()
            .fill('IamRA');
        await page
            .getByRole('textbox', { name: 'Enter label text' })
            .nth(1)
            .fill('WeAreDEC');
        await page
            .locator(
                '.panel-labels > div:nth-child(6) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                'div:nth-child(7) > .bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(2) > .bp6-menu-item').click();

        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_labels.png',
        );
    });

    test('Image Viewer Settings - Colorbar', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        const colorbarCanvas = page.locator('canvas').nth(5);

        // set to default preferences
        await carta.setPreferenceDefaults();

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Colorbar' }).click();

        await expect(page.getByLabel('Colorbar')).toMatchAriaSnapshot(`
          - text: Visible
          - checkbox [checked]
          - text: Interactive
          - checkbox [checked]
          - text: Position
          - combobox:
            - option "Right" [selected]
            - option "Top"
            - option "Bottom"
          - img "Open dropdown"
          - text: Width (px)
          - group:
            - spinbutton "Width"
            - button "increment"
            - button "decrement"
          - text: Offset (px)
          - group:
            - spinbutton "Offset"
            - button "increment"
            - button "decrement"
          - text: Ticks density (per 100px)
          - group:
            - spinbutton "Ticks density"
            - button "increment"
            - button "decrement"
          - text: Custom color
          - checkbox
          - separator
          - text: Label
          - checkbox
          - text: Label rotation
          - combobox [disabled]:
            - option /-\\d+/ [selected]
            - option /\\d+/
          - img "Open dropdown"
          - text: Label font
          - combobox [disabled]:
            - button "sans-serif" [disabled]
          - group:
            - spinbutton [disabled]: /\\d+/
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Label custom text
          - checkbox [disabled]
          - text: Label custom color
          - checkbox [disabled]
          - separator
          - text: Numbers
          - checkbox [checked]
          - text: Numbers rotation
          - combobox:
            - option /-\\d+/ [selected]
            - option "0"
            - option /\\d+/
          - img "Open dropdown"
          - text: Numbers font
          - combobox:
            - button "sans-serif"
          - group:
            - spinbutton: /\\d+/
            - button "increment"
            - button "decrement"
          - text: Numbers custom precision
          - checkbox
          - text: Numbers custom color
          - checkbox
          - separator
          - text: Ticks
          - checkbox [checked]
          - text: Ticks length (px)
          - group:
            - spinbutton "Ticks length"
            - button "increment"
            - button "decrement"
          - text: Ticks width (px)
          - group:
            - spinbutton "Ticks width"
            - button "increment"
            - button "decrement"
          - text: Ticks custom color
          - checkbox
          - separator
          - text: Border
          - checkbox [checked]
          - text: Border width (px)
          - group:
            - spinbutton "Border width"
            - button "increment"
            - button "decrement"
          - text: Border custom color
          - checkbox
          `);

        await page
            .locator(
                '.panel-colorbar > div:nth-child(2) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .getByLabel('Colorbar')
            .getByRole('combobox')
            .first()
            .selectOption('top');
        await expect(page.getByLabel('Colorbar')).toMatchAriaSnapshot(`
          - text: Label rotation
          - combobox [disabled]:
            - option /-\\d+/ [selected]
            - option /\\d+/
          - img "Open dropdown"
          `);
        await page
            .getByRole('spinbutton', { name: 'Width', exact: true })
            .fill('30');
        await page.getByRole('spinbutton', { name: 'Offset' }).fill('10');
        await page.getByRole('spinbutton', { name: 'Ticks density' }).fill('2');
        await page
            .locator(
                '.panel-colorbar > div:nth-child(7) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                '.bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(3) > .bp6-menu-item').click();
        await page
            .locator('canvas')
            .nth(5)
            .click({
                position: {
                    x: 384,
                    y: 37,
                },
            });
        await expect(viewerCanvas).toHaveScreenshot(
            'M17_SWex_viewer_settings_colorbar_position.png',
            { maxDiffPixelRatio: 0.02 },
        );

        await page
            .locator(
                'div:nth-child(10) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                'div:nth-child(13) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page.getByRole('textbox', { name: 'Enter label text' }).click();
        await page
            .getByRole('textbox', { name: 'Enter label text' })
            .fill('LabelLabel');
        await page
            .locator(
                'div:nth-child(15) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                'div:nth-child(16) > .bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(5) > .bp6-menu-item').click();
        await carta.screenShot(
            colorbarCanvas,
            'M17_SWex_viewer_settings_colorbar_label.png',
        );

        await page
            .getByLabel('Colorbar')
            .getByRole('combobox')
            .first()
            .selectOption('right');
        await page
            .locator(
                'div:nth-child(19) > .bp6-form-content > .bp6-html-select > select',
            )
            .selectOption('0');
        await page
            .locator(
                'div:nth-child(21) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        const colorbarPrecision = page
            .getByLabel('Colorbar')
            .locator('.bp6-form-group')
            .filter({ hasText: 'Numbers precision' });
        await colorbarPrecision
            .getByRole('button', { name: 'decrement' })
            .click();
        await expect(colorbarPrecision.getByRole('spinbutton')).toHaveValue(
            '2',
        );
        await page
            .locator(
                'div:nth-child(23) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await page
            .locator(
                'div:nth-child(24) > .bp6-collapse-body > .bp6-form-group > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(7) > .bp6-menu-item').click();
        await expect(colorbarCanvas).toHaveScreenshot(
            'M17_SWex_viewer_settings_colorbar_numbers.png',
            { maxDiffPixelRatio: 0.02 },
        );

        await page
            .locator(
                'div:nth-child(18) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await expect(page.getByText('Numbers rotation -90090Open'))
            .toMatchAriaSnapshot(`
          - text: Numbers rotation
          - combobox [disabled]:
            - option /-\\d+/
            - option "0" [selected]
            - option /\\d+/
          - img "Open dropdown"
          `);

        await expect(
            page.locator(
                'div:nth-child(22) > .bp6-collapse-body > .bp6-form-group',
            ),
        ).toMatchAriaSnapshot(`
            - text: Numbers precision
            - group:
              - spinbutton [disabled]: "2"
              - button "increment" [disabled]
              - button "decrement" [disabled]
            `);

        await page.getByRole('spinbutton', { name: 'Ticks length' }).fill('10');
        await page.getByRole('spinbutton', { name: 'Ticks width' }).fill('5');
        await page.getByRole('spinbutton', { name: 'Border width' }).fill('3');
        await carta.screenShot(
            colorbarCanvas,
            'M17_SWex_viewer_settings_colorbar_ticks.png',
        );
    });

    test('Image Viewer Settings - Beam', async ({
        page,
        carta,
        viewerCanvas,
    }) => {
        // set to default preferences
        await carta.setMultiPanelLayout();
        await carta.enablePixelGrid(false);
        await carta.setLabelType('Exterior');

        // Load test data cubes
        await carta.loadImage('M17_SWex.fits');

        // Open image viewer settings
        await page.getByTestId('image-view-header-settings-button').click();
        await page.getByRole('tab', { name: 'Beam' }).click();

        await carta.setZoom(0, 15);

        await page
            .locator(
                'div:nth-child(3) > .bp6-form-content > .bp6-popover-target > .bp6-button',
            )
            .click();
        await page.locator('li:nth-child(17) > .bp6-menu-item').click();
        await page
            .locator(
                'div:nth-child(4) > .bp6-form-content > .bp6-html-select > select',
            )
            .selectOption('solid');
        await page.getByRole('spinbutton', { name: 'Width' }).click();
        await page.getByRole('spinbutton', { name: 'Width' }).fill('5');
        await page.getByRole('spinbutton', { name: 'Position (X)' }).fill('10');
        await page.getByRole('spinbutton', { name: 'Position (Y)' }).fill('30');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_beam.png',
        );

        await page
            .locator(
                '#bp6-tab-panel_imageViewSettingsTabs_Beam > .scroll-shadow > .scroll-shadow-cover > .panel-container > div:nth-child(2) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_no_beam.png',
        );
    });

    test('Raster Configuration', async ({ page, carta }) => {
        const viewerCanvas = page.locator(
            '.region-stage > .konvajs-content > canvas',
        );
        const histogramCanvas = page
            .locator('.annotation-stage > .konvajs-content > canvas')
            .first();

        // Load test data cube
        await carta.loadImage('M17_SWex.fits');
        const renderConfigContent = page.getByTestId('render-config-0-content');
        if (!(await renderConfigContent.isVisible())) {
            await page.getByTestId('render-config-0-header-title').click();
        }
        await expect(renderConfigContent).toBeVisible();

        // set channel to 8 and take screenshots of different rendering modes and colormaps
        await carta.setChannel(0, 8);
        await page.getByRole('button', { name: 'Linear' }).click();
        await page.getByRole('menuitem', { name: 'Log' }).click();
        await page.getByTestId('clip-button-99.99').click();
        await carta.screenShot(viewerCanvas, 'M17_SWex_channel8_log_99.99.png');
        await page.getByTestId('clip-button-99').click();
        await carta.screenShot(viewerCanvas, 'M17_SWex_channel8_log_99.png');
        await page.locator('#numericInput-2').fill('100');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_log_99_alpha100.png',
        );
        await carta.screenShot(
            histogramCanvas,
            'M17_SWex_channel8_log_99_alpha100_hist.png',
        );

        await page.getByRole('button', { name: 'Log' }).click();
        await page.getByRole('menuitem', { name: 'Square root' }).click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_square_root_99.png',
        );
        await page.locator('.bp6-control-indicator').first().click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_square_root_99_invert.png',
        );

        await page.getByRole('button', { name: 'Square root' }).click();
        await page.getByRole('menuitem', { name: 'Squared' }).click();
        await carta.screenShot(viewerCanvas, 'M17_SWex_channel8_square_99.png');
        await page.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'cubehelix' }).click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_square_99_cubehelix.png',
        );
        await page.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'gnuplot2' }).click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_square_99_gnuplot2.png',
        );
        await carta.screenShot(
            page.locator('canvas').nth(5),
            'gnuplot2_colorbar.png',
        );
        await page.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'custom' }).click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_square_99_custom.png',
        );

        await page.getByRole('button', { name: 'Squared' }).click();
        await page.getByRole('menuitem', { name: 'Gamma' }).click();

        const gammaInput = renderConfigContent
            .locator('.bp6-form-group')
            .filter({ hasText: /^Gamma/ })
            .getByRole('spinbutton');
        await gammaInput.fill('1.5');
        await gammaInput.press('Enter');

        await page.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'seismic' }).click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_gamma_99_gamma_1.5_seismic.png',
        );
        await page.getByTestId('clip-button-99.99').click();

        await page.getByRole('button', { name: 'Bias / Contrast' }).click();
        const contrastControls = page
            .locator('.bp6-form-group')
            .filter({ hasText: /^Contrast/ });
        const contrastDecrement = contrastControls.getByRole('button', {
            name: 'decrement',
        });
        const contrastIncrement = contrastControls.getByRole('button', {
            name: 'increment',
        });
        for (let i = 0; i < 5; i++) await contrastDecrement.click();
        for (let i = 0; i < 6; i++) await contrastIncrement.click();
        await carta.screenShot(
            page.locator('.bias-contrast-stage > .konvajs-content > canvas'),
            'bias.png',
        );
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_gamma_99.99_gamma_1.5_seismic_bias.png',
        );
        await carta.screenShot(
            histogramCanvas,
            'M17_SWex_channel8_gamma_99.99_gamma_1.5_seismic_bias_hist.png',
        );
        await carta.screenShot(
            page.locator('canvas').nth(5),
            'seismic_colorbar.png',
        );

        await page.getByRole('button', { name: 'Gamma', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Power' }).click();

        await page.locator('.bp6-input-action > .bp6-button').first().click();
        await page
            .locator(
                'div:nth-child(3) > .bp6-form-content > .bp6-control-group > .bp6-input-group > .bp6-input-action > .bp6-button',
            )
            .click();
        await page.getByTestId('clip-button-99.5').click();
        await page.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'gist_stern' }).click();
        await page.locator('#numericInput-6').fill('10');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_power_99.5_alpha_10_gist_stern.png',
        );
    });
});
