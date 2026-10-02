import { expect, test, type Page } from '@playwright/test';
import { LayoutName, PlaywrightDevPage, pixel } from '../utilities';

test.describe.configure({ mode: 'default' });

test('Workspace save retries and restores the image channel', async ({
    page,
}, testInfo) => {
    // Keep the database isolated: use CARTA's real serializer and loader,
    // but never overwrite a workspace belonging to the developer.
    let saved: Record<string, unknown> | undefined;
    let rejectSave = true;
    const name = 'e2e-channel-workspace';
    await page.route('**/database/list/workspaces', (route) =>
        route.fulfill({
            json: {
                success: true,
                workspaces: saved ? [{ name, date: saved.date }] : [],
            },
        }),
    );
    await page.route(/\/database\/workspace(?:\/.*)?$/, async (route) => {
        if (route.request().method() === 'PUT') {
            if (rejectSave) {
                rejectSave = false;
                await route.fulfill({ status: 500, json: { success: false } });
                return;
            }
            const body = route.request().postDataJSON();
            expect(body.workspaceName).toBe(name);
            saved = body.workspace;
        }
        await route.fulfill({ json: { success: true, workspace: saved } });
    });
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.loadImage('cube.fits');
    await page.getByTestId('animator-0-header-title').click();
    await page.getByTestId('animator-last-button').click();
    expect(await pixel(page, 8, 8)).toBeCloseTo(24, 5);
    const originalRgb = await rasterRgb(page);
    await carta.selectMenuItem('File', 'Save Workspace');
    const dialog = page.getByRole('dialog', {
        name: 'Save Workspace',
        exact: true,
    });
    const save = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeDisabled();
    await dialog.getByPlaceholder('Enter workspace name').fill(name);
    await save.click();
    await expect(
        page.getByText('Error saving workspace', { exact: true }),
    ).toBeVisible();
    expect(saved).toBeUndefined();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toBeHidden();
    expect(saved).toBeDefined();
    await page.getByTestId('animator-first-button').click();
    expect(await pixel(page, 8, 8)).toBeCloseTo(1.5, 5);
    await carta.selectMenuItem('File', 'Open Workspace');
    const openDialog = page.getByRole('dialog', {
        name: 'Open Workspace',
        exact: true,
    });
    await openDialog.getByText(name, { exact: true }).first().click();
    await openDialog.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(openDialog).toBeHidden();
    await expect
        .poll(() =>
            page.evaluate(() => (window as any).app.activeFrame.channel),
        )
        .toBe(4);
    expect(await pixel(page, 8, 8)).toBeCloseTo(24, 5);
    await expect.poll(() => rasterRgb(page)).toEqual(originalRgb);
    await testInfo.attach('workspace-restored-viewer.png', {
        body: await page.getByTestId('viewer-div').screenshot(),
        contentType: 'image/png',
    });
});

const tabGroups = (page: Page) =>
    page
        .locator('.flexlayout__tabset')
        .evaluateAll((sets) =>
            sets.map((set) =>
                Array.from(
                    set.querySelectorAll('.flexlayout__tab_button'),
                    (tab) => tab.textContent?.trim(),
                ),
            ),
        );

const layoutColumns = (page: Page) =>
    page.evaluate(() => {
        const model = (window as any).app.layoutStore.layoutModel.toJson();
        return model.layout.children.map((column: any) =>
            column.type === 'tabset'
                ? column.children.map((tab: any) => tab.component)
                : column.children.flatMap((set: any) =>
                      set.children.map((tab: any) => tab.component),
                  ),
        );
    });

const rasterRgb = (page: Page) =>
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
            ).slice(0, 3);
        });

async function boot(page: Page) {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await page.getByTestId('file-browser-dialog-header-close-button').click();
    return carta;
}

async function openLayout(page: Page) {
    await page.getByRole('menuitem', { name: 'View' }).click();
    await page.getByRole('menuitem', { name: 'Layout' }).click();
    return page.getByTestId('layout-table');
}

