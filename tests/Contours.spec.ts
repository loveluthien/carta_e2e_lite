import { expect, test, type Page } from '@playwright/test';
import { PlaywrightDevPage } from '../utilities';

const dialog = (page: Page) => page.getByTestId('contour-dialog');
const tags = (page: Page) =>
    dialog(page)
        .getByTestId('contour-config-level-input-form')
        .locator('.bp6-tag');
const levelValues = async (page: Page) =>
    (await tags(page).allTextContents()).map(Number);
const viewer = (page: Page) => page.locator('#contour-canvas');
const contourPixels = (page: Page) =>
    viewer(page).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
const whiteContourPixels = (page: Page) =>
    viewer(page).evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            if (
                pixels[i] === 255 &&
                pixels[i + 1] === 255 &&
                pixels[i + 2] === 255 &&
                pixels[i + 3] > 0
            )
                count++;
        }
        return count;
    });
async function closeDialog(page: Page) {
    await page.getByTestId('contour-dialog-header-close-button').click();
    await expect(dialog(page)).toBeHidden();
}
async function openDialog(page: Page) {
    await page.getByTestId('contour-dialog-button').click();
    await expect(dialog(page)).toBeVisible();
}
const parameter = (page: Page, name: string) =>
    dialog(page)
        .getByText(name, { exact: true })
        .locator('..')
        .getByRole('spinbutton');
async function setParameter(page: Page, name: string, value: string) {
    const input = parameter(page, name);
    await input.click();
    await input.press('ControlOrMeta+A');
    await input.pressSequentially(value);
    await input.press('Tab');
}
const contour = (page: Page, index = 0) =>
    page.evaluate((index) => {
        const frame = (window as any).app.frames[index];
        return {
            enabled: frame.contourConfig.isEnabled,
            levels: [...frame.contourConfig.levels],
            smoothingMode: frame.contourConfig.smoothingMode,
            smoothingFactor: frame.contourConfig.smoothingFactor,
            dashMode: frame.contourConfig.dashMode,
            progress: frame.contourProgress,
            vertices: [...frame.contourStores.values()].reduce(
                (n: number, store: any) => n + store.vertexCount,
                0,
            ),
            negativeVertices: [...frame.contourStores.entries()]
                .filter(([level]: [number, any]) => level < 0)
                .reduce(
                    (n: number, [, store]: [number, any]) =>
                        n + store.vertexCount,
                    0,
                ),
        };
    }, index);

async function loadCube(page: Page) {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
    await page.evaluate(() => (window as any).app.frames[0].setChannel(24));
    await expect
        .poll(() => page.evaluate(() => (window as any).app.frames[0].channel))
        .toBe(24);
}

async function waitForContours(page: Page, count: number, index = 0) {
    await expect
        .poll(() => contour(page, index))
        .toMatchObject({ enabled: true, progress: 1 });
    const state = await contour(page, index);
    expect(state.levels).toHaveLength(count);
    expect(state.vertices).toBeGreaterThan(0);
}

