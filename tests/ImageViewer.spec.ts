import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test.describe('Image viewer E2E set', () => {
    test('Image Viewer', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

        // Load test data cube
        await carta.loadImage('M17_SWex.fits');
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
          - button ""
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
        await carta.screenShot(
            page.getByTestId('image-view-header-multipanel-view-switch'),
            'M17_SWex_viewer_multipanel_view_switch.png',
        );

        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);

        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        await page
            .getByTestId('image-view-header-multipanel-view-switch')
            .click();
        await carta.screenShot(
            page.getByTestId('image-view-header-multipanel-view-switch'),
            'M17_SWex_viewer_singlepanel_view_switch_button.png',
        );
        await expect(page.locator('.flexlayout__tab_toolbar').first())
            .toMatchAriaSnapshot(`
          - button ""
          - button ""
          - button ""
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
        await page
            .getByTestId('image-view-header-previous-page-button')
            .click();
        await carta.screenShot(viewerCanvas, 'M17_SWex_viewer.png');
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

    test('Image Viewer Toolbar', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

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

    test('Image Viewer Settings - Pan and Zoom', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

        // Load test data cube
        await carta.loadImage('M17_SWex.fits');

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
            page.locator(
                '[id="bp6-tab-panel_imageViewSettingsTabs_Pan and Zoom"]',
            ),
        ).toMatchAriaSnapshot(`
            - tabpanel:
              - text: Coordinate
              - radiogroup:
                - radio "Image"
                - text: Image
                - radio "World" [checked]
                - text: World
              - combobox:
                - option "Auto" [selected]
                - option "Ecliptic"
                - option "FK4"
                - option "FK5"
                - option "Galactic"
                - option "ICRS"
                - option "Image"
              - img "Open dropdown"
              - text: Center (X)
              - group:
                - textbox "X WCS coordinate": /\\d+:\\d+:\\d+\\.\\d+/
              - text: "/Image: \\\\d+\\\\.\\\\d+ px Center \\\\(Y\\\\)/"
              - group:
                - textbox "Y WCS coordinate": /-\\d+:\\d+:\\d+\\.\\d+/
              - text: "/Image: \\\\d+\\\\.\\\\d+ px Size \\\\(X\\\\)/"
              - group:
                - textbox "Width": /\\d+\\.\\d+'/
              - text: "/Image: \\\\d+\\\\.\\\\d+ px Size \\\\(Y\\\\)/"
              - group:
                - textbox "Height": /\\d+\\.\\d+'/
              - text: "/Image: \\\\d+\\\\.\\\\d+ px Offset coordinates/"
              - checkbox
        `);

        await expect(
            page.getByRole('textbox', { name: 'X WCS coordinate' }),
        ).toHaveValue('18:20:21.0138848648');
        await expect(
            page.getByRole('textbox', { name: 'Y WCS coordinate' }),
        ).toHaveValue('-16:12:10.2000000158');
        await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue(
            "9.9427516159'",
        );
        await expect(page.getByRole('textbox', { name: 'Height' })).toHaveValue(
            "5.3333333333'",
        );
        await page
            .getByRole('radiogroup')
            .getByText('Image', { exact: true })
            .click();
        await expect(
            page.getByRole('spinbutton', { name: 'X Coordinate' }),
        ).toHaveValue('319.5');
        await expect(
            page.getByRole('spinbutton', { name: 'Y Coordinate' }),
        ).toHaveValue('399.5');
        await expect(
            page.getByRole('spinbutton', { name: 'Width' }),
        ).toHaveValue('1491.4127423822715');
        await expect(
            page.getByRole('spinbutton', { name: 'Height' }),
        ).toHaveValue('800');
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
        ).toHaveValue('274.9233616872');
        await expect(
            page.getByRole('textbox', { name: 'Y WCS coordinate' }),
        ).toHaveValue('7.1495470092');
        await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue(
            "9.9427516159'",
        );
        await expect(page.getByRole('textbox', { name: 'Height' })).toHaveValue(
            "5.3333333333'",
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
        await page.locator('#numericInput-37').fill('10');
        await page.locator('#numericInput-38').fill('10');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_offset_galactic.png',
        );

        await page
            .locator('.bp6-collapse-body > .bp6-popover-target > .bp6-button')
            .click();
        await expect(page.locator('#numericInput-37')).toHaveValue(
            '15.0187522929',
        );
        await expect(page.locator('#numericInput-38')).toHaveValue(
            '-0.6683380389',
        );
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_de_offset_galactic.png',
        );
    });

    test('Image Viewer Settings - Global', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

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

        await page.getByRole('button', { name: 'increment' }).first().click();
        await expect(
            page.getByRole('spinbutton', { name: 'Columns' }),
        ).toHaveValue('3');
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_fixed_multi_panel_2x3.png',
        );
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
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

    test('Image Viewer Settings - Title and ticks', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

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
        await page.locator('#numericInput-29').fill('10');
        await page.locator('#numericInput-30').fill('2');
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
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_custom_color.png',
        );
        await page.getByRole('spinbutton', { name: 'Width' }).fill('3');
        await page.locator('#numericInput-11').fill('4');
        await page.getByRole('button', { name: 'decrement' }).nth(4).click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_ticks_custom_width.png',
        );
    });

    test('Image Viewer Settings - Grid', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

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
        await page.locator('#numericInput-29').fill('100');
        await page.locator('#numericInput-30').fill('50');
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

    test('Image Viewer Settings - Border and Axes', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

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
        await page.getByRole('button', { name: 'increment' }).click();
        await page.getByRole('button', { name: 'increment' }).click();

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
        await page.getByRole('button', { name: 'increment' }).click();
        await page.getByRole('button', { name: 'increment' }).click();

        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_axes.png',
        );
    });

    test('Image Viewer Settings - Numbers and Labels', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');

        // Boot up CARTA application
        await carta.goto();

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
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
        await expect(
            page.getByRole('spinbutton', { name: 'Precision' }),
        ).toHaveValue('2');

        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_numbers.png',
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

    test('Image Viewer Settings - Colorbar', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');
        const colorbarCanvas = page.locator('canvas').nth(5);

        // Boot up CARTA application
        await carta.goto();

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
            .locator(
                'div:nth-child(3) > .bp6-form-content > .bp6-html-select > select',
            )
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
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_viewer_settings_colorbar_position.png',
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
            .locator(
                'div:nth-child(3) > .bp6-form-content > .bp6-html-select > select',
            )
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
        await page.getByRole('button', { name: 'decrement' }).nth(5).click();
        await expect(page.locator('#numericInput-29')).toHaveValue('2');
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
        await carta.screenShot(
            colorbarCanvas,
            'M17_SWex_viewer_settings_colorbar_numbers.png',
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

    test('Image Viewer Settings - Beam', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.getByTestId('viewer-div');
        const colorbarCanvas = page.locator('canvas').nth(5);

        // Boot up CARTA application
        await carta.goto();

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

    test('Raster Configuration', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);
        const viewerCanvas = page.locator(
            '.region-stage > .konvajs-content > canvas',
        );
        const histogramCanvas = page
            .locator('.annotation-stage > .konvajs-content > canvas')
            .first();

        // Boot up CARTA application
        await carta.goto();

        // Load test data cube
        await carta.loadImage('M17_SWex.fits');

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

        await page
            .getByTestId('render-config-0-content')
            .getByRole('button', { name: 'increment' })
            .click();
        await page
            .getByTestId('render-config-0-content')
            .getByRole('button', { name: 'increment' })
            .click();
        await page
            .getByTestId('render-config-0-content')
            .getByRole('button', { name: 'increment' })
            .click();

        await page.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'seismic' }).click();
        await carta.screenShot(
            viewerCanvas,
            'M17_SWex_channel8_gamma_99_gamma_1.5_seismic.png',
        );
        await page.getByTestId('clip-button-99.99').click();

        await page.getByRole('button', { name: 'Bias / Contrast' }).click();
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
        await page.getByRole('button', { name: 'decrement' }).nth(1).click();
        await page.getByRole('button', { name: 'increment' }).nth(2).click();
        await page.getByRole('button', { name: 'increment' }).nth(2).click();
        await page.getByRole('button', { name: 'increment' }).nth(2).click();
        await page.getByRole('button', { name: 'increment' }).nth(2).click();
        await page.getByRole('button', { name: 'increment' }).nth(2).click();
        await page.getByRole('button', { name: 'increment' }).nth(2).click();
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

        await page.getByRole('button', { name: 'Gamma' }).click();
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
