import { test, expect, type Page } from '@playwright/test';
import { PlaywrightDevPage, LayoutName } from '../utilities';

test('Spectral line query retries and plots a known frequency', async ({
    page,
}, testInfo) => {
    let requests = 0;
    await page.route('https://splatalogue.online/**', async (route) => {
        requests++;
        if (requests === 1) {
            await route.fulfill({
                status: 503,
                body: 'Injected query failure',
            });
            return;
        }
        await route.fulfill({
            json: [
                {
                    species_id: 1,
                    name: 'Mock molecule',
                    chemical_name: 'Mock molecule',
                    orderedFreq: '999.993328718096',
                    resolved_QNs: '1-0',
                    linelist: 'Mock',
                },
            ],
        });
    });
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.loadImage('cube.fits');
    await carta.selectMenuItem('Widgets', ['Profiles', 'Spectral Profiler']);
    await page
        .getByTestId('spectral-profiler-0-header-settings-button')
        .click();
    await page
        .getByRole('tabpanel', { name: 'Conversion' })
        .getByTestId('spectral-profiler-coordinate-dropdown')
        .selectOption({ label: 'Radio velocity (km/s)' });
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
        const frame = (window as any).app.activeFrame;
        frame.setCursorPosition({ x: 8, y: 8 });
        frame.updateCursorRegion({ x: 8, y: 8 });
    });
    await carta.selectMenuItem('Widgets', 'Spectral Line Query');
    const query = page.locator('.spectral-line-query-widget');
    await page
        .getByTestId('spectral-line-query-mode-dropdown')
        .selectOption('Range');
    await page
        .getByTestId('spectral-line-query-unit-dropdown')
        .selectOption('MHz');
    const from = page.getByTestId('spectral-line-query-from-input');
    const to = page.getByTestId('spectral-line-query-to-input');
    await from.fill('999.98');
    await from.press('Tab');
    await to.fill('1000.01');
    await to.press('Tab');
    await query.getByRole('button', { name: 'Query', exact: true }).click();
    const alert = page.getByRole('alertdialog');
    await expect(alert).toBeVisible();
    await alert.getByRole('button', { name: 'OK', exact: true }).click();
    await query.getByRole('button', { name: 'Query', exact: true }).click();
    await expect(
        page.getByTestId('spectral-line-query-result-info'),
    ).toContainText('1');
    expect(requests).toBe(2);
    await query
        .getByTestId('filterable-table-filter-input-1')
        .last()
        .fill('Missing molecule');
    await query
        .getByRole('button', { name: 'Apply filter', exact: true })
        .click();
    await expect(
        page.getByTestId('spectral-line-query-result-info'),
    ).toContainText('Showing 0 filtered line(s)');
    await query
        .getByRole('button', { name: 'Reset filter', exact: true })
        .click();
    await expect(
        page.getByTestId('spectral-line-query-result-info'),
    ).toContainText('Showing 1 line(s)');
    await query
        .getByTestId('filterable-table-header-checkbox')
        .last()
        .locator('..')
        .click();
    await query.getByRole('button', { name: 'Plot', exact: true }).click();
    const lines = () =>
        page.evaluate(
            () =>
                (window as any).app.widgetsStore.getSpectralWidgetStoreByID(
                    'spectral-profiler-0',
                ).transformedSpectralLines,
        );
    await expect.poll(lines).toMatchObject([
        {
            species: 'Mock molecule',
            value: expect.closeTo(2, 3),
            qn: '1-0',
        },
    ]);
    const plot = page
        .locator('.spectral-profiler-widget .line-plot-component')
        .first();
    const markerPixels = () =>
        page.evaluate(() => {
            const canvas = document.querySelector<HTMLCanvasElement>(
                '.spectral-profiler-widget .annotation-stage canvas',
            );
            if (!canvas?.width || !canvas.height) return 0;
            const rgb = (window as any).app.isDarkTheme
                ? [50, 164, 103]
                : [28, 110, 66];
            const rgba = canvas
                .getContext('2d')!
                .getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0;
            for (let i = 0; i < rgba.length; i += 4) {
                if (
                    rgba[i] === rgb[0] &&
                    rgba[i + 1] === rgb[1] &&
                    rgba[i + 2] === rgb[2] &&
                    rgba[i + 3] > 0
                )
                    count++;
            }
            return count;
        });
    await expect.poll(markerPixels).toBeGreaterThan(0);
    await testInfo.attach('spectral-line-query-plotted.png', {
        body: await plot.screenshot(),
        contentType: 'image/png',
    });
    await query
        .getByRole('button', { name: 'Clear plot', exact: true })
        .click();
    await expect.poll(lines).toEqual([]);
    await expect.poll(markerPixels).toBe(0);
    await testInfo.attach('spectral-line-query-cleared.png', {
        body: await plot.screenshot(),
        contentType: 'image/png',
    });
});

async function waitForSpectralProfile(page: Page, filename: string) {
    await expect
        .poll(
            () =>
                page.evaluate((name) => {
                    const app = (window as any).app;
                    const frame = app.frames
                        .filter((candidate: any) => candidate.filename === name)
                        .at(-1);
                    const profile = app.spectralProfiles
                        .get(frame?.frameInfo.fileId)
                        ?.get(1);
                    return Array.from(profile?.profiles?.values() ?? []).some(
                        (series: any) =>
                            Array.from(series.values()).some(
                                (curve: any) =>
                                    Array.from(curve.values ?? []).length > 1,
                            ),
                    );
                }, filename),
            { timeout: 15_000 },
        )
        .toBe(true);
}

async function openPointSpectralProfiler(
    page: Page,
    carta: PlaywrightDevPage,
    layout: LayoutName = LayoutName.CubeAnalysis,
) {
    await carta.goto(layout);
    await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
    await page.getByTestId('point-region-shortcut-button').click();
    await page.locator('.region-stage > .konvajs-content > canvas').click({
        position: { x: 320, y: 100 },
    });
    await page.locator('#SpectralProfilerButton').click();
    const profiler = page.getByTestId('spectral-profiler-0-content');
    await profiler.getByTestId('spectral-profiler-region-dropdown').click();
    await page
        .getByTestId('spectral-profiler-region-dropdown-region-1')
        .click();
    await waitForSpectralProfile(page, 'HD163296_13CO_2-1_subimage.fits');
    return profiler;
}