test.describe('Contours', () => {
    test('All generators update levels from the channel histogram', async ({
        page,
    }) => {
        await loadCube(page);
        await page.getByTestId('contour-dialog-button').click();
        await expect(dialog(page)).toBeVisible();
        await expect(
            dialog(page).getByRole('button', { name: 'Per-channel' }),
        ).toBeVisible();
        await expect(
            dialog(page).locator('.histogram-plot canvas').first(),
        ).toHaveScreenshot('contour-channel-24-histogram.png');

        await dialog(page).getByRole('button', { name: 'Generate' }).click();
        await expect(tags(page)).toHaveCount(5);
        const startStep = await levelValues(page);
        expect(startStep[0]).toBeCloseTo(
            parseFloat(await parameter(page, 'Start').inputValue()),
            2,
        );
        expect(startStep[1] - startStep[0]).toBeCloseTo(
            parseFloat(await parameter(page, 'Step').inputValue()),
            2,
        );
        await setParameter(page, 'N', '8');
        await dialog(page).getByRole('button', { name: 'Generate' }).click();
        await expect(tags(page)).toHaveCount(8);

        await dialog(page)
            .getByRole('button', { name: 'start-step-multiplier' })
            .click();
        await page.getByRole('menuitem', { name: 'min-max-scaling' }).click();
        await setParameter(page, 'N', '4');
        await dialog(page).getByRole('button', { name: 'Generate' }).click();
        await expect(tags(page)).toHaveCount(4);
        const minMax = await levelValues(page);
        expect(minMax[0]).toBeCloseTo(
            parseFloat(await parameter(page, 'Min').inputValue()),
            2,
        );
        expect(minMax[3]).toBeCloseTo(
            parseFloat(await parameter(page, 'Max').inputValue()),
            2,
        );
        await dialog(page).getByTestId('contour-config-apply-button').click();
        await waitForContours(page, 4);

        await dialog(page)
            .getByRole('button', { name: 'min-max-scaling' })
            .click();
        await page
            .getByRole('menuitem', { name: 'percentages-ref.value' })
            .click();
        await setParameter(page, 'N', '4');
        await dialog(page).getByRole('button', { name: 'Generate' }).click();
        await expect(tags(page)).toHaveCount(4);
        const percentages = await levelValues(page);
        const reference = parseFloat(
            await parameter(page, 'Reference').inputValue(),
        );
        expect(percentages[0]).toBeCloseTo(reference * 0.2, 2);
        expect(percentages[3]).toBeCloseTo(reference, 2);

        await dialog(page)
            .getByRole('button', { name: 'percentages-ref.value' })
            .click();
        await page.getByRole('menuitem', { name: 'mean-sigma-list' }).click();
        await dialog(page).getByRole('button', { name: 'Generate' }).click();
        await expect(tags(page)).toHaveCount(5);
        const sigmaLevels = await levelValues(page);
        const mean = parseFloat(await parameter(page, 'Mean').inputValue());
        const sigma = parseFloat(await parameter(page, 'Sigma').inputValue());
        expect(sigmaLevels[0]).toBeCloseTo(mean - 5 * sigma, 2);
        expect(sigmaLevels[4]).toBeCloseTo(mean + 17 * sigma, 2);
        await closeDialog(page);
        await expect(viewer(page)).toHaveScreenshot('contour-generated.png');
    });

    test('Min-max scaling changes generated levels and the viewer', async ({
        page,
    }) => {
        await loadCube(page);
        await openDialog(page);
        await dialog(page)
            .getByRole('button', { name: 'start-step-multiplier' })
            .click();
        await page.getByRole('menuitem', { name: 'min-max-scaling' }).click();
        await setParameter(page, 'Min', '0');
        await setParameter(page, 'Max', '0.2');
        await setParameter(page, 'N', '5');

        // Reference levels for five samples over 0..0.2, calculated independently.
        const modes = [
            { name: 'Linear', expected: [0, 0.05, 0.1, 0.15, 0.2] },
            {
                name: 'Log',
                alpha: '9',
                expected: [0, 0.102377, 0.148073, 0.17786, 0.2],
            },
            {
                name: 'Square root',
                expected: [0, 0.1, 0.141421, 0.173205, 0.2],
            },
            { name: 'Squared', expected: [0, 0.0125, 0.05, 0.1125, 0.2] },
            {
                name: 'Gamma',
                gamma: '1.5',
                expected: [0, 0.025, 0.070711, 0.129904, 0.2],
            },
            {
                name: 'Power',
                alpha: '4',
                expected: [0, 0.027614, 0.066667, 0.121895, 0.2],
            },
            {
                name: 'Sinh',
                alpha: '0.5',
                expected: [0, 0.028735, 0.064805, 0.117417, 0.2],
            },
            {
                name: 'Asinh',
                alpha: '0.1',
                expected: [0, 0.10988, 0.154254, 0.180938, 0.2],
            },
        ];
        let selected = 'Linear';
        let linearPixels = '';
        for (const mode of modes) {
            if (mode.name !== selected) {
                await dialog(page)
                    .getByRole('button', { name: selected, exact: true })
                    .click();
                await page
                    .getByRole('menuitem', { name: mode.name, exact: true })
                    .click();
                selected = mode.name;
            }
            if ('alpha' in mode && mode.alpha)
                await setParameter(page, 'Alpha', mode.alpha);
            if ('gamma' in mode && mode.gamma)
                await setParameter(page, 'Gamma', mode.gamma);
            await dialog(page)
                .getByRole('button', { name: 'Generate' })
                .click();
            await expect(tags(page)).toHaveCount(5);
            const displayed = await levelValues(page);
            mode.expected.forEach((expected, index) => {
                expect(Math.abs(displayed[index] - expected)).toBeLessThan(
                    0.006,
                );
            });

            const previousPixels =
                mode.name === 'Asinh' ? await contourPixels(page) : '';
            await dialog(page)
                .getByTestId('contour-config-apply-button')
                .click();
            await waitForContours(page, 5);
            await expect
                .poll(async () => {
                    const applied = (await contour(page)).levels;
                    return Math.max(
                        ...applied.map((value, index) =>
                            Math.abs(value - mode.expected[index]),
                        ),
                    );
                })
                .toBeLessThan(0.00001);
            if (mode.name === 'Linear')
                linearPixels = await contourPixels(page);
            if (mode.name === 'Asinh')
                await expect
                    .poll(() => contourPixels(page))
                    .not.toBe(previousPixels);
            if (mode.name === 'Log') {
                await parameter(page, 'Alpha').fill('-1');
                await parameter(page, 'Alpha').press('Tab');
                expect(
                    Number(await parameter(page, 'Alpha').inputValue()),
                ).toBeCloseTo(0.1);
                await dialog(page)
                    .getByRole('button', { name: 'Reset alpha to default' })
                    .click();
                expect(
                    Number(await parameter(page, 'Alpha').inputValue()),
                ).toBe(1000);
            }
            if (mode.name === 'Gamma') {
                await dialog(page)
                    .getByRole('button', { name: 'Reset gamma to default' })
                    .click();
                expect(
                    Number(await parameter(page, 'Gamma').inputValue()),
                ).toBeCloseTo(0.3);
            }
        }
        await expect.poll(() => contourPixels(page)).not.toBe(linearPixels);
        await closeDialog(page);
        await expect(viewer(page)).toHaveScreenshot(
            'contour-scaling-asinh.png',
        );
    });

    test('Apply renders; invalid levels are ignored; Clear removes contours', async ({
        page,
    }) => {
        await loadCube(page);
        await page.getByTestId('contour-dialog-button').click();
        const apply = dialog(page).getByTestId('contour-config-apply-button');
        const clear = dialog(page).getByRole('button', { name: 'Clear' });
        const input = dialog(page)
            .getByTestId('contour-config-level-input-form')
            .locator('input');
        await expect(apply).toBeDisabled();
        await expect(clear).toBeDisabled();
        await input.fill('not-a-number');
        await input.press('Enter');
        await expect(tags(page)).toHaveCount(0);
        await expect(apply).toBeDisabled();
        expect(await contour(page)).toMatchObject({
            enabled: false,
            vertices: 0,
        });

        for (const value of ['0.04', '0.1']) {
            await input.fill(value);
            await input.press('Enter');
        }
        await expect(tags(page)).toHaveCount(2);
        await dialog(page)
            .getByTestId('contour-dailog-config-tab-title')
            .click();
        await dialog(page)
            .getByRole('tabpanel', { name: 'Configuration' })
            .locator('select')
            .selectOption('0');
        await dialog(page).getByPlaceholder('Smoothing factor').fill('3');
        await apply.click();
        await waitForContours(page, 2);
        expect(await contour(page)).toMatchObject({
            levels: [0.04, 0.1],
            smoothingMode: 0,
            smoothingFactor: 3,
        });
        await expect(apply).toBeDisabled();
        await expect(clear).toBeEnabled();
        await closeDialog(page);
        await expect(viewer(page)).toHaveScreenshot('contour-applied.png');
        await openDialog(page);

        await clear.click();
        await expect
            .poll(() => contour(page))
            .toMatchObject({ enabled: false, progress: -1, vertices: 0 });
        await expect(apply).toBeEnabled();
        await closeDialog(page);
        await expect(viewer(page)).toHaveScreenshot('contour-cleared.png');
        await openDialog(page);
        await apply.click();
        await waitForContours(page, 2);
    });

    test('Styling changes rendered color and dash mode', async ({ page }) => {
        await loadCube(page);
        await openDialog(page);
        const input = dialog(page)
            .getByTestId('contour-config-level-input-form')
            .locator('input');
        for (const level of [
            '-0.0221',
            '0.0412',
            '0.0566',
            '0.0828',
            '0.11',
            '0.14',
            '0.19',
            '0.21',
        ]) {
            await input.fill(level);
            await input.press('Enter');
        }
        await expect(tags(page)).toHaveCount(8);
        await dialog(page)
            .getByTestId('contour-dailog-config-tab-title')
            .click();
        await dialog(page)
            .getByRole('tabpanel', { name: 'Configuration' })
            .locator('select')
            .selectOption('2');
        await dialog(page).getByPlaceholder('Smoothing factor').fill('4');
        await dialog(page).getByTestId('contour-config-apply-button').click();
        await waitForContours(page, 8);
        expect((await contour(page)).negativeVertices).toBeGreaterThan(0);
        await dialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        const style = dialog(page).getByRole('tabpanel', { name: 'Styling' });
        await expect(style.getByTestId('contour-thickness-input')).toHaveValue(
            '1',
        );
        await style
            .getByTestId('contour-thickness-input-increment-button')
            .click();
        await expect(style.getByTestId('contour-thickness-input')).toHaveValue(
            '1.5',
        );
        await style.getByTestId('contour-thickness-input').fill('3');
        await expect(
            style.getByRole('button', { name: 'Negative only' }),
        ).toBeVisible();
        await style.locator('.color-swatch-button').click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        await closeDialog(page);
        expect((await contour(page)).dashMode).toBe('Negative only');
        await expect(viewer(page)).toHaveScreenshot(
            'contour-white-negative-only.png',
        );
        const negativeOnlyPixels = await contourPixels(page);

        await openDialog(page);
        await dialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        await style.getByRole('button', { name: 'Negative only' }).click();
        await page.getByRole('menuitem', { name: 'None', exact: true }).click();
        await expect(
            style.getByRole('button', { name: 'None', exact: true }),
        ).toBeVisible();
        await closeDialog(page);
        expect((await contour(page)).dashMode).toBe('None');
        await expect(viewer(page)).toHaveScreenshot('contour-white-solid.png');
        const solidPixels = await contourPixels(page);
        expect(solidPixels).not.toBe(negativeOnlyPixels);

        await openDialog(page);
        await dialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        await style.getByRole('button', { name: 'None', exact: true }).click();
        await page
            .getByRole('menuitem', { name: 'Dashed', exact: true })
            .click();
        await expect(
            style.getByRole('button', { name: 'Dashed' }),
        ).toBeVisible();
        await closeDialog(page);
        expect((await contour(page)).dashMode).toBe('Dashed');
        await expect(viewer(page)).toHaveScreenshot('contour-white-dashed.png');
        expect(await contourPixels(page)).not.toBe(solidPixels);
        await expect.poll(() => whiteContourPixels(page)).toBeGreaterThan(0);

        await openDialog(page);
        await dialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        await style.locator('select').selectOption('1');
        await style.getByTestId('colormap-dropdown').click();
        await page.getByRole('menuitem', { name: 'tab10' }).click();
        await style
            .getByTestId('contour-invert-colormap-toggle')
            .locator('..')
            .locator('.bp6-control-indicator')
            .click();
        await expect(
            style.getByTestId('contour-invert-colormap-toggle'),
        ).toBeChecked();
        await style.getByRole('spinbutton', { name: 'Bias' }).fill('-0.1');
        await style.getByRole('spinbutton', { name: 'Contrast' }).fill('1.1');
        await expect(
            style.getByRole('spinbutton', { name: 'Bias' }),
        ).toHaveValue('-0.1');
        await expect(
            style.getByRole('spinbutton', { name: 'Contrast' }),
        ).toHaveValue('1.1');
        await closeDialog(page);
        await expect(viewer(page)).toHaveScreenshot('contour-mapped.png');
        expect((await contour(page)).vertices).toBeGreaterThan(0);
    });

    test('Spatial matching projects contours onto the reference viewer', async ({
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
        const imageList = page.locator('.layer-list-widget').last();
        const matching = imageList.getByTestId('image-list-0-matching-xy');
        const target = imageList.getByTestId('image-list-1-image-name');
        const state = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const [reference, target] = app.frames;
                return {
                    active: app.activeFrame?.filename,
                    source: app.contourDataSource?.filename,
                    locked: app.isFrameLockedToContour,
                    spatial: target.spatialReference?.filename ?? null,
                    transform: !!target.spatialTransform,
                    visible: target.contourConfig.isVisible,
                    onReference: app.contourFrames
                        .get(reference)
                        ?.map((frame: any) => frame.filename),
                };
            });

        if ((await state()).spatial) await matching.click();
        await expect.poll(state).toMatchObject({ spatial: null });
        await target.click();
        await expect
            .poll(state)
            .toMatchObject({ active: 'matching-cube.fits' });
        await openDialog(page);
        const source = dialog(page)
            .locator('.source-menu')
            .getByRole('button')
            .first();
        await source.click();
        await page
            .getByRole('menuitem', { name: 'cube.fits', exact: true })
            .click();
        await expect.poll(state).toMatchObject({
            active: 'cube.fits',
            source: 'cube.fits',
            locked: true,
        });
        await dialog(page).locator('.source-menu .lock-button').click();
        await expect.poll(state).toMatchObject({ locked: false });
        await source.click();
        await page
            .getByRole('menuitem', { name: 'matching-cube.fits' })
            .click();
        await expect.poll(state).toMatchObject({
            active: 'cube.fits',
            source: 'matching-cube.fits',
        });
        await dialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        await dialog(page).locator('.color-swatch-button').click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        await dialog(page)
            .getByTestId('contour-dailog-level-tab-title')
            .click();
        const input = dialog(page)
            .getByTestId('contour-config-level-input-form')
            .locator('input');
        for (const level of ['0', '3']) {
            await input.fill(level);
            await input.press('Enter');
        }
        await dialog(page).getByTestId('contour-config-apply-button').click();
        await waitForContours(page, 2, 1);
        await closeDialog(page);
        await expect.poll(state).toMatchObject({ active: 'cube.fits' });
        await expect.poll(state).toMatchObject({ onReference: [] });
        const unmatchedPixels = await contourPixels(page);
        await matching.click();
        await expect.poll(state).toMatchObject({
            spatial: 'cube.fits',
            transform: true,
            onReference: ['matching-cube.fits'],
        });
        await expect.poll(() => contourPixels(page)).not.toBe(unmatchedPixels);
        expect(await whiteContourPixels(page)).toBeGreaterThan(0);
        await carta.closeWidget('layer-list');
        await page.mouse.move(0, 0);
        await expect(page.locator('.image-toolbar').first()).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer(page)).toHaveScreenshot(
            'contour-spatial-matched.png',
        );

        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);
        const reopened = page.locator('.layer-list-widget').last();
        const visibility = reopened.getByRole('button', {
            name: 'C',
            exact: true,
        });
        await visibility.click();
        await expect.poll(state).toMatchObject({
            visible: false,
            onReference: [],
        });
        await expect.poll(() => contourPixels(page)).toBe(unmatchedPixels);
        await visibility.click();
        await expect.poll(state).toMatchObject({
            visible: true,
            onReference: ['matching-cube.fits'],
        });
        await expect.poll(() => contourPixels(page)).not.toBe(unmatchedPixels);
        await reopened.getByTestId('image-list-0-matching-xy').click();
        await expect.poll(state).toMatchObject({
            spatial: null,
            onReference: [],
        });
        await expect.poll(() => contourPixels(page)).toBe(unmatchedPixels);
        await reopened.getByTestId('image-list-1-image-name').click();
        await expect
            .poll(state)
            .toMatchObject({ active: 'matching-cube.fits' });
        expect((await contour(page, 1)).vertices).toBeGreaterThan(0);
        await carta.closeWidget('layer-list');
        await page.mouse.move(0, 0);
        await expect(page.locator('.image-toolbar').first()).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer(page)).toHaveScreenshot('contour-spatial-own.png');
    });

    test('Spectral matching updates contour channel without spatial overlay', async ({
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
        const imageList = page.locator('.layer-list-widget').last();
        const spatial = imageList.getByTestId('image-list-0-matching-xy');
        const spectral = imageList.getByTestId('image-list-0-matching-z');
        const reference = imageList.getByTestId('image-list-0-image-name');
        const target = imageList.getByTestId('image-list-1-image-name');
        const state = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const [reference, target] = app.frames;
                return {
                    active: app.activeFrame?.filename,
                    referenceChannel: reference.channel,
                    targetChannel: target.channel,
                    spatial: target.spatialReference?.filename ?? null,
                    spectral: target.spectralReference?.filename ?? null,
                    onReference: app.contourFrames
                        .get(reference)
                        ?.map((frame: any) => frame.filename),
                };
            });
        if ((await state()).spatial) await spatial.click();
        if ((await state()).spectral) await spectral.click();
        await expect
            .poll(state)
            .toMatchObject({ spatial: null, spectral: null });
        await target.click();
        await openDialog(page);
        await dialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        await dialog(page).locator('.color-swatch-button').click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        await dialog(page)
            .getByTestId('contour-dailog-level-tab-title')
            .click();
        const input = dialog(page)
            .getByTestId('contour-config-level-input-form')
            .locator('input');
        for (const level of ['0', '3', '10', '12']) {
            await input.fill(level);
            await input.press('Enter');
        }
        await dialog(page).getByTestId('contour-config-apply-button').click();
        await waitForContours(page, 4, 1);
        await closeDialog(page);
        const channelZeroPixels = await contourPixels(page);
        await reference.click();
        await expect.poll(state).toMatchObject({
            active: 'cube.fits',
            onReference: [],
        });
        const referencePixels = await contourPixels(page);

        await spectral.click();
        await expect.poll(state).toMatchObject({
            spatial: null,
            spectral: 'cube.fits',
            onReference: [],
        });
        await page.evaluate(() => (window as any).app.frames[0].setChannel(4));
        await expect.poll(state).toMatchObject({
            referenceChannel: 4,
            targetChannel: 2,
            onReference: [],
        });
        await expect.poll(() => contourPixels(page)).toBe(referencePixels);
        await target.click();
        await expect
            .poll(state)
            .toMatchObject({ active: 'matching-cube.fits' });
        await expect
            .poll(() => contourPixels(page))
            .not.toBe(channelZeroPixels);
        await expect.poll(() => whiteContourPixels(page)).toBeGreaterThan(0);
        await carta.closeWidget('layer-list');
        await page.mouse.move(0, 0);
        await expect(page.locator('.image-toolbar').first()).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer(page)).toHaveScreenshot(
            'contour-spectral-channel-2.png',
        );
        const matchedPixels = await contourPixels(page);

        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);
        const reopened = page.locator('.layer-list-widget').last();
        await reopened.getByTestId('image-list-0-matching-z').click();
        await expect.poll(state).toMatchObject({ spectral: null });
        await reopened.getByTestId('image-list-0-image-name').click();
        await page.evaluate(() => (window as any).app.frames[0].setChannel(3));
        await expect.poll(state).toMatchObject({
            referenceChannel: 3,
            targetChannel: 2,
        });
        await reopened.getByTestId('image-list-1-image-name').click();
        await expect
            .poll(state)
            .toMatchObject({ active: 'matching-cube.fits' });
        await expect.poll(() => contourPixels(page)).toBe(matchedPixels);
    });

    test('Spatial and spectral matching project contours together', async ({
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
        const imageList = page.locator('.layer-list-widget').last();
        const spatial = imageList.getByTestId('image-list-0-matching-xy');
        const spectral = imageList.getByTestId('image-list-0-matching-z');
        const reference = imageList.getByTestId('image-list-0-image-name');
        const target = imageList.getByTestId('image-list-1-image-name');
        const state = () =>
            page.evaluate(() => {
                const app = (window as any).app;
                const [reference, target] = app.frames;
                return {
                    active: app.activeFrame?.filename,
                    referenceChannel: reference.channel,
                    targetChannel: target.channel,
                    spatial: target.spatialReference?.filename ?? null,
                    spectral: target.spectralReference?.filename ?? null,
                    onReference: app.contourFrames
                        .get(reference)
                        ?.map((frame: any) => frame.filename),
                };
            });

        if ((await state()).spatial) await spatial.click();
        if ((await state()).spectral) await spectral.click();
        await expect
            .poll(state)
            .toMatchObject({ spatial: null, spectral: null });
        await target.click();
        await openDialog(page);
        await dialog(page)
            .getByTestId('contour-dailog-styling-tab-title')
            .click();
        await dialog(page).locator('.color-swatch-button').click();
        await page.getByTitle('#FFFFFF').click();
        await page.keyboard.press('Escape');
        await dialog(page)
            .getByTestId('contour-dailog-level-tab-title')
            .click();
        const input = dialog(page)
            .getByTestId('contour-config-level-input-form')
            .locator('input');
        for (const level of ['0', '3', '10', '12']) {
            await input.fill(level);
            await input.press('Enter');
        }
        await dialog(page).getByTestId('contour-config-apply-button').click();
        await waitForContours(page, 4, 1);
        await closeDialog(page);
        await reference.click();
        await expect.poll(state).toMatchObject({
            active: 'cube.fits',
            onReference: [],
        });
        const unmatchedPixels = await contourPixels(page);

        await spatial.click();
        await expect.poll(state).toMatchObject({
            spatial: 'cube.fits',
            spectral: null,
            onReference: ['matching-cube.fits'],
        });
        await spectral.click();
        await expect.poll(state).toMatchObject({
            spatial: 'cube.fits',
            spectral: 'cube.fits',
            onReference: ['matching-cube.fits'],
            referenceChannel: 0,
            targetChannel: 0,
        });

        await page.evaluate(() => (window as any).app.frames[0].setChannel(4));
        await expect.poll(state).toMatchObject({
            spatial: 'cube.fits',
            spectral: 'cube.fits',
            referenceChannel: 4,
            targetChannel: 2,
            onReference: ['matching-cube.fits'],
        });
        await expect.poll(() => contourPixels(page)).not.toBe(unmatchedPixels);
        await expect.poll(() => whiteContourPixels(page)).toBeGreaterThan(0);
        await carta.closeWidget('layer-list');
        await page.mouse.move(0, 0);
        await expect(page.locator('.image-toolbar').first()).toHaveCSS(
            'opacity',
            '0',
        );
        await expect(viewer(page)).toHaveScreenshot(
            'contour-spatial-spectral-matched.png',
        );

        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Image List Widget',
        ]);
        const reopened = page.locator('.layer-list-widget').last();
        await reopened.getByTestId('image-list-0-matching-z').click();
        await expect.poll(state).toMatchObject({
            spatial: 'cube.fits',
            spectral: null,
            targetChannel: 2,
            onReference: ['matching-cube.fits'],
        });
        await expect.poll(() => whiteContourPixels(page)).toBeGreaterThan(0);
        await reopened.getByTestId('image-list-0-matching-xy').click();
        await expect.poll(state).toMatchObject({
            spatial: null,
            spectral: null,
            onReference: [],
        });
        await expect.poll(() => contourPixels(page)).toBe(unmatchedPixels);
        await reopened.getByTestId('image-list-1-image-name').click();
        await expect
            .poll(state)
            .toMatchObject({ active: 'matching-cube.fits', targetChannel: 2 });
        expect((await contour(page, 1)).vertices).toBeGreaterThan(0);
    });

    test('Cube histogram, level removal, and smoothing update the viewer', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage('cube.fits');
        await openDialog(page);
        const histogram = dialog(page).getByRole('button', {
            name: 'Per-channel',
        });
        await histogram.click();
        await page.getByRole('menuitem', { name: 'Per-cube' }).click();
        const warning = page.getByText(
            'Calculating a cube histogram may take a long time',
            {
                exact: false,
            },
        );
        await expect(warning).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(histogram).toBeVisible();
        await histogram.click();
        await page.getByRole('menuitem', { name: 'Per-cube' }).click();
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'OK' })
            .click();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const config = (window as any).app.frames[0].renderConfig;
                    return [
                        config.isUsingCubeHistogramContours,
                        config.cubeHistogramProgress,
                    ];
                }),
            )
            .toEqual([true, 1]);
        await expect(
            dialog(page).locator('.histogram-plot canvas').first(),
        ).toHaveScreenshot('contour-cube-histogram.png');
        await dialog(page).getByRole('button', { name: 'Per-cube' }).click();
        await page.getByRole('menuitem', { name: 'Per-channel' }).click();

        const input = dialog(page)
            .getByTestId('contour-config-level-input-form')
            .locator('input');
        for (const level of ['0', '1.5', '3']) {
            await input.fill(level);
            await input.press('Enter');
        }
        await expect(tags(page)).toHaveCount(3);
        await tags(page)
            .last()
            .getByRole('button', { name: 'Remove tag' })
            .click();
        await expect(tags(page)).toHaveCount(2);
        await dialog(page)
            .getByTestId('contour-dailog-config-tab-title')
            .click();
        const smoothing = dialog(page)
            .getByRole('tabpanel', { name: 'Configuration' })
            .locator('select');
        await smoothing.selectOption('1');
        await dialog(page).getByPlaceholder('Smoothing factor').fill('3');
        await dialog(page).getByTestId('contour-config-apply-button').click();
        await waitForContours(page, 2);
        expect(await contour(page)).toMatchObject({
            levels: [0, 1.5],
            smoothingMode: 1,
            smoothingFactor: 3,
        });
        await closeDialog(page);
        await expect(viewer(page)).toHaveScreenshot('contour-block.png');
        const blockPixels = await contourPixels(page);

        await openDialog(page);
        await dialog(page)
            .getByTestId('contour-dailog-config-tab-title')
            .click();
        await smoothing.selectOption('2');
        await dialog(page).getByTestId('contour-config-apply-button').click();
        await expect
            .poll(() => contour(page))
            .toMatchObject({ smoothingMode: 2, progress: 1 });
        await closeDialog(page);
        await expect.poll(() => contourPixels(page)).not.toBe(blockPixels);
        await expect(viewer(page)).toHaveScreenshot('contour-gaussian.png');
    });
});
