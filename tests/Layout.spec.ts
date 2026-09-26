import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

test.describe('Layout', () => {
    test('CARTA provided layout', async ({ page }) => {
        const devPage = new PlaywrightDevPage(page);
        await devPage.goto();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();

        await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - menu:
        - menuitem "File"
      - menu:
        - menuitem "View"
      - menu:
        - menuitem "Widgets"
      - menu:
        - menuitem "Snippets"
      - menu:
        - menuitem "Help"
      - button [disabled]
      - button [disabled]:
        - img
      - button [disabled]
      - button [disabled]
      - button [disabled]
      - button [disabled]:
        - img
      - button [disabled]
      - button:
        - img
      - button
      - button:
        - img
      - button:
        - img
      - button
      - button
      - button
      - button
      - button
      - button:
        - img
      - button
      - button
      - button:
        - img
      - button:
        - img
      - button:
        - img
      - button [disabled]
      - button
      - button [disabled]:
        - img
      - button [disabled]:
        - img
      - button [disabled]:
        - img: xy
      - button
      - button
      - text: FindBorderBarSize No image loaded
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
      - text: Render Configuration
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - text: "X Profile: Cursor"
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - text: "Y Profile: Cursor"
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - text: Image List
      - img
      - text: Animator
      - img
      - text: Region List
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - heading "No file loaded" [level=4]
      - text: Load a file using the menu
      - heading "No file loaded" [level=4]
      - text: Load a file using the menu Image
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - text: Region
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - img
      - text: Image
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - text: Region
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - img
      - heading "No file loaded" [level=4]
      - text: "Load a file using the menu No image loaded Render Configuration X Profile: Cursor Y Profile: Cursor Image List Animator Region List"
      `);

        await page.getByRole('menuitem', { name: 'View' }).click();
        await page.getByRole('menuitem', { name: 'Layout' }).click();
        await page.getByRole('button', { name: 'Apply' }).nth(1).click();
        await page.getByTestId('layout-dialog-header-close-button').click();
        await expect(page.locator('#root')).toMatchAriaSnapshot(`
        - menu:
            - menuitem "File"
        - menu:
            - menuitem "View"
        - menu:
            - menuitem "Widgets"
        - menu:
            - menuitem "Snippets"
        - menu:
            - menuitem "Help"
        - button [disabled]
        - button [disabled]:
            - img
        - button [disabled]
        - button [disabled]
        - button [disabled]
        - button [disabled]:
            - img
        - button [disabled]
        - button:
            - img
        - button
        - button:
            - img
        - button:
            - img
        - button
        - button
        - button
        - button
        - button
        - button:
            - img
        - button
        - button
        - button:
            - img
        - button:
            - img
        - button:
            - img
        - button [disabled]
        - button
        - button [disabled]:
            - img
        - button [disabled]:
            - img
        - button [disabled]:
            - img: xy
        - button
        - button
        - text: FindBorderBarSize No image loaded
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
        - text: Animator
        - img
        - text: Render Configuration
        - img
        - text: Region List
        - img
        - text: Image List
        - img
        - button ""
        - button ""
        - button "Maximise":
            - img
        - text: "X Profile: Cursor"
        - img
        - button ""
        - button ""
        - button ""
        - button "Maximise":
            - img
        - text: "Y Profile: Cursor"
        - img
        - button ""
        - button ""
        - button ""
        - button "Maximise":
            - img
        - text: Z Profile
        - img
        - button ""
        - button ""
        - button ""
        - button "Maximise":
            - img
        - heading "No file loaded" [level=4]
        - text: Load a file using the menu
        - heading "No file loaded" [level=4]
        - text: Load a file using the menu Image
        - combobox [disabled]:
            - option "Active" [selected]
        - img "Open dropdown"
        - text: Region
        - combobox [disabled]:
            - option "Active" [selected]
        - img "Open dropdown"
        - img
        - text: Image
        - combobox [disabled]:
            - option "Active" [selected]
        - img "Open dropdown"
        - text: Region
        - combobox [disabled]:
            - option "Active" [selected]
        - img "Open dropdown"
        - img
        - checkbox "Image" [disabled]
        - text: Image
        - button "Active" [disabled]
        - checkbox "Region" [disabled]
        - text: Region
        - button "Active" [disabled]
        - checkbox "Statistic" [disabled]
        - text: Statistic
        - button "Mean" [disabled]
        - checkbox "Polarization" [disabled]
        - text: Polarization
        - button "Current" [disabled]
        - button:
            - img
        - button:
            - img
        - button:
            - img: z
        - img
        - separator "horizontal divider 1"
        - text: "No image loaded Animator Render Configuration Region List Image List X Profile: Cursor Y Profile: Cursor Z Profile"
        `);

        await page.getByRole('menuitem', { name: 'View' }).click();
        await page.getByRole('menuitem', { name: 'Layout' }).click();
        await page.getByRole('button', { name: 'Apply' }).nth(2).click();
        await page.getByTestId('layout-dialog-header-close-button').click();
        await expect(page.locator('#root')).toMatchAriaSnapshot(`
            - menu:
            - menuitem "File"
            - menu:
            - menuitem "View"
            - menu:
            - menuitem "Widgets"
            - menu:
            - menuitem "Snippets"
            - menu:
            - menuitem "Help"
            - button [disabled]
            - button [disabled]:
            - img
            - button [disabled]
            - button [disabled]
            - button [disabled]
            - button [disabled]:
            - img
            - button [disabled]
            - button:
            - img
            - button
            - button:
            - img
            - button:
            - img
            - button
            - button
            - button
            - button
            - button
            - button:
            - img
            - button
            - button
            - button:
            - img
            - button:
            - img
            - button:
            - img
            - button [disabled]
            - button
            - button [disabled]:
            - img
            - button [disabled]:
            - img
            - button [disabled]:
            - img: xy
            - button
            - button
            - text: FindBorderBarSize No image loaded
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
            - text: Animator
            - img
            - text: Render Configuration
            - img
            - text: Region List
            - img
            - text: Image List
            - img
            - button ""
            - button ""
            - button "Maximise":
            - img
            - text: Z Profile
            - img
            - button ""
            - button ""
            - button ""
            - button "Maximise":
            - img
            - text: Statistics
            - img
            - button ""
            - button ""
            - button "Maximise":
            - img
            - heading "No file loaded" [level=4]
            - text: Load a file using the menu
            - heading "No file loaded" [level=4]
            - text: Load a file using the menu
            - checkbox "Image" [disabled]
            - text: Image
            - button "Active" [disabled]
            - checkbox "Region" [disabled]
            - text: Region
            - button "Active" [disabled]
            - checkbox "Statistic" [disabled]
            - text: Statistic
            - button "Mean" [disabled]
            - checkbox "Polarization" [disabled]
            - text: Polarization
            - button "Current" [disabled]
            - button:
            - img
            - button:
            - img
            - button:
            - img: z
            - img
            - separator "horizontal divider 1"
            - text: Image
            - combobox [disabled]:
            - option "Active" [selected]
            - img "Open dropdown"
            - text: Region
            - combobox [disabled]:
            - option "Active" [selected]
            - img "Open dropdown"
            - text: Polarization
            - combobox [disabled]:
            - option "Current" [selected]
            - img "Open dropdown"
            - heading "No stats data" [level=4]
            - text: Select a valid region from the dropdown No image loaded Animator Render Configuration Region List Image List Z Profile Statistics
            `);

        await page.getByRole('menuitem', { name: 'View' }).click();
        await page.getByRole('menuitem', { name: 'Layout' }).click();
        await page.getByRole('button', { name: 'Apply' }).nth(3).click();
        await page.getByTestId('layout-dialog-header-close-button').click();
        await expect(page.locator('#root')).toMatchAriaSnapshot(`
        - menu:
        - menuitem "File"
        - menu:
        - menuitem "View"
        - menu:
        - menuitem "Widgets"
        - menu:
        - menuitem "Snippets"
        - menu:
        - menuitem "Help"
        - button [disabled]
        - button [disabled]:
        - img
        - button [disabled]
        - button [disabled]
        - button [disabled]
        - button [disabled]:
        - img
        - button [disabled]
        - button:
        - img
        - button
        - button:
        - img
        - button:
        - img
        - button
        - button
        - button
        - button
        - button
        - button:
        - img
        - button
        - button
        - button:
        - img
        - button:
        - img
        - button:
        - img
        - button [disabled]
        - button
        - button [disabled]:
        - img
        - button [disabled]:
        - img
        - button [disabled]:
        - img: xy
        - button
        - button
        - text: FindBorderBarSize No image loaded
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
        - text: Render Configuration
        - img
        - text: Region List
        - img
        - text: Animator
        - img
        - text: Image List
        - img
        - button ""
        - button ""
        - button ""
        - button "Maximise":
        - img
        - text: "X Profile: Cursor"
        - img
        - button ""
        - button ""
        - button ""
        - button "Maximise":
        - img
        - text: "Y Profile: Cursor"
        - img
        - button ""
        - button ""
        - button ""
        - button "Maximise":
        - img
        - text: Statistics
        - img
        - button ""
        - button ""
        - button "Maximise":
        - img
        - heading "No file loaded" [level=4]
        - text: Load a file using the menu
        - heading "No file loaded" [level=4]
        - text: Load a file using the menu Image
        - combobox [disabled]:
        - option "Active" [selected]
        - img "Open dropdown"
        - text: Region
        - combobox [disabled]:
        - option "Active" [selected]
        - img "Open dropdown"
        - img
        - text: Image
        - combobox [disabled]:
        - option "Active" [selected]
        - img "Open dropdown"
        - text: Region
        - combobox [disabled]:
        - option "Active" [selected]
        - img "Open dropdown"
        - img
        - text: Image
        - combobox [disabled]:
        - option "Active" [selected]
        - img "Open dropdown"
        - text: Region
        - combobox [disabled]:
        - option "Active" [selected]
        - img "Open dropdown"
        - text: Polarization
        - combobox [disabled]:
        - option "Current" [selected]
        - img "Open dropdown"
        - heading "No stats data" [level=4]
        - text: "Select a valid region from the dropdown No image loaded Render Configuration Region List Animator Image List X Profile: Cursor Y Profile: Cursor Statistics"
        `);

        await page.getByRole('menuitem', { name: 'View' }).click();
        await page.getByRole('menuitem', { name: 'Layout' }).click();
        await page.getByRole('button', { name: 'Apply' }).first().click();
        await page.getByTestId('layout-dialog-header-close-button').click();
        await page
            .locator(
                'div:nth-child(3) > div > .flexlayout__tabset > .flexlayout__tabset_tabbar_outer > .flexlayout__mini_scrollbar_container > .flexlayout__tabset_tabbar_inner > .flexlayout__tabset_tabbar_inner_tab_container > .flexlayout__tab_button > .flexlayout__tab_button_trailing > svg > path:nth-child(2)',
            )
            .first()
            .click();
        await page
            .locator(
                'div:nth-child(3) > div > .flexlayout__tabset > .flexlayout__tabset_tabbar_outer > .flexlayout__mini_scrollbar_container > .flexlayout__tabset_tabbar_inner > .flexlayout__tabset_tabbar_inner_tab_container > .flexlayout__tab_button > .flexlayout__tab_button_trailing > svg',
            )
            .first()
            .click();
        await page
            .locator('.flexlayout__tab_button_trailing > svg')
            .first()
            .click();
        await expect(page.locator('#root')).toMatchAriaSnapshot(`
        - menu:
            - menuitem "File"
        - menu:
            - menuitem "View"
        - menu:
            - menuitem "Widgets"
        - menu:
            - menuitem "Snippets"
        - menu:
            - menuitem "Help"
        - button [disabled]
        - button [disabled]:
            - img
        - button [disabled]
        - button [disabled]
        - button [disabled]
        - button [disabled]:
            - img
        - button [disabled]
        - button:
            - img
        - button
        - button:
            - img
        - button:
            - img
        - button
        - button
        - button
        - button
        - button
        - button:
            - img
        - button
        - button
        - button:
            - img
        - button:
            - img
        - button:
            - img
        - button [disabled]
        - button
        - button [disabled]:
            - img
        - button [disabled]:
            - img
        - button [disabled]:
            - img: xy
        - button
        - button
        - text: FindBorderBarSize No image loaded
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
        - text: Image List
        - img
        - text: Animator
        - img
        - text: Region List
        - img
        - button ""
        - button ""
        - button ""
        - button "Maximise":
            - img
        - heading "No file loaded" [level=4]
        - text: Load a file using the menu
        - heading "No file loaded" [level=4]
        - text: Load a file using the menu No image loaded Image List Animator Region List
    `);
    });

    test('Drag and dock', async ({ page }) => {
        const devPage = new PlaywrightDevPage(page);
        await devPage.goto();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();

        await page.locator('#SpatialProfilerButton').click();
        await page.locator('#SpectralProfilerButton').click();
        const xProfiler = page
            .locator('div')
            .filter({ hasText: /^X Profile: Cursor$/ })
            .nth(4);
        await devPage.dragAndDock(
            page.locator('#SpectralProfilerButton'),
            xProfiler,
        );

        await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - menu:
        - menuitem "File"
      - menu:
        - menuitem "View"
      - menu:
        - menuitem "Widgets"
      - menu:
        - menuitem "Snippets"
      - menu:
        - menuitem "Help"
      - button [disabled]
      - button [disabled]:
        - img
      - button [disabled]
      - button [disabled]
      - button [disabled]
      - button [disabled]:
        - img
      - button [disabled]
      - button:
        - img
      - button
      - button:
        - img
      - button:
        - img
      - button
      - button
      - button
      - button
      - button
      - button:
        - img
      - button
      - button
      - button:
        - img
      - button:
        - img
      - button:
        - img
      - button [disabled]
      - button
      - button [disabled]:
        - img
      - button [disabled]:
        - img
      - button [disabled]:
        - img: xy
      - button
      - button
      - text: FindBorderBarSize No image loaded
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
      - text: Render Configuration
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - text: "X Profile: Cursor"
      - img
      - text: Z Profile
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - text: "Y Profile: Cursor"
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - text: Image List
      - img
      - text: Animator
      - img
      - text: Region List
      - img
      - button ""
      - button ""
      - button ""
      - button "Maximise":
        - img
      - heading "No file loaded" [level=4]
      - text: Load a file using the menu
      - heading "No file loaded" [level=4]
      - text: Load a file using the menu Image
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - text: Region
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - img
      - heading "No file loaded" [level=4]
      - text: Load a file using the menu
      - checkbox "Image" [disabled]
      - text: Image
      - button "Active" [disabled]
      - checkbox "Region" [disabled]
      - text: Region
      - button "Active" [disabled]
      - checkbox "Statistic" [disabled]
      - text: Statistic
      - button "Mean" [disabled]
      - checkbox "Polarization" [disabled]
      - text: Polarization
      - button "Current" [disabled]
      - button:
        - img
      - button:
        - img
      - button:
        - img: z
      - img
      - separator "horizontal divider 1"
      - text: "No image loaded Render Configuration X Profile: Cursor Z Profile Y Profile: Cursor Image List Animator Region List X Profile: Cursor Image"
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - text: Region
      - combobox [disabled]:
        - option "Active" [selected]
      - img "Open dropdown"
      - img
      - text: Z Profile
      - checkbox "Image" [disabled]
      - text: Image
      - button "Active" [disabled]
      - checkbox "Region" [disabled]
      - text: Region
      - button "Active" [disabled]
      - checkbox "Statistic" [disabled]
      - text: Statistic
      - button "Mean" [disabled]
      - checkbox "Polarization" [disabled]
      - text: Polarization
      - button "Current" [disabled]
      - button:
        - img
      - button:
        - img
      - button:
        - img: z
      - img
      - separator "horizontal divider 1"
      `);
    });

    test('Drag to new column', async ({ page }) => {
        const devPage = new PlaywrightDevPage(page);
        await devPage.goto();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();

        const source = page.locator('#SpectralProfilerButton');
        const steps = 5;
        const viewportSize = page.viewportSize();
        await source.hover();
        await page.mouse.down();
        await page.mouse.move(5, (viewportSize!.height - 40) / 2, {
            steps: steps,
        });
        await page.mouse.up();
    });
});