async function openMatchingCubes(page: Page, carta: PlaywrightDevPage) {
    await carta.goto();
    await carta.loadImage('cube.fits');
    await carta.loadImage('matching-cube.fits', true);
    await carta.selectMenuItem('Widgets', ['Info Panels', 'Image List Widget']);
    const imageList = page
        .locator('[data-testid^="layer-list-"][data-testid$="-content"]')
        .filter({ has: page.locator('.layer-list-widget') })
        .last();
    for (const [type, reference] of [
        ['xy', 'spatialReference'],
        ['z', 'spectralReference'],
    ]) {
        if (
            await page.evaluate(
                (key) => Boolean((window as any).app.frames[1][key]),
                reference,
            )
        ) {
            await imageList
                .getByTestId(`image-list-0-matching-${type}`)
                .click();
        }
    }
    return imageList;
}

test.describe('Spatial Profilers', () => {
    test('Spatial widget', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Boot up CARTA application
        await carta.goto();
        await carta.setTestPreferences();

        // Load test data and create regions on the first image
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        await page.getByTestId('point-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 307,
                y: 130,
            },
        });
        await page.getByTestId('rectangle-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 507,
                y: 303,
            },
        });
        await page.getByTestId('line-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 359,
                y: 242,
            },
        });

        // Show appended images in separate panels so the second image canvas is addressable.
        await carta.setMultiPanelLayout(1, 2);

        // Append another image to the current image and create a region on the new image
        await carta.loadImage('disk_0.fits', true);

        await page.getByTestId('point-region-shortcut-button').click();
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .last()
            .click({
                position: {
                    x: 153,
                    y: 148,
                },
            });

        // Set layout to "Default" and check toolbar
        await carta.applyLayout(LayoutName.Default);
        await expect(page.locator('#root')).toMatchAriaSnapshot(`
          - text: "X Profile: Region #4"
          - img
          - button ""
          - button ""
          - button ""
          - button "Maximise":
            - img
          `);

        // Open a floating spatial profiler widget
        await page.locator('#SpatialProfilerButton').click();

        // Check the spatial profiler widget content
        await expect(
            page.getByTestId('spatial-profiler-2-header-title'),
        ).toContainText('X Profile: Region #4');
        await expect(page.getByTestId('spatial-profiler-2-content'))
            .toMatchAriaSnapshot(`
          - text: Image
          - combobox:
            - option "Active" [selected]
            - 'option "0: HD163296_13CO_2-1_subimage.fits"'
            - 'option "1: disk_0.fits"'
          - img "Open dropdown"
          `);
        await expect(page.getByTestId('spatial-profiler-2-content'))
            .toMatchAriaSnapshot(`
          - text: Region
          - combobox:
            - option "Active" [selected]
            - option "Cursor"
            - option "Region 4"
          - img "Open dropdown"
          `);

        // Switch images and check the region content
        await page
            .getByTestId('spatial-profiler-2-content')
            .getByTestId('image-dropdown')
            .selectOption('0');
        await expect(page.getByTestId('spatial-profiler-2-content'))
            .toMatchAriaSnapshot(`
          - text: Region
          - combobox:
            - option "Active" [selected]
            - option "Cursor"
            - option "Region 1"
            - option "Region 3"
          - img "Open dropdown"
          `);

        // Switch regions and take screenshots
        await page
            .getByTestId('spatial-profiler-2-content')
            .getByTestId('region-dropdown')
            .selectOption('1');
        await carta.screenShot(
            page
                .getByTestId('spatial-profiler-2-content')
                .locator(
                    '.profile-plot > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
                ),
            'HD163296_13CO_2-1_subimage_x_region1.png',
        );

        // Switch profile direction to Y and check the title
        await page
            .getByTestId('spatial-profiler-2-header-settings-button')
            .click();
        await page
            .locator(
                '.line-settings-panel > div > .bp6-form-content > .bp6-html-select > select',
            )
            .selectOption('y');
        await page.locator('div:nth-child(3) > .bp6-icon > svg').click();
        await expect(
            page.getByTestId('spatial-profiler-2-header-title'),
        ).toContainText('Y Profile: Region #1');

        // Switch regions and take screenshots
        await page
            .getByTestId('spatial-profiler-2-content')
            .getByTestId('region-dropdown')
            .selectOption('3');
        await carta.screenShot(
            page
                .getByTestId('spatial-profiler-2-content')
                .locator(
                    '.profile-plot > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
                ),
            'HD163296_13CO_2-1_subimage_x_region3.png',
        );
    });

    test('Spatial widget settings', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // 1. Boot up CARTA application
        await carta.goto();

        // 2. Load test data cube
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        // 3. set layout to "Default"
        await carta.applyLayout(LayoutName.Default);

        await page
            .getByTestId('spatial-profiler-0-header-settings-button')
            .click();
        await expect(
            page.getByTestId(
                'spatial-profiler-0-floating-settings-0-header-title',
            ),
        ).toBeVisible();
        await page
            .locator(
                '.floating-content > .scroll-shadow > .scroll-shadow-cover',
            )
            .click();

        await expect(
            page.getByTestId('spatial-profiler-0-floating-settings-0-content'),
        ).toMatchAriaSnapshot(`
          - tablist:
            - tab "Styling" [expanded] [selected]
            - tab "Smoothing"
            - tab "Computation"
          - tabpanel "Styling":
            - text: Coordinate
            - combobox:
              - option "X" [selected]
              - option "Y"
            - img "Open dropdown"
            - text: Line color ( Primary )
            - combobox:
              - button
            - text: Line width (px)
            - group:
              - spinbutton "Line width"
              - button "increment"
              - button "decrement"
            - text: Point size (px)
            - group:
              - spinbutton "Point size" [disabled]
              - button "increment" [disabled]
              - button "decrement" [disabled]
            - text: Show WCS axis
            - checkbox [checked]
            - text: Show mean/RMS
            - checkbox
            - text: Only visible in single profile Line style
            - button
            - button
            - button
            - text: ""
            - group:
              - spinbutton: "0"
            - text: ""
            - group:
              - spinbutton: "0"
            - text: ""
            - group:
              - spinbutton: "0"
            - text: ""
            - group:
              - spinbutton: "0"
            - text: Reset range
            - button "Reset range" [disabled]
        `);
        await page.getByRole('tab', { name: 'Smoothing' }).click();

        await expect(
            page.getByTestId('spatial-profiler-0-floating-settings-0-content'),
        ).toMatchAriaSnapshot(`
          - tablist:
            - tab "Styling"
            - tab "Smoothing" [expanded] [selected]
            - tab "Computation"
          - tabpanel "Smoothing":
            - text: ""
            - combobox:
              - option "None" [selected]
              - option "Boxcar"
              - option "Gaussian"
              - option "Hanning"
              - option "Binning"
              - option "Savitzky-Golay"
              - option "Decimation"
            - img "Open dropdown"
          `);
        await page.getByRole('tab', { name: 'Computation' }).click();
        await expect(
            page.getByTestId('spatial-profiler-0-floating-settings-0-content'),
        ).toMatchAriaSnapshot(`
          - tablist:
            - tab "Styling"
            - tab "Smoothing"
            - tab "Computation" [expanded] [selected]
          - tabpanel "Computation":
            - text: ""
            - group:
              - spinbutton: "3"
              - button "increment"
              - button "decrement"
          `);
    });

    test('Spatial profile smoothing', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Boot up CARTA application
        await carta.goto();

        // Load test data and create regions on the image
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await carta.applyLayout(LayoutName.Default);

        await page.getByTestId('point-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 300,
                y: 130,
            },
        });

        // Open spatial profiler settings
        await page.locator('#SpatialProfilerButton').click();
        await page
            .getByTestId('spatial-profiler-0-header-settings-button')
            .click();

        // Select Boxcar smoothing and take a screenshot
        await page.getByRole('tab', { name: 'Smoothing' }).click();
        await page
            .getByTestId('smoothing-settings-method-dropdown')
            .selectOption('Boxcar');
        await carta.screenShot(
            page.locator(
                '[data-testid="spatial-profiler-0-content"] .profile-plot > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
            ),
            'HD163296_13CO_2-1_subimage_x_region1_boxcar.png',
        );

        // Select Gaussian smoothing and scatter plot and take a screenshot
        await page
            .getByTestId('smoothing-settings-method-dropdown')
            .selectOption('Gaussian');
        await page
            .locator(
                'div:nth-child(3) > .bp6-form-content > .bp6-button-group > span:nth-child(3) > .bp6-button',
            )
            .click();
        await carta.screenShot(
            page.locator(
                '[data-testid="spatial-profiler-0-content"] .profile-plot > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
            ),
            'HD163296_13CO_2-1_subimage_x_region1_gaussian_scatter.png',
        );

        // Select Binning smoothing and take a screenshot
        await page
            .getByTestId('smoothing-settings-method-dropdown')
            .selectOption('Binning');
        await page
            .getByTestId(
                'smoothing-settings-binning-width-input-increment-button',
            )
            .click();
        await page
            .getByTestId(
                'smoothing-settings-binning-width-input-increment-button',
            )
            .click();
        await page
            .locator(
                'div:nth-child(3) > .bp6-form-content > .bp6-button-group > span > .bp6-button',
            )
            .first()
            .click();
        await page
            .locator(
                '.smoothing-settings-panel > div:nth-child(6) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await carta.screenShot(
            page.locator(
                '[data-testid="spatial-profiler-0-content"] .profile-plot > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
            ),
            'HD163296_13CO_2-1_subimage_x_region1_binning.png',
        );
    });
});

