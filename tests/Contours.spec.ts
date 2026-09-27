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
const contour = (page: Page) =>
    page.evaluate(() => {
        const frame = (window as any).app.frames[0];
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
    });

async function loadCube(page: Page) {
    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    await carta.loadImage('HD163296_13CO_2-1_subimage.fits');
    await carta.setChannel(0, 24);
    return carta;
}

async function waitForContours(page: Page, count: number) {
    await expect
        .poll(() => contour(page))
        .toMatchObject({ enabled: true, progress: 1 });
    const state = await contour(page);
    expect(state.levels).toHaveLength(count);
    expect(state.vertices).toBeGreaterThan(0);
}

test.describe('Contours', () => {
    test('all generators update levels from the channel histogram', async ({
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

    test('min-max scaling changes generated levels and the viewer', async ({
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

    test('styling changes rendered color and dash mode', async ({ page }) => {
        const carta = await loadCube(page);
        await carta.plotContour(
            0,
            [-0.0221, 0.0412, 0.0566, 0.0828, 0.11, 0.14, 0.19, 0.21],
        );
        await waitForContours(page, 8);
        expect((await contour(page)).negativeVertices).toBeGreaterThan(0);
        await page.getByTestId('contour-dialog-button').click();
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
        const whitePixels = await viewer(page).evaluate(
            (canvas: HTMLCanvasElement) => {
                const data = canvas
                    .getContext('2d')!
                    .getImageData(0, 0, canvas.width, canvas.height).data;
                let count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (
                        data[i] === 255 &&
                        data[i + 1] === 255 &&
                        data[i + 2] === 255 &&
                        data[i + 3] > 0
                    )
                        count++;
                }
                return count;
            },
        );
        expect(whitePixels).toBeGreaterThan(0);

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
});