test.describe('Menu bar', () => {
    test('Menu bar items', async ({ page }) => {
        const carta = new PlaywrightDevPage(page);

        // Boot up CARTA application
        await carta.goto();

        await expect(page.locator('#root')).toMatchAriaSnapshot(`
          - menu:
            - menuitem "File"
          - menu:
            - menuitem "View"
          - menu:
            - menuitem "Widgets"
          - menu:
            - menuitem "Snippets"
          - menu:
            - menuitem "Help"
          - button [disabled]
          - button [disabled]:
            - img
          - button [disabled]
          - button [disabled]
          - button [disabled]
          - button [disabled]:
            - img
          - button [disabled]
          - button:
            - img
          - button
          - button:
            - img
          - button:
            - img
          - button
          - button
          - button
          - button
          - button
          - button:
            - img
          - button
          - button
          - button:
            - img
          - button:
            - img
          - button:
            - img
          - button [disabled]
          - button
          - button [disabled]:
            - img
          - button [disabled]:
            - img
          - button [disabled]:
            - img: xy
          - button
          - button
          `);

        await page.getByRole('menuitem', { name: 'File' }).click();
        await expect(page.getByText('Open Imagealt + OAppend'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Open Image alt + O"
            - menuitem "Append Image alt + L" [disabled]
            - menuitem "Save Image alt + S" [disabled]
            - menuitem "Close Image alt + W" [disabled]
            - menuitem "Multi-Color Blending" [disabled]
            - separator
            - menuitem "Import Regions" [disabled]
            - menuitem "Export Regions" [disabled]
            - menuitem "Import Catalog alt + G" [disabled]
            - menuitem "Export Image Open sub menu":
              - text: ""
              - img "Open sub menu"
            - separator
            - menuitem "Open Workspace"
            - menuitem "Save Workspace"
            - separator
            - menuitem "Preferences"
            - menuitem "Server Open sub menu":
              - text: ""
              - img "Open sub menu"
        `);
        await page.getByRole('menuitem', { name: 'View' }).click();
        await expect(page.getByText('ThemeOpen sub menuLayoutFile'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Theme Open sub menu":
              - text: ""
              - img "Open sub menu"
            - menuitem "Layout"
            - menuitem "File Header" [disabled]
            - menuitem "Contours" [disabled]
            - menuitem "Vector Overlay" [disabled]
            - menuitem "Image Fitting" [disabled]
            - menuitem "Online Data Query"
            - menuitem "Code Snippets"
        `);

        // Load test data and create regions on the first image
        await carta.loadImage('HD163296_13CO_2-1_subimage.fits');

        await expect(page.locator('#root')).toMatchAriaSnapshot(`
          - menu:
            - menuitem "File"
          - menu:
            - menuitem "View"
          - menu:
            - menuitem "Widgets"
          - menu:
            - menuitem "Snippets"
          - menu:
            - menuitem "Help"
          - button
          - button:
            - img
          - button
          - button
          - button
          - button:
            - img
          - button
          - button:
            - img
          - button
          - button:
            - img
          - button:
            - img
          - button
          - button
          - button
          - button
          - button
          - button:
            - img
          - button
          - button
          - button:
            - img
          - button:
            - img
          - button:
            - img
          - button
          - button
          - button:
            - img
          - button:
            - img
          - button:
            - img: xy
          - button
          - button
          `);

        await page.getByRole('menuitem', { name: 'File' }).click();
        await expect(page.getByText('Open Imagealt + OAppend'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Open Image alt + O"
            - menuitem "Append Image alt + L"
            - menuitem "Save Image alt + S"
            - menuitem "Close Image alt + W"
            - menuitem "Multi-Color Blending"
            - separator
            - menuitem "Import Regions"
            - menuitem "Export Regions" [disabled]
            - menuitem "Import Catalog alt + G"
            - menuitem "Export Image Open sub menu":
              - text: ""
              - img "Open sub menu"
            - separator
            - menuitem "Open Workspace"
            - menuitem "Save Workspace"
            - separator
            - menuitem "Preferences"
            - menuitem "Server Open sub menu":
              - text: ""
              - img "Open sub menu"
        `);

        await page.getByRole('menuitem', { name: 'View' }).click();
        await expect(
            page.getByText(
                'ThemeOpen sub menuLayoutImagesOpen sub menuFile HeaderContoursVector',
            ),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Theme Open sub menu":
              - text: ""
              - img "Open sub menu"
            - menuitem "Layout"
            - menuitem "Images Open sub menu":
              - text: ""
              - img "Open sub menu"
            - menuitem "File Header"
            - menuitem "Contours"
            - menuitem "Vector Overlay"
            - menuitem "Image Fitting"
            - menuitem "Online Data Query"
            - menuitem "Code Snippets"
        `);

        await page.getByRole('menuitem', { name: 'Widgets' }).click();
        await expect(
            page.getByRole('menu').filter({ hasText: 'Info PanelsOpen sub' }),
        ).toMatchAriaSnapshot(`
          - menu:
            - menuitem "Info Panels Open sub menu":
              - text: ""
              - img "Open sub menu"
            - menuitem "Profiles Open sub menu":
              - text: ""
              - img "Open sub menu"
            - menuitem "Statistics Widget"
            - menuitem "Histogram Widget"
            - menuitem "Animator Widget"
            - menuitem "Channel Map Control"
            - menuitem "Render Configuration Widget"
            - menuitem "Stokes Analysis Widget"
            - menuitem "Catalog Widget"
            - menuitem "Spectral Line Query Widget"
            - menuitem "PV Generator"
        `);

        await page.getByText('Info PanelsOpen sub menu').click();
        await expect(page.getByText('Region List WidgetImage List'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Region List Widget"
            - menuitem "Image List Widget"
            - menuitem "Cursor Info Widget"
            - menuitem "Log Widget"
        `);

        await page.getByText('ProfilesOpen sub menu').click();
        await expect(page.getByText('Spatial ProfilerSpectral'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Spatial Profiler"
            - menuitem "Spectral Profiler"
        `);

        await page.getByRole('menuitem', { name: 'Help' }).click();
        await expect(page.getByText('Online ManualControls and'))
            .toMatchAriaSnapshot(`
          - menu:
            - menuitem "Online Manual"
            - menuitem "Controls and Shortcuts Shift + ?"
            - menuitem "About"
        `);
    });
});