test.describe('Spectral Profilers', () => {
    test('Spectral widget', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Boot up CARTA application
        await carta.goto();

        // Load test data and create regions on the first image
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await page.getByTestId('point-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 320,
                y: 100,
            },
        });
        await page.getByTestId('rectangle-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 500,
                y: 300,
            },
        });

        // Append another image to the current image and create a region on the new image
        await carta.loadImage(
            'IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits',
            true,
        );
        await page.getByTestId('rectangle-region-shortcut-button').click();
        const secondImageCanvas = page.locator(
            'div:nth-child(9) > .region-stage > .konvajs-content > canvas',
        );
        await secondImageCanvas.dragTo(secondImageCanvas, {
            sourcePosition: { x: 150, y: 180 },
            targetPosition: { x: 300, y: 300 },
        });
        await page.getByTestId('ellipse-region-shortcut-button').click();
        await page
            .locator(
                'div:nth-child(9) > .region-stage > .konvajs-content > canvas',
            )
            .click({
                position: {
                    x: 180,
                    y: 235,
                },
            });

        // apply cube view layout and check the toolbar
        await carta.applyLayout(LayoutName.CubeView);

        // Open a floating spectral profiler widget
        await page.locator('#SpectralProfilerButton').click();

        await expect(page.getByTestId('spectral-profiler-0-content'))
            .toMatchAriaSnapshot(`
              - checkbox "Image"
              - text: Image
              - button "Active"
              - checkbox "Region"
              - text: Region
              - button "Active"
              - checkbox "Statistic"
              - text: Statistic
              - button "Mean"
              - checkbox "Polarization"
              - text: Polarization
              - button "Current"
              - button:
                - img
              - button:
                - img
              - button:
                - img: z
              - img
              - button
              - button
              - separator "horizontal divider 1"
              - text: "/Data: \\\\(\\\\d+\\\\.\\\\d+ GHz, 4\\\\.34e-3\\\\)/"
            `);

        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('spectral-profiler-image-dropdown')
            .click();
        await expect(
            page
                .getByRole('menu')
                .filter({ hasText: 'Active0: HD163296_13CO_2-' }),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Active"
            - 'menuitem "0: HD163296_13CO_2-1_subimage.fits"'
            - 'menuitem "1: IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits"'
        `);

        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await expect(page.getByText('ActiveCursorRegion 3Region'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Active"
            - menuitem "Cursor"
            - menuitem "Region 3"
            - menuitem "Region 4"
        `);
        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('spectral-profiler-statistic-dropdown')
            .click();
        await expect(
            page.getByText('SumFluxDensityMeanRMSStdDevSumSqMinMaxExtrema'),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Sum"
            - menuitem "FluxDensity"
            - menuitem "Mean"
            - menuitem "RMS"
            - menuitem "StdDev"
            - menuitem "SumSq"
            - menuitem "Min"
            - menuitem "Max"
            - menuitem "Extrema"
        `);

        // A statistic change must alter the rendered series, not just the menu label.
        await page.getByRole('menuitem', { name: 'Mean', exact: true }).click();
        const spectralWidget = page.getByTestId('spectral-profiler-1-content');
        await spectralWidget
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-3')
            .click();
        const profileValues = () =>
            page.evaluate(() =>
                (window as any).app.widgetsStore.spectralProfileWidgets
                    .get('spectral-profiler-1')
                    ?.plotData?.data[0]?.map((point: any) => point.y),
            );
        await expect
            .poll(async () => (await profileValues())?.length)
            .toBeGreaterThan(1);
        const meanValues = await profileValues();
        await spectralWidget
            .getByTestId('spectral-profiler-statistic-dropdown')
            .click();
        await page.getByRole('menuitem', { name: 'RMS', exact: true }).click();
        await expect(
            spectralWidget.getByTestId('spectral-profiler-statistic-dropdown'),
        ).toContainText('RMS');
        await expect
            .poll(async () => {
                const rmsValues = await profileValues();
                return (
                    rmsValues?.length === meanValues?.length &&
                    rmsValues.some(
                        (value: number, index: number) =>
                            Number.isFinite(value) &&
                            Math.abs(value - meanValues[index]) > 1e-6,
                    )
                );
            })
            .toBe(true);
        await page.keyboard.press('Escape');
        const rmsCanvas = spectralWidget.locator(
            '.line-plot-component .annotation-stage canvas',
        );
        const plotColor = await page.evaluate(
            () =>
                (window as any).app.widgetsStore.spectralProfileWidgets.get(
                    'spectral-profiler-1',
                )?.primaryLineColor,
        );
        expect(plotColor).toBe('auto-blue');
        await expect(rmsCanvas).toHaveScreenshot('spectral-region3-rms.png');

        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('spectral-profiler-image-dropdown')
            .click();
        await page
            .getByTestId(
                'spectral-profiler-image-dropdown-0:-hd163296_13co_2-1_subimage.fits',
            )
            .click();
        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await expect(page.getByText('ActiveCursorRegion 1Region'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Active"
            - menuitem "Cursor"
            - menuitem "Region 1"
            - menuitem "Region 2"
        `);

        // check the setting-tab short cut in the widget
        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('smoothing-button')
            .click();
        await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
          - tablist:
            - tab "Conversion"
            - tab "Styling"
            - tab "Smoothing" [expanded] [selected]
            - tab "Moments"
            - tab "Fitting"
          `);
        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('moment-generator-button')
            .click();
        await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
            - tablist:
              - tab "Conversion"
              - tab "Styling"
              - tab "Smoothing"
              - tab "Moments" [expanded] [selected]
              - tab "Fitting"
            `);
        await page
            .getByTestId('spectral-profiler-1-content')
            .getByTestId('profile-fitting-button')
            .click();
        await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
            - tablist:
              - tab "Conversion"
              - tab "Styling"
              - tab "Smoothing"
              - tab "Moments"
              - tab "Fitting" [expanded] [selected]
            `);
    });

    test('Spectral widget settings: conversion', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        const spectralProfileCanvas = page
            .getByTestId('spectral-profiler-0-content')
            .locator(
                '.line-plot-component > .annotation-stage > .konvajs-content > canvas',
            );
        const spectralProfileInfo = page
            .getByTestId('spectral-profiler-0-content')
            .getByTestId('spectral-profiler-info-0')
            .locator('pre');

        await openPointSpectralProfiler(page, carta);

        // open settings and check tabs
        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await expect(page.getByRole('tablist')).toMatchAriaSnapshot(`
          - tablist:
            - tab "Conversion" [expanded] [selected]
            - tab "Styling"
            - tab "Smoothing"
            - tab "Moments"
            - tab "Fitting"
          `);

        // check conversion tab content
        await expect(
            page.getByTestId('spectral-profiler-0-floating-settings-0-content'),
        ).toMatchAriaSnapshot(`
          - tablist:
            - tab "Conversion" [expanded] [selected]
            - tab "Styling"
            - tab "Smoothing"
            - tab "Moments"
            - tab "Fitting"
          - tabpanel "Conversion":
            - text: Coordinate
            - combobox:
              - option "Radio velocity (km/s)"
              - option "Radio velocity (m/s)"
              - option "Optical velocity (km/s)"
              - option "Optical velocity (m/s)"
              - option "Frequency (GHz)" [selected]
              - option "Frequency (MHz)"
              - option "Frequency (kHz)"
              - option "Frequency (Hz) (Native WCS)"
              - option "Vacuum wavelength (m)"
              - option "Vacuum wavelength (mm)"
              - option "Vacuum wavelength (um)"
              - option "Vacuum wavelength (nm)"
              - option "Vacuum wavelength (Angstrom)"
              - option "Vacuum wavelength (m^2)"
              - option "Vacuum wavelength (mm^2)"
              - option "Vacuum wavelength (um^2)"
              - option "Vacuum wavelength (nm^2)"
              - option "Vacuum wavelength (Angstrom^2)"
              - option "Air wavelength (m)"
              - option "Air wavelength (mm)"
              - option "Air wavelength (um)"
              - option "Air wavelength (nm)"
              - option "Air wavelength (Angstrom)"
              - option "Air wavelength (m^2)"
              - option "Air wavelength (mm^2)"
              - option "Air wavelength (um^2)"
              - option "Air wavelength (nm^2)"
              - option "Air wavelength (Angstrom^2)"
              - option "Channel"
            - img "Open dropdown"
            - text: ""
            - combobox:
              - option "LSRK" [selected]
              - option "LSRD"
            - img "Open dropdown"
            - text: Intensity unit
            - combobox:
              - option "Jy/beam" [selected]
              - option "mJy/beam"
              - option "uJy/beam"
              - option "MJy/sr"
              - option "Jy/arcsec^2"
              - option "mJy/arcsec^2"
              - option "uJy/arcsec^2"
              - option "K"
              - option "mK"
            - img "Open dropdown"
            - text: Secondary info
            - checkbox
            - text: Rest-frame corrections
            - checkbox "X-axis"
            - text: ""
            - checkbox "Y-axis"
            - text: ""
        `);

        // change coordinate to Frequency (kHz) and check the data value
        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Frequency (kHz)');
        await expect(spectralProfileInfo).toContainText(
            'Data: (220400864.919 kHz, 6.30e-3)',
        );
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_freq_khz.png',
        );

        // enable secondary info and check the data value
        const conversionPanel = page.getByRole('tabpanel', {
            name: 'Conversion',
        });
        await conversionPanel
            .getByRole('checkbox')
            .first()
            .locator('..')
            .click();
        await expect(spectralProfileInfo).toContainText(
            'Data: (220400864.919 kHz, 220.400865 GHz, 6.30e-3)',
        );
        await conversionPanel
            .getByRole('checkbox')
            .first()
            .locator('..')
            .click();
        for (const axisIndex of [1, 2]) {
            const axisCheckbox = conversionPanel
                .getByRole('checkbox')
                .nth(axisIndex);
            await axisCheckbox.locator('..').click();
            await expect(axisCheckbox).toBeChecked();
            await axisCheckbox.locator('..').click();
        }

        // change coordinate and check the data value and take a screenshot
        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Radio velocity (km/s)');
        await expect(spectralProfileInfo).toContainText(
            'Data: (-2.972 km/s, 6.30e-3)',
        );
        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Vacuum wavelength (mm)');
        await expect(spectralProfileInfo).toContainText(
            'Data: (1.36021453 mm, 6.30e-3)',
        );
        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Air wavelength (nm)');
        await expect(spectralProfileInfo).toContainText(
            'Data: (1359823.42 nm, 6.30e-3)',
        );

        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Channel');
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_channel.png',
        );

        // change to LSRD and take a screenshot
        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Frequency (GHz)');
        await conversionPanel.getByRole('combobox').nth(1).selectOption('LSRD');
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_lsrd.png',
        );

        // change intensity unit to MJy/sr and take a screenshot
        await page
            .getByTestId('spectral-profiler-settings-intensity-unit-dropdown')
            .selectOption('MJy/sr');
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_barycent_MJy_sr.png',
        );
    });

    test('Spectral widget settings: styling and smoothing', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);

        const spectralProfileCanvas = page
            .getByTestId('spectral-profiler-0-content')
            .locator(
                '.line-plot-component > .annotation-stage > .konvajs-content > canvas',
            );

        await openPointSpectralProfiler(page, carta);

        // open settings and switch to styling tab
        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await page.getByRole('tab', { name: 'Styling' }).click();

        await expect(page.getByLabel('Styling')).toMatchAriaSnapshot(`
          - tabpanel "Styling":
            - text: Line color ( Primary )
            - combobox:
              - button
            - text: Line width (px)
            - group:
              - spinbutton "Line width"
              - button "increment"
              - button "decrement"
            - text: Point size (px)
            - group:
              - spinbutton "Point size" [disabled]
              - button "increment" [disabled]
              - button "decrement" [disabled]
            - text: Show mean/RMS
            - checkbox
            - text: Only visible in single profile Line style
            - button
            - button
            - button
            - text: ""
            - group:
              - spinbutton: /\\d+\\.\\d+/
            - text: ""
            - group:
              - spinbutton: /\\d+\\.\\d+/
            - text: ""
            - group:
              - spinbutton: /\\d+\\.\\d+/
            - text: ""
            - group:
              - spinbutton: /\\d+\\.\\d+/
            - text: Reset range
            - button "Reset range" [disabled]
        `);

        // change line color to red and check the data value and take a screenshot
        await page.locator('.bp6-button.colorselect').click();
        await page.locator('li:nth-child(5) > .bp6-menu-item').click();
        await page
            .getByTestId('profiler-settings-line-width-input-increment-button')
            .click();
        await page
            .getByTestId('profiler-settings-line-width-input-increment-button')
            .click();
        await expect(
            page.getByTestId('profiler-settings-line-width-input'),
        ).toHaveValue('2');
        await page
            .locator(
                '.line-settings-panel > div:nth-child(4) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_styling.png',
        );

        await page
            .locator(
                '.bp6-button-group.plot-type-selector > span:nth-child(3) > .bp6-button',
            )
            .click();

        const pointSize = page.getByRole('spinbutton', { name: 'Point size' });
        await page
            .getByLabel('Styling')
            .getByRole('button', { name: 'increment' })
            .nth(1)
            .click();
        await page
            .getByLabel('Styling')
            .getByRole('button', { name: 'increment' })
            .nth(1)
            .click();
        await expect(pointSize).toHaveValue('2.5');
        await expect(page.getByLabel('Styling')).toMatchAriaSnapshot(`
          - text: Line width (px)
          - group:
            - spinbutton "Line width" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          `);
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_scatter.png',
        );

        await page
            .locator(
                '.bp6-button-group.plot-type-selector > span:nth-child(2) > .bp6-button',
            )
            .click();
        const profileRanges = page
            .getByLabel('Styling')
            .getByRole('spinbutton');
        const rangeInputs = [2, 3, 4, 5].map((index) =>
            profileRanges.nth(index),
        );
        const originalRanges = await Promise.all(
            rangeInputs.map((input) => input.inputValue()),
        );
        await rangeInputs[0].fill('220.375');
        await rangeInputs[1].fill('220.395');
        await rangeInputs[2].fill('-0.018');
        await rangeInputs[3].fill('0.08');
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_boundary.png',
        );

        await page.getByRole('button', { name: 'Reset range' }).click();
        for (const [index, input] of rangeInputs.entries())
            await expect(input).toHaveValue(originalRanges[index]);

        await page.getByRole('tab', { name: 'Smoothing' }).click();
        await page
            .getByTestId('smoothing-settings-method-dropdown')
            .selectOption('Hanning');
        await expect(page.getByLabel('Smoothing')).toMatchAriaSnapshot(`
          - text: Method
          - combobox:
            - option "None"
            - option "Boxcar"
            - option "Gaussian"
            - option "Hanning" [selected]
            - option "Binning"
            - option "Savitzky-Golay"
            - option "Decimation"
          - img "Open dropdown"
          - text: Color
          - combobox:
            - button
          - text: Line style
          - button
          - button
          - button
          - text: Line width (px)
          - group:
            - spinbutton "Line width"
            - button "increment"
            - button "decrement"
          - text: Point size (px)
          - group:
            - spinbutton "Point size" [disabled]
            - button "increment" [disabled]
            - button "decrement" [disabled]
          - text: Overlay
          - checkbox
          - text: Kernel
          - group:
            - spinbutton: "3"
            - button "increment"
            - button "decrement" [disabled]
          `);
        await page
            .getByTestId('smoothing-settings-kernel-input-increment-button')
            .click();
        await page
            .getByTestId('smoothing-settings-kernel-input-increment-button')
            .click();
        await expect(
            page.getByTestId('smoothing-settings-kernel-input'),
        ).toHaveValue('7');
        await page
            .locator(
                '.smoothing-settings-panel > div:nth-child(6) > .bp6-form-content > .bp6-control > .bp6-control-indicator',
            )
            .click();
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_smoothing_Hanning.png',
        );

        await page
            .getByTestId('smoothing-settings-method-dropdown')
            .selectOption('Savitzky-Golay');
        await expect(page.getByLabel('Smoothing')).toMatchAriaSnapshot(`
          - text: Order of fitting
          - group:
            - spinbutton: "0"
            - button "increment"
            - button "decrement" [disabled]
          `);
        await page
            .getByTestId(
                'smoothing-settings-fitting-order-input-increment-button',
            )
            .click();
        await page
            .getByTestId(
                'smoothing-settings-fitting-order-input-increment-button',
            )
            .click();
        await expect(
            page.getByTestId('smoothing-settings-fitting-order-input'),
        ).toHaveValue('4');
        await page
            .getByTestId('smoothing-settings-line-width-input-increment-button')
            .click();
        await page
            .getByTestId('smoothing-settings-line-width-input-increment-button')
            .click();
        await expect(
            page.getByTestId('smoothing-settings-line-width-input'),
        ).toHaveValue('3');
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_smoothing_Savitzky-Golay.png',
        );

        await page
            .getByTestId('smoothing-settings-method-dropdown')
            .selectOption('Decimation');
        await page
            .getByTestId(
                'smoothing-settings-decimation-width-input-decrement-button',
            )
            .click();
        await page
            .getByTestId(
                'smoothing-settings-decimation-width-input-increment-button',
            )
            .click();
        await page
            .getByTestId(
                'smoothing-settings-decimation-width-input-increment-button',
            )
            .click();
        await expect(
            page.getByTestId('smoothing-settings-decimation-width-input'),
        ).toHaveValue('4');
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_smoothing_Decimation.png',
        );
    });

    test('Spectral widget settings: fitting', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        const spectralProfileCanvas = page
            .getByTestId('spectral-profiler-0-content')
            .locator(
                '.line-plot-component > .annotation-stage > .konvajs-content > canvas',
            );

        // Boot up CARTA application
        await carta.goto();

        // Load test data and create regions on the first image
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await page.evaluate(async () => {
            const frame = (window as any).app.activeFrame;
            await frame.regionSet.addRegionAsync(0, [{ x: 45, y: 45 }]);
        });
        await page.locator('#SpectralProfilerButton').click();
        await page
            .getByTestId('spectral-profiler-0-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await waitForSpectralProfile(page, 'HD163296_13CO_2-1_subimage.fits');

        // open settings and switch to styling tab
        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await page.getByRole('tab', { name: 'Fitting' }).click();
        await expect(page.getByLabel('Fitting')).toMatchAriaSnapshot(`
          - tabpanel "Fitting":
            - text: Data source
            - combobox:
              - option "HD163296_13CO_2-1_subimage.fits" [selected]
            - img "Open dropdown"
            - text: Profile function
            - combobox:
              - option "Gaussian" [selected]
              - option "Lorentzian"
            - img "Open dropdown"
            - text: Auto detect
            - button
            - checkbox "w/ cont."
            - text: w/ cont.
            - checkbox "Auto fit"
            - text: Auto fit Components
            - group:
              - spinbutton: "1"
              - button "increment"
              - button "decrement" [disabled]
            - text: Center
            - group:
              - textbox: "0"
            - button
            - button
            - text: Amplitude
            - group:
              - textbox: "0"
            - button
            - button
            - text: FWHM
            - group:
              - textbox: "0"
            - button
            - button
            - text: Continuum
            - combobox:
              - option "None" [selected]
              - option "0th order"
              - option "1st order"
            - img "Open dropdown"
            - text: Fitting result
            - button "Reset"
            - button "Fit" [disabled]
            - button "View log" [disabled]
            - checkbox "Residual" [checked]
            - text: Residual
        `);

        await page.getByTestId('profile-fitting-auto-detect-button').click();
        await expect
            .poll(() =>
                page
                    .getByTestId('profile-fitting-center-input')
                    .inputValue()
                    .then(Number),
            )
            .toBeGreaterThan(0);
        await expect
            .poll(() =>
                page
                    .getByTestId('profile-fitting-amplitude-input')
                    .inputValue()
                    .then(Number),
            )
            .toBeGreaterThan(0);
        await expect
            .poll(() =>
                page
                    .getByTestId('profile-fitting-fwhm-input')
                    .inputValue()
                    .then(Number),
            )
            .toBeGreaterThan(0);
        await expect(
            page.getByTestId('profile-fitting-component-input'),
        ).toHaveValue('1');
        await expect(
            page.getByTestId('profile-fitting-center-input'),
        ).not.toHaveValue('0');
        await expect(
            page.getByTestId('profile-fitting-amplitude-input'),
        ).not.toHaveValue('0');
        await expect(
            page.getByTestId('profile-fitting-fwhm-input'),
        ).not.toHaveValue('0');
        await expect(
            page.getByTestId('profile-fitting-fit-button'),
        ).toBeEnabled();
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_fitting_auto_detection.png',
        );
        const fwhmInput = page.getByTestId('profile-fitting-fwhm-input');
        const detectedFwhm = await fwhmInput.inputValue();
        await fwhmInput.fill('0');
        await fwhmInput.press('Tab');
        await expect(
            page.getByTestId('profile-fitting-fit-button'),
        ).toBeDisabled();
        await expect(page.getByTestId('profile-fitting-result')).toBeEmpty();
        await fwhmInput.fill(detectedFwhm);
        await fwhmInput.press('Tab');
        await expect(
            page.getByTestId('profile-fitting-fit-button'),
        ).toBeEnabled();
        // fit
        await page.getByTestId('profile-fitting-fit-button').click();
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Component #1 Center =',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Amplitude =',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'FWHM =',
        );
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_fitting1.png',
        );
        await expect(page.getByLabel('Fitting')).toMatchAriaSnapshot(`
          - button "Reset"
          - button "Fit"
          - button "View log"
          - checkbox "Residual" [checked]
          - text: Residual
          `);

        await page
            .locator('.component-input > .bp6-html-select > select')
            .selectOption('0');
        await page.getByTestId('profile-fitting-fit-button').click();
        await expect(page.getByLabel('Fitting')).toMatchAriaSnapshot(`
        - text: Y intercept
        - group:
            - textbox: "0"
        - button
        - button
        `);
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Y Intercept =',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Component #1 Center =',
        );
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_fitting2.png',
        );

        await page.getByTestId('profile-fitting-reset-button').click();
        await expect(page.getByTestId('profile-fitting-result')).toBeEmpty();

        // Auto-fit the same profile from a cleared fitting state.
        const fittingPanel = page.getByRole('tabpanel', { name: 'Fitting' });
        const autoFit = fittingPanel.getByRole('checkbox', {
            name: 'Auto fit',
        });
        await autoFit.locator('..').click();
        await expect(autoFit).toBeChecked();
        await page.getByTestId('profile-fitting-auto-detect-button').click();
        await expect
            .poll(() =>
                page
                    .getByTestId('profile-fitting-center-input')
                    .inputValue()
                    .then(Number),
            )
            .toBeGreaterThan(0);
        await expect(
            page.getByTestId('profile-fitting-component-input'),
        ).toHaveValue('1');
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Component #1 Center =',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Amplitude =',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'FWHM =',
        );
        await page.mouse.move(0, 0);
        await carta.closeWidget('spectral-profiler-0-floating-settings');
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_auto_fit.png',
        );
        await page.mouse.move(0, 0);
        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await page.getByRole('tab', { name: 'Fitting' }).click();
        await page.getByTestId('profile-fitting-reset-button').click();
        await expect(page.getByTestId('profile-fitting-result')).toBeEmpty();
        await expect(
            page.getByTestId('profile-fitting-fit-button'),
        ).toBeDisabled();
        await expect(
            page.getByRole('button', { name: 'View log' }),
        ).toBeDisabled();
    });

    test('Lorentzian fitting with linear continuum and residual toggle', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await page.evaluate(async () => {
            await (window as any).app.activeFrame.regionSet.addRegionAsync(0, [
                { x: 45, y: 45 },
            ]);
        });
        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await waitForSpectralProfile(page, 'HD163296_13CO_2-1_subimage.fits');

        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await page.getByRole('tab', { name: 'Fitting' }).click();
        const fitting = page.getByRole('tabpanel', { name: 'Fitting' });
        await fitting
            .getByRole('combobox')
            .nth(1)
            .selectOption({ label: 'Lorentzian' });
        await page.getByTestId('profile-fitting-auto-detect-button').click();
        await expect
            .poll(() =>
                page
                    .getByTestId('profile-fitting-fwhm-input')
                    .inputValue()
                    .then(Number),
            )
            .toBeGreaterThan(0);
        await fitting
            .getByRole('combobox')
            .nth(2)
            .selectOption({ label: '1st order' });
        await expect(
            page.getByTestId('profile-fitting-fit-button'),
        ).toBeEnabled();
        await page.getByTestId('profile-fitting-fit-button').click();
        const result = page.getByTestId('profile-fitting-result');
        await expect(result).toContainText('Y Intercept =');
        await expect(result).toContainText('Slope =');
        await expect(result).toContainText('Component #1 Center =');
        await expect(result).toContainText('FWHM =');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const fit = (
                        window as any
                    ).app.widgetsStore.spectralProfileWidgets.get(
                        'spectral-profiler-0',
                    ).fittingStore;
                    const data = Array.from(fit.originData.y as number[]);
                    const residual = Array.from(fit.resultResidual as number[]);
                    const rms = (values: number[]) =>
                        Math.sqrt(
                            values.reduce(
                                (sum, value) => sum + value * value,
                                0,
                            ) / values.length,
                        );
                    return {
                        hasResult: fit.hasResult,
                        points: residual.length,
                        improvesFit:
                            residual.length === data.length &&
                            rms(residual) < rms(data),
                    };
                }),
            )
            .toMatchObject({ hasResult: true, improvesFit: true });
        await page.getByRole('button', { name: 'View log' }).click();
        await expect(page.locator('.fitting-log-pre')).toContainText(
            'Lorentzian',
        );
        await page.keyboard.press('Escape');

        const plot = profiler.locator(
            '.line-plot-component .annotation-stage canvas',
        );
        await carta.closeWidget('spectral-profiler-0-floating-settings');
        await expect(plot).toHaveScreenshot(
            'spectral-lorentzian-fit-residual.png',
        );
        await page.mouse.move(0, 0);
        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await page.getByRole('tab', { name: 'Fitting' }).click();
        const residualSwitch = page.getByRole('checkbox', { name: 'Residual' });
        await residualSwitch.locator('..').click();
        await expect(residualSwitch).not.toBeChecked();
        await carta.closeWidget('spectral-profiler-0-floating-settings');
        await expect(plot).toHaveScreenshot(
            'spectral-lorentzian-fit-no-residual.png',
        );
        await carta.closeWidget('spectral-profiler');
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'spectral-lorentzian-fit-viewer.png',
        );
    });

    test('Gaussian fitting recovers a mock emission line', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const filename = 'gaussian-emission-line.fits';
        await carta.goto();
        await carta.loadImage(filename);
        await page.evaluate(async () => {
            const frame = (window as any).app.activeFrame;
            await frame.regionSet.addRegionAsync(0, [{ x: 8, y: 8 }]);
            frame.setCursorPosition({ x: 8, y: 8 });
            frame.updateCursorRegion({ x: 8, y: 8 });
        });
        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await profiler.getByTestId('spectral-profiler-region-dropdown').click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();
        await waitForSpectralProfile(page, filename);

        const profile = await page.evaluate(() => {
            const fitting = (
                window as any
            ).app.widgetsStore.spectralProfileWidgets.get('spectral-profiler-0')
                .fittingStore.fittingData;
            return {
                x: Array.from(fitting.x as number[]),
                y: Array.from(fitting.y as number[]),
            };
        });
        expect(profile.y).toHaveLength(31);
        expect(profile.x[15]).toBeCloseTo(0.985, 6);
        expect(profile.y[0]).toBeCloseTo(1, 4);
        expect(profile.y[12]).toBeCloseTo(1 + 6 * Math.exp(-0.5), 5);
        expect(profile.y[15]).toBeCloseTo(7, 5);
        expect(profile.y[18]).toBeCloseTo(1 + 6 * Math.exp(-0.5), 5);

        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await page.getByRole('tab', { name: 'Fitting' }).click();
        const fitting = page.getByRole('tabpanel', { name: 'Fitting' });
        await fitting
            .getByRole('combobox')
            .nth(1)
            .selectOption({ label: 'Gaussian' });
        const expectedFwhm = 0.001 * 3 * Math.sqrt(8 * Math.log(2));
        await fitting
            .getByRole('combobox')
            .nth(2)
            .selectOption({ label: '0th order' });
        await page
            .getByTestId('profile-fitting-center-input')
            .fill(String(profile.x[15]));
        await page.getByTestId('profile-fitting-amplitude-input').fill('6');
        await page
            .getByTestId('profile-fitting-fwhm-input')
            .fill(String(expectedFwhm));
        await fitting.getByRole('textbox').last().fill('1');
        await expect(
            page.getByTestId('profile-fitting-fit-button'),
        ).toBeEnabled();
        await page.getByTestId('profile-fitting-fit-button').click();
        const result = page.getByTestId('profile-fitting-result');
        await expect(result).toContainText('Component #1');
        await expect(result).toContainText('Y Intercept =');
        await expect(result).toContainText('Center =');
        await expect(result).toContainText('Amplitude =');
        await expect(result).toContainText('FWHM =');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const fit = (
                        window as any
                    ).app.widgetsStore.spectralProfileWidgets.get(
                        'spectral-profiler-0',
                    ).fittingStore;
                    const component = fit.components[0];
                    return {
                        hasResult: fit.hasResult,
                        yIntercept: fit.resultYIntercept,
                        center: component.resultCenter,
                        amplitude: component.resultAmp,
                        fwhm: component.resultFwhm,
                        residual: Array.from(fit.resultResidual as number[]),
                    };
                }),
            )
            .toMatchObject({ hasResult: true });

        const fitted = await page.evaluate(() => {
            const fit = (
                window as any
            ).app.widgetsStore.spectralProfileWidgets.get(
                'spectral-profiler-0',
            ).fittingStore;
            const component = fit.components[0];
            const residual = Array.from(fit.resultResidual as number[]);
            return {
                center: component.resultCenter,
                yIntercept: fit.resultYIntercept,
                amplitude: component.resultAmp,
                fwhm: component.resultFwhm,
                residualRms: Math.sqrt(
                    residual.reduce((sum, value) => sum + value * value, 0) /
                        residual.length,
                ),
            };
        });
        expect(fitted.center).toBeCloseTo(0.985, 5);
        expect(fitted.yIntercept).toBeCloseTo(1, 3);
        expect(fitted.amplitude).toBeCloseTo(6, 3);
        expect(fitted.fwhm).toBeCloseTo(expectedFwhm, 5);
        expect(fitted.residualRms).toBeLessThan(0.0001);

        await page.mouse.move(0, 0);
        await carta.closeWidget('spectral-profiler-0-floating-settings');
        const plot = profiler.locator(
            '.line-plot-component .annotation-stage canvas',
        );
        await expect(plot).toHaveScreenshot('gaussian-emission-line-fit.png');
        await page.keyboard.press('Escape');
        await page.mouse.move(0, 0);
        await carta.closeWidget('spectral-profiler');
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'gaussian-emission-line-viewer.png',
        );
    });

    test('Spectral profile connection', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        const spectralProfileCanvas = page.locator(
            '.floating-content > .spectral-profiler-widget .line-plot-component > .annotation-stage > .konvajs-content > canvas',
        );
        const imageCanvas = page.getByTestId('viewer-div');

        await openPointSpectralProfiler(page, carta, LayoutName.Default);

        await spectralProfileCanvas.click({
            position: {
                x: 675,
                y: 100,
            },
        });

        // click the spectral profile to select the channel and check if the image viewer is updated accordingly
        await page
            .getByTestId('animator-0-header-title')
            .getByText('Animator')
            .click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('26');
        await expect(
            page.getByTestId('animator-slider-info').locator('pre'),
        ).toContainText('LSRK 220.3945 GHz 5.6618 km/s');

        // check if animator slider is updated when clicking on the spectral profile
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3945 GHz;',
        );
        await carta.screenShot(
            imageCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_image.png',
        );

        // change channel to 40 and check if the spectral profile follows it
        await carta.setChannel(0, 40);
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('40');
        await expect(spectralProfileCanvas).toHaveScreenshot(
            'HD163296_13CO_2-1_subimage_spectral_profile_channel40.png',
            { maxDiffPixelRatio: 0.02 },
        );
    });
});

test.describe('Profiler Matching', () => {
    test('Spatial matching moves the viewer cursor and X profile with the reference', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const imageList = await openMatchingCubes(page, carta);
        await imageList.getByTestId('image-list-0-matching-xy').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.frames[1].spatialReference
                            ?.filename,
                ),
            )
            .toBe('cube.fits');
        await page.locator('#SpatialProfilerButton').click();
        const profiler = page.getByTestId('spatial-profiler-0-content');
        const profileInfo = profiler.getByTestId('x-profiler-info');

        await page.evaluate(() => {
            const reference = (window as any).app.frames[0];
            reference.setCursorPosition({ x: 6, y: 6 });
            reference.updateCursorRegion({ x: 6, y: 6 });
        });
        await expect(profileInfo).toContainText('Data:');
        const initialProfile = await profileInfo.textContent();

        await page.evaluate(() => {
            const reference = (window as any).app.frames[0];
            reference.setCenter(6, 6);
            reference.setCursorPosition({ x: 6, y: 10 });
            reference.updateCursorRegion({ x: 6, y: 10 });
        });
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const target = (window as any).app.frames[1];
                    return target.center.y;
                }),
            )
            .toBeCloseTo(6, 2);
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.frames[1].cursorInfo?.posImageSpace
                            .y,
                ),
            )
            .toBeCloseTo(10, 2);
        await expect(profileInfo).toContainText('Data:');
        await expect(profileInfo).toContainText('3.25');
        await expect
            .poll(() => profileInfo.textContent())
            .not.toBe(initialProfile);
        await expect(
            profiler.locator('.annotation-stage canvas'),
        ).toHaveScreenshot('spatial-matched-x-profile.png');
        await carta.closeWidget('spatial-profiler');
        await carta.closeWidget('layer-list');
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'spatial-matched-viewer.png',
        );
    });

    test('Spectral matching moves the viewer channel and spectral marker with the reference', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const imageList = await openMatchingCubes(page, carta);
        await page.evaluate(() => {
            const target = (window as any).app.frames[1];
            target.setCursorPosition({ x: 8, y: 6 });
            target.updateCursorRegion({ x: 8, y: 6 });
            (window as any).app.frames[0].setChannel(4);
        });
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.frames[1].channel),
            )
            .toBe(0);

        await imageList.getByTestId('image-list-0-matching-z').click();
        await page.locator('#SpectralProfilerButton').click();
        const profiler = page.getByTestId('spectral-profiler-0-content');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const target = (window as any).app.frames[1];
                    return {
                        reference: target.spectralReference?.filename,
                        channel: target.channel,
                    };
                }),
            )
            .toEqual({ reference: 'cube.fits', channel: 2 });
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Value:  1.1e+1 K',
        );
        await expect
            .poll(() =>
                page.evaluate(() =>
                    (window as any).app.widgetsStore.spectralProfileWidgets
                        .get('spectral-profiler-0')
                        ?.plotData?.data[0]?.map((point: any) => point.y),
                ),
            )
            .toEqual([2.75, 5.5, 11, 22, 44]);
        await expect(
            profiler.locator('.annotation-stage canvas'),
        ).toHaveScreenshot('spectral-matched-profile.png');
        await carta.closeWidget('spectral-profiler');
        await carta.closeWidget('layer-list');
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'spectral-matched-viewer.png',
        );
    });
});
