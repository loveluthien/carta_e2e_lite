import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test.describe('CARTA Snippets E2E Suite', () => {
    test('Image properties', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

        await carta.fillSnippetInput(`
const file = await app.openFile("./carta_build/e2e-lite/test_data", "M17_SWex.fits"); 
file.setCenter(100, 100); 
file.setCenterWcs("18:20:09.52", "-16:10:09.8"); 
file.fitZoom(); file.zoomToSizeX(2000); 
file.zoomToSizeY(500); 
file.zoomToSizeXWcs(\`15'\`); 
file.zoomToSizeYWcs(\`120"\`); 
file.setChannel(12); 
        `);
        await page
            .getByTestId('animator-0-header-title')
            .getByText('Animator')
            .click();
        await expect(
            page.getByTestId('animator-slider').getByRole('slider'),
        ).toContainText('12');
        await carta.screenShot(viewerCanvas, 'snippets-image-properties.png');

        await carta.fillSnippetInput(`
const file = await app.openFile("./carta_build/e2e-lite/test_data", "IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits"); 
file.setStokes(2); file.setStokesByIndex(2); 
file.renderConfig.setCustomScale(-0.02, 0.03); 
ile.renderConfig.setPercentileRank(90); 
file.renderConfig.setScaling(1); 
file.renderConfig.setColorMap("gray"); 
file.renderConfig.setInverted(true);
            `);
        await expect(page.getByTestId('animator-polarization-slider'))
            .toMatchAriaSnapshot(`
          - radio "Polarization"
          - text: Polarization Stokes I Stokes Q Stokes U Stokes V Ptotal Plinear PFtotal PFlinear Pangle
          - slider: Stokes U
          `);
        await carta.screenShot(viewerCanvas, 'snippets-image-properties2.png');

        await page.getByText('0612182412').click();
    });

    test('Regions', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

        await carta.fillSnippetInput(`
const file = await app.openFile("./carta_build/e2e-lite/test_data", "M17_SWex.fits"); 
console.log(file.regionSet.regions); console.log(file.regionSet.selectedRegion); 
const regionSet = file.regionSet; 
const region = await regionSet.addRegionAsync(3, [{x: 200, y: 300}, {x: 50, y: 100}]); 
const region2 = await regionSet.addRegionAsync(1, [{x: 250, y: 300}, {x: 350, y: 400}]); 
region.setCenter({x: 0, y: 0}); 
region.setSize({x: 100, y: 100}); r
egion.setColor("#ffffff");
            `);
        await carta.screenShot(viewerCanvas, 'snippets-regions.png');
    });

    test('Moment images', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });

        const carta = new PlaywrightDevPage(page);
        const panelCanvas = page.locator('#image-panel-1-0 #overlay-canvas');

        // Boot up CARTA application
        await carta.goto();

        await carta.fillSnippetInput(`
// Open an image
const file = await app.openFile("./carta_build/e2e-lite/test_data", "M17_SWex.fits");

// Create a spectral profile settings widget
app.widgetsStore.createFloatingSpectralProfilerWidget();
app.widgetsStore.createFloatingSettingsWidget("", "spectral-profiler-0", "spectral-profiler");

// Get the SpectralProfileWidgetStore object
const spectralProfileWidget = app.widgetsStore.spectralProfileWidgets.get("spectral-profiler-0");

// Navigate to the moments tab
spectralProfileWidget.setSettingsTabId(3);

// Modify the configuration using SpectralProfileWidgetStore

spectralProfileWidget.clearSelectedMoments(); // remove default: integrated value of the spectrum
spectralProfileWidget.selectMoment(0); // mean value of the spectrum

// Generate a moment image
spectralProfileWidget.requestMoment();
            `);

        await carta.screenShot(panelCanvas, 'snippets-moment-images.png');
    });

    test('PV images', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const panelCanvas = page.locator('#image-panel-1-0 #overlay-canvas');

        // Boot up CARTA application
        await carta.goto();

        await carta.fillSnippetInput(`
// Open an image
const file = await app.openFile("./carta_build/e2e-lite/test_data", "M17_SWex.fits");

// Create a line region
const region = await file.regionSet.addRegionAsync(1, [{x: 180, y: 180}, {x: 350, y: 350}]);

// Create a pv generator widget
app.widgetsStore.createFloatingPvGeneratorWidget();

// Get the PvGeneratorWidgetStore object
const pvGeneratorWidget = app.widgetsStore.pvGeneratorWidgets.get("pv-generator-0");

// Generate a pv image
pvGeneratorWidget.setFileId(file.frameInfo.fileId);
pvGeneratorWidget.setRegionId(file.frameInfo.fileId, region.regionId);
pvGeneratorWidget.requestPV();
            `);
        await carta.screenShot(panelCanvas, 'snippets-pv-images.png');
    });

    test('Image fitting', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });

        const carta = new PlaywrightDevPage(page);

        // Boot up CARTA application
        await carta.goto();

        await carta.setPreferenceDefaults();

        await carta.fillSnippetInput(`
// Open an image
const file = await app.openFile("./carta_build/e2e-lite/test_data", "dice_four.fits");

// Display the fitting widget
app.dialogStore.showDialog("fitting-dialog");

// Set the number of Gaussian components
app.imageFittingStore.setComponents(4);

// Option 1: Fit the image with auto generated initial values
app.imageFittingStore.fitImage();

// Option 2: Fit the image without auto generated initial values
app.imageFittingStore.setIsAutoInitVal(false);

const component1 = app.imageFittingStore.components[0];
component1.setCenterX(25);
component1.setCenterY(75);
component1.setAmplitude(0.1);
component1.setFwhmX(5);
component1.setFwhmY(5);
component1.setPa(0);

const component2 = app.imageFittingStore.components[1];
component2.setCenterX(75);
component2.setCenterY(75);
component2.setAmplitude(0.1);
component2.setFwhmX(10);
component2.setFwhmY(10);
component2.setPa(0);

const component3 = app.imageFittingStore.components[2];
component3.setCenterX(25);
component3.setCenterY(25);
component3.setAmplitude(0.1);
component3.setFwhmX(5);
component3.setFwhmY(5);
component3.setPa(0);

const component4 = app.imageFittingStore.components[3];
component4.setCenterX(75);
component4.setCenterY(25);
component4.setAmplitude(0.1);
component4.setFwhmX(5);
component4.setFwhmY(5);
component4.setPa(0);

app.imageFittingStore.fitImage();
        `);

        await expect(
            page.getByTestId('image-fitting-result-tab'),
        ).toMatchAriaSnapshot(
            `- text: "/Component #1: Center X = 6:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(s\\\\) Center Y = \\\\d+:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) Amplitude = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\/beam\\\\) FWHM Major Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) FWHM Minor Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) P\\\\.A\\\\. = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(deg\\\\) Integrated flux = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\) Component #2: Center X = 6:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(s\\\\) Center Y = \\\\d+:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) Amplitude = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\/beam\\\\) FWHM Major Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) FWHM Minor Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) P\\\\.A\\\\. = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(deg\\\\) Integrated flux = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\) Component #3: Center X = 6:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(s\\\\) Center Y = \\\\d+:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) Amplitude = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\/beam\\\\) FWHM Major Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) FWHM Minor Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) P\\\\.A\\\\. = -\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(deg\\\\) Integrated flux = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\) Component #4: Center X = 6:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(s\\\\) Center Y = \\\\d+:\\\\d+:\\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) Amplitude = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\/beam\\\\) FWHM Major Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) FWHM Minor Axis = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(arcsec\\\\) P\\\\.A\\\\. = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(deg\\\\) Integrated flux = \\\\d+\\\\.\\\\d+ ± \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\) Background = \\\\d+\\\\.\\\\d+ \\\\(Jy\\\\/beam\\\\) \\\\(fixed\\\\)/"`,
        );

        await page
            .getByTestId('image-view-header-multipanel-view-switch')
            .click();
        await page.getByTestId('image-view-header-next-page-button').click();
        await carta.screenShot(
            page.locator('.region-stage > .konvajs-content > canvas'),
            'snippets-image-fitting-model.png',
        );
        await page.getByTestId('image-view-header-next-page-button').click();
        await carta.screenShot(
            page.locator('.region-stage > .konvajs-content > canvas'),
            'snippets-image-fitting-residuals.png',
        );
    });

    test('Color blending', async ({ page }) => {
        const viewerCanvas = page.getByTestId('viewer-div');
        const panelCanvas11 = page.locator('#image-panel-1-0 #overlay-canvas');

        await page.setViewportSize({ width: 1920, height: 1080 });

        const carta = new PlaywrightDevPage(page);

        // Boot up CARTA application
        await carta.goto();

        await carta.setPreferenceDefaults();

        await carta.fillSnippetInput(`
// Open three images
const file1 = await app.openFile("./carta_build/e2e-lite/test_data", "m16_f0770w.fits");
const file2 = await app.appendFile("./carta_build/e2e-lite/test_data", "m16_f1130w.fits");
const file3 = await app.appendFile("./carta_build/e2e-lite/test_data", "m16_f1500w.fits");

// Match images
file2.setSpatialReference(file1);
file3.setSpatialReference(file1);

// Create a color blended image
const colorBlendingStore = app.imageViewConfigStore.createColorBlending();
console.log(colorBlendingStore.frames.length); // 3            
            `);

        await carta.screenShot(panelCanvas11, 'snippets-color-blending1.png');

        await carta.fillSnippetInput(`
// Open three images
const file1 = await app.openFile("./carta_build/e2e-lite/test_data", "m16_f0770w.fits");
const file2 = await app.appendFile("./carta_build/e2e-lite/test_data", "m16_f1130w.fits");
const file3 = await app.appendFile("./carta_build/e2e-lite/test_data", "m16_f1500w.fits");

// Match images
file2.setSpatialReference(file1);
file3.setSpatialReference(file1);

// Create a color blended image
const colorBlendingStore = app.imageViewConfigStore.createColorBlending();
console.log(colorBlendingStore.frames.length); // 3                   
app.imageViewConfigStore.removeColorBlending(colorBlendingStore);
            `);

        await carta.screenShot(viewerCanvas, 'snippets-color-blending2.png');

        await carta.fillSnippetInput(`
// Open three images
const file1 = await app.openFile("./carta_build/e2e-lite/test_data", "m16_f0770w.fits");
const file2 = await app.appendFile("./carta_build/e2e-lite/test_data", "m16_f1130w.fits");
const file3 = await app.appendFile("./carta_build/e2e-lite/test_data", "m16_f1500w.fits");

// Match images
file2.setSpatialReference(file1);
file3.setSpatialReference(file1);

// Create a color blended image
const colorBlendingStore = app.imageViewConfigStore.createColorBlending();

// Add a new layer
const file4 = await app.appendFile("./carta_build/e2e-lite/test_data", "m16_f0444w.fits");
file4.setSpatialReference(file1);
colorBlendingStore.addSelectedFrame(file4);

// Delete a layer
colorBlendingStore.deleteSelectedFrame(2); // The fourth layer (the third selected layer)

// Set alpha
colorBlendingStore.setAlpha(0, 0.5); // The base layer
colorBlendingStore.setAlpha(1, 0.7); // The second layer
            `);

        await carta.setMultiPanelLayout(2, 3);
        await carta.screenShot(viewerCanvas, 'snippets-color-blending3.png');
    });
});