test.describe('Layout', () => {
    test('Preset layouts place the viewer and widgets in the expected groups', async ({
        page,
    }) => {
        const carta = await boot(page);
        const presets = [
            {
                name: LayoutName.Default,
                groups: [
                    ['No image loaded'],
                    ['Render Configuration'],
                    ['X Profile: Cursor'],
                    ['Y Profile: Cursor'],
                    ['Image List', 'Animator', 'Region List'],
                ],
            },
            {
                name: LayoutName.CubeView,
                groups: [
                    ['No image loaded'],
                    [
                        'Animator',
                        'Render Configuration',
                        'Region List',
                        'Image List',
                    ],
                    ['X Profile: Cursor'],
                    ['Y Profile: Cursor'],
                    ['Z Profile'],
                ],
            },
            {
                name: LayoutName.CubeAnalysis,
                groups: [
                    ['No image loaded'],
                    [
                        'Animator',
                        'Render Configuration',
                        'Region List',
                        'Image List',
                    ],
                    ['Z Profile'],
                    ['Statistics'],
                ],
            },
            {
                name: LayoutName.ContinuumAnalysis,
                groups: [
                    ['No image loaded'],
                    [
                        'Render Configuration',
                        'Region List',
                        'Animator',
                        'Image List',
                    ],
                    ['X Profile: Cursor'],
                    ['Y Profile: Cursor'],
                    ['Statistics'],
                ],
            },
        ];

        for (const preset of presets) {
            await carta.applyLayout(preset.name);
            await expect.poll(() => tabGroups(page)).toEqual(preset.groups);
            await expect(
                page.getByTestId('image-view-header-title'),
            ).toContainText('No image loaded');
        }
    });

    test('Docking and a new column preserve the viewer and profiler', async ({
        page,
    }) => {
        const carta = await boot(page);
        await carta.loadImage('cube.fits');
        await carta.applyLayout(LayoutName.CubeView);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'cube.fits',
        );
        await expect(page.locator('#raster-canvas').first()).toBeVisible();
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'layout-cube-raster.png',
            { maxDiffPixelRatio: 0.015 },
        );
        const rgb = await rasterRgb(page);
        for (const [channel, min, max] of [
            [0, 235, 250],
            [1, 210, 235],
            [2, 65, 105],
        ]) {
            expect(rgb[channel]).toBeGreaterThanOrEqual(min);
            expect(rgb[channel]).toBeLessThanOrEqual(max);
        }

        await carta.dragAndDock(
            page.getByTestId('spectral-profiler-0-header-title'),
            page.getByTestId('spatial-profiler-0-header-title'),
        );
        await expect
            .poll(() => tabGroups(page))
            .toContainEqual(['Z Profile', 'X Profile: Cursor']);
        await page.getByText('Z Profile', { exact: true }).first().click();
        await expect(
            page.getByTestId('spectral-profiler-0-content'),
        ).toBeVisible();
        expect(await pixel(page, 8, 8)).toBeCloseTo(1.5);
        await expect(
            page
                .getByTestId('spectral-profiler-0-content')
                .locator('.line-plot-component'),
        ).toHaveScreenshot('layout-z-profile.png');

        await carta.dragToNewColumn(
            page.getByTestId('spectral-profiler-0-header-title'),
        );
        await expect
            .poll(() => layoutColumns(page))
            .toEqual([
                ['spectral-profiler'],
                [
                    'image-view',
                    'animator',
                    'render-config',
                    'region-list',
                    'layer-list',
                ],
                ['spatial-profiler', 'spatial-profiler'],
            ]);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'cube.fits',
        );
        await expect(
            page.getByTestId('spectral-profiler-0-content'),
        ).toBeVisible();
    });

    test('Saved layout validates names and can be applied, renamed, and deleted', async ({
        page,
    }) => {
        await boot(page);
        const table = await openLayout(page);
        const name = table.getByPlaceholder('New layout name');
        const save = table.getByRole('button', { name: 'Save' });
        const previousRun = table
            .getByRole('row')
            .filter({ hasText: 'Layout E2E' });
        if (await previousRun.count()) {
            await previousRun.getByRole('button').nth(2).click();
            await page.getByRole('button', { name: 'OK' }).click();
            await expect(previousRun).toHaveCount(0);
        }
        for (const preset of [
            'Default',
            'Cube View',
            'Cube Analysis',
            'Continuum Analysis',
        ]) {
            const buttons = table
                .getByRole('row')
                .filter({ hasText: preset })
                .getByRole('button');
            await expect(buttons.nth(1)).toBeDisabled();
            await expect(buttons.nth(2)).toBeDisabled();
        }
        await expect(save).toBeDisabled();
        await name.fill('bad/name');
        await expect(save).toBeDisabled();
        await name.fill('Default');
        await save.click();
        await expect(
            page.getByText('Layout name cannot be the same as system presets.'),
        ).toBeVisible();
        await page.getByRole('button', { name: 'OK' }).click();

        await name.fill('Layout E2E');
        await save.click();
        const row = table.getByRole('row').filter({ hasText: 'Layout E2E' });
        await expect(row).toBeVisible();
        await name.fill('Layout E2E');
        await save.click();
        await expect(
            page.getByText(
                'Are you sure to overwrite the existing layout Layout E2E?',
            ),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(row).toBeVisible();

        await table
            .getByRole('row')
            .filter({ hasText: 'Cube View' })
            .getByRole('button', { name: 'Apply' })
            .click();
        await expect.poll(() => tabGroups(page)).toContainEqual(['Z Profile']);
        await row.getByRole('button', { name: 'Apply' }).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.layoutStore.currentLayoutName,
                ),
            )
            .toBe('Layout E2E');
        await expect
            .poll(() => tabGroups(page))
            .toContainEqual(['Image List', 'Animator', 'Region List']);

        await row.getByRole('button').nth(1).click();
        const rename = table.getByPlaceholder('Layout E2E');
        await rename.fill('bad/name');
        await expect(
            table.getByRole('button', { name: 'Rename' }),
        ).toBeDisabled();
        await rename.fill('Layout E2E renamed');
        await table.getByRole('button', { name: 'Rename' }).click();
        const renamedRow = table
            .getByRole('row')
            .filter({ hasText: 'Layout E2E renamed' });
        await expect(renamedRow).toBeVisible();
        await renamedRow.getByRole('button').nth(2).click();
        await expect(
            page.getByText('Do you delete layout Layout E2E renamed?'),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(renamedRow).toBeVisible();
        await renamedRow.getByRole('button').nth(2).click();
        await page.getByRole('button', { name: 'OK' }).click();
        await expect(renamedRow).toHaveCount(0);
    });

    test('Dynamic layouts switch between 2D and 3D images', async ({
        page,
    }) => {
        test.setTimeout(90000);
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.resetAllPreferences();
        await carta.loadImage('m16_f0444w.fits');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.activeFrame.dynamicLayout.ctype,
                ),
            )
            .toBe('XY,XY');

        const table = await openLayout(page);
        const oldNames: string[] = await page.evaluate(
            () => (window as any).app.layoutStore.userLayoutNames,
        );
        for (const name of oldNames) {
            const row = table
                .getByRole('cell', { name, exact: true })
                .locator('..');
            await row.getByRole('button').nth(2).click();
            await page
                .getByRole('alertdialog')
                .getByRole('button', { name: 'OK' })
                .click();
            await expect(row).toHaveCount(0);
        }
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.layoutStore.userLayoutNames,
                ),
            )
            .toEqual([]);
        await table
            .getByRole('row', { name: 'Default Apply' })
            .getByRole('button', { name: 'Apply' })
            .click();
        await page.getByTestId('layout-dialog-header-close-button').click();

        await page.getByRole('menuitem', { name: 'File' }).click();
        await page.getByRole('menuitem', { name: 'Preferences' }).click();
        const preferences = page.getByRole('dialog', { name: 'Preferences' });
        await preferences.getByRole('tab', { name: 'Layout' }).click();
        await preferences
            .locator('.bp6-form-group')
            .filter({ hasText: 'Initial layout' })
            .getByRole('combobox')
            .selectOption({ label: 'Default' });
        const dynamicPreference = preferences
            .locator('.bp6-form-group')
            .filter({ hasText: 'Dynamic layout' });
        if (!(await dynamicPreference.getByRole('checkbox').isChecked())) {
            await dynamicPreference.locator('.bp6-control-indicator').click();
        }
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.preferenceStore
                            .isDynamicLayoutEnabled,
                ),
            )
            .toBe(true);
        await preferences.getByRole('button', { name: 'Close' }).click();

        const saveDynamicLayout = async (
            preset: LayoutName,
            name: string,
            ctype: string,
        ) => {
            await carta.applyLayout(preset);
            const layoutTable = await openLayout(page);
            const saveRow = layoutTable.getByRole('row').first();
            await saveRow.getByPlaceholder('New layout name').fill(name);
            await saveRow.locator('.bp6-control-indicator').click();
            await saveRow.getByRole('button', { name: 'Save' }).click();
            await expect
                .poll(() =>
                    page.evaluate(
                        (key) =>
                            (window as any).app.preferenceStore
                                .existLayoutMapping[key],
                        ctype,
                    ),
                )
                .toBe(name);
            await expect(
                layoutTable.getByRole('cell', { name, exact: true }),
            ).toBeVisible();
            await page.getByTestId('layout-dialog-header-close-button').click();
        };

        await saveDynamicLayout(
            LayoutName.ContinuumAnalysis,
            '2D Image',
            'XY,XY',
        );
        await carta.loadImage('cube.fits');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.activeFrame.dynamicLayout.ctype,
                ),
            )
            .toBe('XY,XY,Z');
        await saveDynamicLayout(LayoutName.CubeAnalysis, '3D Cube', 'XY,XY,Z');
        await openLayout(page);
        await page
            .getByRole('dialog', { name: 'Layout' })
            .getByRole('tab', { name: 'Dynamic Layout' })
            .click();
        const mappedNames = await page
            .getByTestId('dynamic-layout-table')
            .getByRole('combobox')
            .evaluateAll((selects) =>
                selects
                    .map((select) => (select as HTMLSelectElement).value)
                    .sort(),
            );
        expect(mappedNames).toEqual(['2D Image', '3D Cube']);
        await page.getByTestId('layout-dialog-header-close-button').click();

        await carta.loadImage('m16_f0444w.fits');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.layoutStore.currentLayoutName,
                ),
            )
            .toBe('2D Image');
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'm16_f0444w.fits',
        );
        await expect(page.getByTestId('stats-0-header-title')).toContainText(
            'Statistics',
        );
        await expect(
            page.getByTestId('spatial-profiler-0-header-title'),
        ).toContainText('X Profile');
        await expect(page.locator('#raster-canvas').first()).toBeVisible();
        await expect(page.locator('#raster-canvas').first()).toHaveScreenshot(
            'dynamic-2d-raster.png',
            { maxDiffPixelRatio: 0.02 },
        );
        const rgb2d = await rasterRgb(page);
        for (const [channel, min, max] of [
            [0, 240, 255],
            [1, 240, 255],
            [2, 140, 190],
        ]) {
            expect(rgb2d[channel]).toBeGreaterThanOrEqual(min);
            expect(rgb2d[channel]).toBeLessThanOrEqual(max);
        }

        await carta.loadImage('cube.fits');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.layoutStore.currentLayoutName,
                ),
            )
            .toBe('3D Cube');
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'cube.fits',
        );
        await expect(
            page.getByTestId('spectral-profiler-0-header-title'),
        ).toContainText('Z Profile');
        expect(await pixel(page, 8, 8)).toBeCloseTo(1.5);
        await expect(
            page
                .getByTestId('spectral-profiler-0-content')
                .locator('.line-plot-component'),
        ).toHaveScreenshot('dynamic-3d-profile.png', {
            maxDiffPixelRatio: 0.02,
        });
        const rgb3d = await rasterRgb(page);
        for (const [channel, min, max] of [
            [0, 235, 250],
            [1, 210, 235],
            [2, 65, 105],
        ]) {
            expect(rgb3d[channel]).toBeGreaterThanOrEqual(min);
            expect(rgb3d[channel]).toBeLessThanOrEqual(max);
        }

        await page.reload();
        await expect(page.locator('.root-menu')).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.layoutStore.userLayoutNames,
                ),
            )
            .toEqual(['2D Image', '3D Cube']);
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).app.preferenceStore.existLayoutMapping,
                ),
            )
            .toEqual({
                'XY,XY': '2D Image',
                'XY,XY,Z': '3D Cube',
            });
    });
});

