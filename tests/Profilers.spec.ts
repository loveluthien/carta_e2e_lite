import { test, expect, type Page } from '@playwright/test';
import { PlaywrightDevPage, LayoutName } from '../utilities';

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

test.describe('Spatial Profilers E2E set', () => {
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

test.describe('Spectral Profilers E2E set', () => {
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
        await page
            .locator(
                'div:nth-child(9) > .region-stage > .konvajs-content > canvas',
            )
            .click({
                position: {
                    x: 150,
                    y: 180,
                },
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
          - text: "/Data: \\\\(\\\\d+\\\\.\\\\d+ GHz, 1\\\\.80e-1\\\\)/"
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

    test('Spectral widget settings -- conversion', async ({ page }) => {
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
        await page.locator('#SpectralProfilerButton').click();
        await page
            .getByTestId('spectral-profiler-0-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();

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
            'Data: (220400864.919 kHz, 1.20e-1)',
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
            'Data: (220400864.919 kHz, 220.400865 GHz, 1.20e-1)',
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
            'Data: (-2.972 km/s, 1.20e-1)',
        );
        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Vacuum wavelength (mm)');
        await expect(spectralProfileInfo).toContainText(
            'Data: (1.36021453 mm, 1.20e-1)',
        );
        await page
            .getByRole('tabpanel', { name: 'Conversion' })
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Air wavelength (nm)');
        await expect(spectralProfileInfo).toContainText(
            'Data: (1359823.42 nm, 1.20e-1)',
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

    test('Spectral widget settings -- styling and smoothing', async ({
        page,
    }) => {
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
        await page.getByTestId('point-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 320,
                y: 100,
            },
        });
        await page.locator('#SpectralProfilerButton').click();
        await page
            .getByTestId('spectral-profiler-0-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();

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

    test('Spectral widget settings -- fitting', async ({ page }) => {
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

        await page.locator('div:nth-child(3) > .bp6-icon > svg > path').click();
        await page
            .getByTestId('spectral-profiler-0-header-close-button')
            .click();

        // Load another test data and create a region on the image
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

        // open settings and switch to fitting tab
        await page
            .getByTestId('spectral-profiler-0-header-settings-button')
            .click();
        await page.getByRole('tab', { name: 'Fitting' }).click();

        // auto fit
        const fittingPanel = page.getByRole('tabpanel', { name: 'Fitting' });
        await fittingPanel.getByRole('combobox').first().selectOption('1');
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
        await carta.screenShot(
            spectralProfileCanvas,
            'HD163296_13CO_2-1_subimage_spectral_profile_auto_fit.png',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Component #1 Center =',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'Amplitude =',
        );
        await expect(page.getByTestId('profile-fitting-result')).toContainText(
            'FWHM =',
        );
    });

    test('Spectral profile connection', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        const spectralProfileCanvas = page.locator(
            '.floating-content > .spectral-profiler-widget .line-plot-component > .annotation-stage > .konvajs-content > canvas',
        );
        const imageCanvas = page.getByTestId('viewer-div');

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
        await page.locator('#SpectralProfilerButton').click();
        await page
            .getByTestId('spectral-profiler-0-content')
            .getByTestId('spectral-profiler-region-dropdown')
            .click();
        await page
            .getByTestId('spectral-profiler-region-dropdown-region-1')
            .click();

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
