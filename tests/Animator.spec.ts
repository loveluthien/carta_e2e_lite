import { test, expect } from '@playwright/test';
import { LayoutName, PlaywrightDevPage } from '../utilities';

test.describe('Animator E2E Tests', () => {
    test('Channel change', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

        // Load test data cube
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        // // Open Animator tab
        // await page.getByTestId('animator-0-header-title').getByText('Animator').click();

        // Load Cube View layout
        await carta.applyLayout(LayoutName.CubeView);

        // Create a point region
        await page.getByTestId('point-region-shortcut-button').click();
        await page.locator('.region-stage > .konvajs-content > canvas').click({
            position: {
                x: 325,
                y: 175,
            },
        });

        // Change region for both spatial profilers
        await page
            .getByTestId('spatial-profiler-0-content')
            .getByTestId('region-dropdown')
            .selectOption('1');
        await page
            .getByTestId('spatial-profiler-1-content')
            .getByTestId('region-dropdown')
            .selectOption('1');

        // Change channel and check frequency and profiler data
        await page
            .locator('.bp6-slider-track > div:nth-child(3)')
            .first()
            .click();
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3877 GHz;',
        );
        await expect(
            page.getByTestId('x-profiler-info').locator('pre'),
        ).toContainText(
            'Data: (WCS: 17:56:21.406, Image: 108 px, -1.47251e-3)',
        );
        await expect(
            page.getByTestId('y-profiler-info').locator('pre'),
        ).toContainText('Data: (WCS: -21:57:22.51, Image: 99 px, -1.47251e-3)');
        await expect(
            page.getByTestId('spectral-profiler-info-0').locator('pre'),
        ).toContainText('Data: (220.387682 GHz, -1.47e-3)');
        await expect(
            page.getByTestId('animator-slider-info').locator('pre'),
        ).toContainText('LSRK 220.3877 GHz 14.9596 km/s');
        await carta.screenShot(viewerCanvas, 'Animator_ChannelChange_1.png');
        await carta.screenShot(
            page.locator(
                '.split-pane-pane > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
            ),
            'Animator_ChannelChange_1_SpectralProfiler.png',
        );

        await page
            .locator('.bp6-slider-track > div:nth-child(2)')
            .first()
            .click();
        await expect(
            page.getByTestId('x-profiler-info').locator('pre'),
        ).toContainText(
            'Data: (WCS: 17:56:21.406, Image: 108 px, -6.78828e-3)',
        );
        await expect(
            page.getByTestId('y-profiler-info').locator('pre'),
        ).toContainText('Data: (WCS: -21:57:22.51, Image: 99 px, -6.78828e-3)');
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3943 GHz;',
        );
        await expect(
            page.getByTestId('spectral-profiler-info-0').locator('pre'),
        ).toContainText('Data: (220.394274 GHz, -6.79e-3)');
        await expect(
            page.getByTestId('animator-slider-info').locator('pre'),
        ).toContainText('LSRK 220.3943 GHz 5.9938 km/s');
        await carta.screenShot(viewerCanvas, 'Animator_ChannelChange_2.png');
        await carta.screenShot(
            page.locator(
                '.split-pane-pane > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
            ),
            'Animator_ChannelChange_2_SpectralProfiler.png',
        );

        await page
            .locator('.bp6-slider-track > div:nth-child(3)')
            .first()
            .click();
        await page
            .locator('.bp6-slider-track > div:nth-child(3)')
            .first()
            .click();
        await page
            .locator('.bp6-slider-track > div:nth-child(2)')
            .first()
            .click();
        await expect(
            page.getByTestId('x-profiler-info').locator('pre'),
        ).toContainText('Data: (WCS: 17:56:21.406, Image: 108 px, 5.23558e-3)');
        await expect(
            page.getByTestId('y-profiler-info').locator('pre'),
        ).toContainText('Data: (WCS: -21:57:22.51, Image: 99 px, 5.23558e-3)');
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3901 GHz;',
        );
        await expect(
            page.getByTestId('spectral-profiler-info-0').locator('pre'),
        ).toContainText('Data: (220.390123 GHz, 5.24e-3)');
        await expect(
            page.getByTestId('animator-slider-info').locator('pre'),
        ).toContainText('LSRK 220.3901 GHz 11.6390 km/s');
        await carta.screenShot(viewerCanvas, 'Animator_ChannelChange_3.png');
        await carta.screenShot(
            page.locator(
                '.split-pane-pane > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
            ),
            'Animator_ChannelChange_3_SpectralProfiler.png',
        );
    });

    test('Image and stokes change', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

        // set default preferences
        await carta.setPreferenceDefaults();

        // Load test data cubes
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
        await carta.loadImage(
            'IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits',
            true,
        );

        await page
            .getByTestId('animator-0-header-title')
            .getByText('Animator')
            .click();

        await page
            .getByTestId('image-view-header-multipanel-view-switch')
            .click();
        await page.getByText('0', { exact: true }).first().click();
        await expect(page.getByTestId('animator-0-content')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        await expect(
            page.getByTestId('animator-slider-info').locator('pre'),
        ).toContainText('LSRK 220.4009 GHz -2.9720 km/s');
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_HD163296_13CO_2-1_subimage.png',
        );
        await expect(page.getByTestId('animator-0-content'))
            .toMatchAriaSnapshot(`
          - radio "Image"
          - text: Image 0 1
          - slider: "0"
          - text: HD163296_13CO_2-1_subimage.fits
          - radio "Channel" [checked]
          - text: /Channel 0 \\d+ \\d+ \\d+ \\d+/
          - slider: "0"
          - text: /LSRK \\d+\\.\\d+ GHz -\\d+\\.\\d+ km\\/s/
          - slider: "0"
          - slider: /\\d+/
          `);

        await page.getByText('1', { exact: true }).click();
        await expect(page.getByTestId('animator-0-content')).toContainText(
            'IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits',
        );
        await expect(
            page.getByTestId('animator-slider-info').locator('pre'),
        ).toContainText(/LSRK \d+\.\d+ GHz -?\d+\.\d+ km\/s/);
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_IQUV_subimage.png',
        );
        await expect(page.getByTestId('animator-0-content'))
            .toMatchAriaSnapshot(`
          - radio "Image"
          - text: Image 0 1
          - slider: "1"
          - text: IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits
          - radio "Channel" [checked]
          - text: /Channel 0 \\d+ \\d+ \\d+ \\d+/
          - slider: "0"
          - text: /LSRK \\d+\\.\\d+ GHz -?\\d+\\.\\d+ km\\/s/
          - slider: "0"
          - slider: /\\d+/
          - radio "Polarization"
          - text: Polarization Stokes I Stokes Q Stokes U Stokes V Ptotal Plinear PFtotal PFlinear Pangle
          - slider: Stokes I
          `);

        await page
            .getByTestId('animator-polarization-slider')
            .getByText('Stokes Q')
            .click();
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_IQUV_subimage_StokesQ.png',
        );
        await page
            .getByTestId('animator-polarization-slider')
            .getByText('Stokes U')
            .click();
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_IQUV_subimage_StokesU.png',
        );
        await page
            .getByTestId('animator-polarization-slider')
            .getByText('Stokes V')
            .click();
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_IQUV_subimage_StokesV.png',
        );
        await page
            .getByTestId('animator-polarization-slider')
            .getByText('Ptotal')
            .click();
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_IQUV_subimage_Ptotal.png',
        );
        await page
            .getByTestId('animator-polarization-slider')
            .getByText('Plinear')
            .click();
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_IQUV_subimage_Plinear.png',
        );
        await page
            .getByTestId('animator-polarization-slider')
            .getByText('Pangle')
            .click();
        await carta.screenShot(
            viewerCanvas,
            'Animator_ImageAndStokesChange_IQUV_subimage_Pangle.png',
        );
    });

    test('Animation play', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

        // Load test data cube
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        // Load Cube View layout
        await carta.applyLayout(LayoutName.CubeView);

        await page.getByTestId('animator-play-stop-button').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('animator-play-stop-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText(/(4|5)/);
        await carta.screenShot(viewerCanvas, 'Animator_AnimationPlay1.png');

        await page.getByTestId('animator-last-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('109');
        await page.getByTestId('animator-first-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('0');
        await carta.screenShot(viewerCanvas, 'Animator_AnimationPlay2.png');

        await page
            .getByTestId('animator-control-input-increment-button')
            .click();
        await page
            .getByTestId('animator-control-input-increment-button')
            .click();
        await expect(page.getByTestId('animator-control-input')).toHaveValue(
            '7',
        );
        await page.getByTestId('animator-control-input').fill('14');
        await page.getByTestId('animator-play-stop-button').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('animator-play-stop-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText(/(12|13)/);
        await carta.screenShot(viewerCanvas, 'Animator_AnimationPlay3.png');

        // Check step mode
        await page
            .getByTestId('animator-0-content')
            .getByRole('combobox')
            .selectOption('Step');
        await page
            .getByTestId('animator-control-input-increment-button')
            .click();
        await page
            .getByTestId('animator-control-input-increment-button')
            .click();
        await page.getByTestId('animator-play-stop-button').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('animator-play-stop-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText(/(51|54)/);

        // Check slider drag and drop
        await page.getByTestId('animator-first-button').click();
        await carta.sliderDragAndDrop(
            page,
            page.getByTestId('animator-slider').getByRole('slider'),
            150,
            0,
            1,
        );
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('37');
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3918 GHz;',
        );

        await page.waitForTimeout(100);
        await carta.sliderDragAndDrop(
            page,
            page.getByTestId('animator-slider').getByRole('slider'),
            100,
            0,
            1,
        );
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('61');
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3860 GHz;',
        );

        await page.waitForTimeout(100);
        await carta.sliderDragAndDrop(
            page,
            page.getByTestId('animator-slider').getByRole('slider'),
            -50,
            0,
            1,
        );
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('49');
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3889 GHz;',
        );

        // Play back mode
        await page
            .getByTestId('animator-0-content')
            .getByRole('combobox')
            .selectOption('Step');
        await page.getByTestId('animator-control-input').fill('1');
        await page
            .getByTestId('animator-0-content')
            .getByRole('combobox')
            .selectOption('Frame rate');
        await page.getByTestId('animator-control-input').fill('5');
        await page.getByTestId('animator-playback-mode-button').click();
        await page.getByRole('menuitem', { name: 'Play backwards' }).click();
        await page.getByTestId('animator-play-stop-button').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('animator-play-stop-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('45');
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK): 220.3899 GHz;',
        );

        // // Check bouncing mode
        await page.getByTestId('animator-first-button').click();
        await page
            .getByTestId('animator-0-content')
            .getByRole('combobox')
            .selectOption('Step');
        await page.getByTestId('animator-control-input').fill('20');
        await page.getByTestId('animator-playback-mode-button').click();
        await page.getByRole('menuitem', { name: 'Bouncing' }).click();
        await page.locator('.bp6-slider-progress.bp6-intent-primary').click();
        await page.getByTestId('animator-play-stop-button').click();
        await page.waitForTimeout(1000);
        await page.getByTestId('animator-play-stop-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText(/(75|95)/);

        // Check blink mode
        await page.getByTestId('animator-first-button').click();
        await page.getByTestId('animator-playback-mode-button').click();
        await page.getByRole('menuitem', { name: 'Blink' }).click();
        await page.getByTestId('animator-play-stop-button').click();
        await page.waitForTimeout(200);
        await page.getByTestId('animator-play-stop-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText(/(109)/);
        await page.getByTestId('animator-play-stop-button').click();
        await page.waitForTimeout(200);
        await page.getByTestId('animator-play-stop-button').click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText(/(55)/);
    });
});