test('Menu bar reflects whether an image is loaded', async ({ page }) => {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    const snippetsEnabled = await page.evaluate(
        () => (window as any).app.preferenceStore.isCodeSnippetsEnabled,
    );
    await page.getByRole('menuitem', { name: 'File' }).click();
    await expect(
        page.getByRole('menuitem', { name: /Open Image/ }),
    ).toBeEnabled();
    await expect(
        page.getByRole('menuitem', { name: /Append Image/ }),
    ).toBeDisabled();
    await expect(
        page.getByRole('menuitem', { name: /Save Image/ }),
    ).toBeDisabled();
    for (const name of [
        /Close Image/,
        'Multi-Color Blending',
        'Import Regions',
        'Export Regions',
        /Import Catalog/,
    ]) {
        await expect(page.getByRole('menuitem', { name })).toBeDisabled();
    }
    for (const name of ['Open Workspace', 'Save Workspace', 'Preferences']) {
        await expect(page.getByRole('menuitem', { name })).toBeEnabled();
    }
    await page.getByRole('menuitem', { name: 'View' }).click();
    for (const name of ['Layout', 'Online Data Query']) {
        await expect(page.getByRole('menuitem', { name })).toBeEnabled();
    }
    if (snippetsEnabled) {
        await expect(
            page.getByRole('menuitem', { name: 'Code Snippets' }),
        ).toBeEnabled();
    } else {
        await expect(
            page.getByRole('menuitem', { name: 'Code Snippets' }),
        ).toHaveCount(0);
    }
    for (const name of [
        'File Header',
        'Contours',
        'Vector Overlay',
        'Image Fitting',
    ]) {
        await expect(page.getByRole('menuitem', { name })).toBeDisabled();
    }

    await carta.loadImage('single.fits');
    await page.getByRole('menuitem', { name: 'File' }).click();
    for (const name of [
        /Append Image/,
        /Save Image/,
        /Close Image/,
        /Import Regions/,
        /Import Catalog/,
        'Multi-Color Blending',
    ]) {
        await expect(page.getByRole('menuitem', { name })).toBeEnabled();
    }
    await page.getByRole('menuitem', { name: 'View' }).click();
    for (const name of [
        'Layout',
        'File Header',
        'Contours',
        'Vector Overlay',
        'Image Fitting',
        'Online Data Query',
    ]) {
        await expect(page.getByRole('menuitem', { name })).toBeEnabled();
    }
    if (snippetsEnabled) {
        await expect(
            page.getByRole('menuitem', { name: 'Code Snippets' }),
        ).toBeEnabled();
    } else {
        await expect(
            page.getByRole('menuitem', { name: 'Code Snippets' }),
        ).toHaveCount(0);
    }
    await page.getByRole('menuitem', { name: 'Widgets' }).click();
    for (const name of [
        'Statistics Widget',
        'Histogram Widget',
        'Animator Widget',
        'Channel Map Control',
        'Render Configuration Widget',
        'Stokes Analysis Widget',
        'Catalog Widget',
        'Spectral Line Query Widget',
        'PV Generator',
    ]) {
        await expect(page.getByRole('menuitem', { name })).toBeEnabled();
    }
    await page.getByRole('menuitem', { name: /Info Panels/ }).hover();
    for (const name of [
        'Region List Widget',
        'Image List Widget',
        'Cursor Info Widget',
        'Log Widget',
    ]) {
        await expect(
            page.getByRole('menuitem', { name, exact: true }),
        ).toBeEnabled();
    }
    await page.getByRole('menuitem', { name: /Profiles/ }).hover();
    for (const name of ['Spatial Profiler', 'Spectral Profiler']) {
        await expect(
            page.getByRole('menuitem', { name, exact: true }),
        ).toBeEnabled();
    }
    await page.getByRole('menuitem', { name: 'Help' }).click();
    for (const name of ['Online Manual', /Controls and Shortcuts/, 'About']) {
        await expect(page.getByRole('menuitem', { name })).toBeEnabled();
    }
});
