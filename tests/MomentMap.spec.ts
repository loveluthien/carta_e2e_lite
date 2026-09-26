import { test, expect } from '@playwright/test';
import {
    activate,
    checkMap,
    control,
    fault,
    generate,
    getFrames,
    group,
    load,
    moveSettings,
    moments,
    number,
    open,
    panel,
    pixel,
    PlaywrightDevPage,
    range,
    selectMoments,
    setSwitch,
    tags,
} from '../utilities';

test.describe('Moment Map', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10000));

    test('MM-01 defaults and tab persistence', async ({ page }) => {
        await open(page);
        await expect(tags(page)).toHaveText(['0']);
        await expect(control(page, 'mask-dropdown')).toHaveValue('0');
        await expect(control(page, 'spectral-range-from-input')).toHaveValue(
            '0',
        );
        await expect(control(page, 'spectral-range-to-input')).toHaveValue('4');
        await expect(control(page, 'mask-range-from-input')).toHaveValue('0');
        await expect(control(page, 'mask-range-to-input')).toHaveValue('1');
        await expect(
            panel(page).getByLabel('Keep previous moment image(s)'),
        ).not.toBeChecked();
        await range(page, 'spectral', 1, 3);
        await page.getByRole('tab', { name: 'Styling', exact: true }).click();
        await page.getByRole('tab', { name: 'Moments', exact: true }).click();
        await expect(control(page, 'spectral-range-from-input')).toHaveValue(
            '1',
        );
    });

    for (const [tag, name] of moments)
        test(`MM-06 moment ${tag}: ${name}`, async ({ page }) => {
            await open(page);
            if (tag === '4') {
                await control(page, 'mask-dropdown').selectOption({
                    label: 'Include',
                });
                await range(page, 'mask', 0, 100);
            }
            const [map] = await generate(page, [tag]);
            await checkMap(page, map, tag);
        });

    test('MM-07 multi-moment and all-moment batches', async ({ page }) => {
        await open(page);
        for (const selected of [
            ['0', '1', '2', '3'],
            moments.map((m) => m[0]),
        ]) {
            await control(page, 'mask-dropdown').selectOption({
                label: 'Include',
            });
            await range(page, 'mask', 0, 100);
            const maps = await generate(page, selected);
            for (const tag of selected)
                await checkMap(
                    page,
                    maps.find((m: any) =>
                        m.name.includes(
                            `.moment.${moments.find((d) => d[0] === tag)![2]}`,
                        ),
                    ),
                    tag,
                );
        }
    });
});

test.describe('Moment Map controls and lifecycle', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10000));

    test('MM-01 no image disables generation', async ({ page }) => {
        await new PlaywrightDevPage(page).goto();
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();
        await page.locator('#SpectralProfilerButton').click();
        await page.getByTestId('moment-generator-button').click();
        for (const name of [
            'image-dropdown',
            'region-dropdown',
            'mask-dropdown',
            'generate-button',
        ])
            await expect(control(page, name)).toBeDisabled();
    });

    test('MM-05 selection, deselection, tag removal, search and clear', async ({
        page,
    }) => {
        await open(page);
        await selectMoments(
            page,
            moments.map((m) => m[0]),
        );
        await panel(page).getByRole('textbox').fill('1');
        await expect(
            page.getByRole('menuitem').filter({ hasText: /^1/ }),
        ).toHaveText([
            '1: Intensity weighted coordinate',
            '10: Minimum value of the spectrum',
            '11: Coordinate of the minimum value of the spectrum',
        ]);
        await page
            .getByRole('menuitem', {
                name: '1: Intensity weighted coordinate',
                exact: true,
            })
            .click();
        await expect(tags(page)).toHaveCount(12);
        await panel(page).getByRole('textbox').fill('-1');
        await expect(
            page.getByRole('menuitem').filter({ hasText: /^-1/ }),
        ).toHaveCount(1);
        await panel(page).getByRole('textbox').fill('no-match');
        await expect(
            page.getByRole('menuitem').filter({ hasText: /^-?\d+:/ }),
        ).toHaveCount(0);
        await panel(page).getByRole('textbox').press('Escape');
        await panel(page)
            .getByRole('button', { name: 'Remove tag' })
            .first()
            .click();
        await expect(tags(page)).toHaveCount(11);
        await control(page, 'clear-select-button').click();
        await expect(tags(page)).toHaveCount(0);
        await selectMoments(page, ['0']);
        await expect(tags(page)).toHaveText(['0']);
    });

    test('MM-05 empty selection must not enable a destructive request', async ({
        page,
    }) => {
        await open(page);
        await control(page, 'clear-select-button').click();
        test.fail(
            true,
            'Known defect: Generate does not validate an empty selectedMoments list.',
        );
        await expect(control(page, 'generate-button')).toBeDisabled();
    });

    for (const [from, to] of [
        [0, 4],
        [1, 3],
        [3, 1],
        [0, 0],
        [4, 4],
    ])
        test(`MM-08 inclusive channel range ${from} to ${to}`, async ({
            page,
        }) => {
            await open(page);
            await range(page, 'spectral', from, to);
            const [map] = await generate(page, ['0']);
            const low = Math.min(from, to),
                high = Math.max(from, to);
            await checkMap(
                page,
                map,
                '0',
                [1, 2, 4, 8, 16].slice(low, high + 1),
                [0, 1, 2, 3, 4].slice(low, high + 1),
            );
        });

    for (const [mode, from, to, expected] of [
        ['None', 3, 12, [1, 2, 4, 8, 16]],
        ['Include', 3, 12, [2, 4, 8]],
        ['Exclude', 3, 12, [1, 2, 8, 16]],
        ['Include', 12, 3, [2, 4, 8]],
        ['Include', -100, 100, [1, 2, 4, 8, 16]],
        ['Include', 100, 200, []],
        ['Include', 6, 6, [4]],
    ] as const)
        test(`MM-13/MM-14 mask ${mode} ${from} to ${to}`, async ({ page }) => {
            await open(page);
            await control(page, 'mask-dropdown').selectOption({ label: mode });
            await range(page, 'mask', from, to);
            const [map] = await generate(page, ['0']);
            await checkMap(page, map, '0', [...expected]);
        });

    test('MM-09/MM-14 nonfinite input recovers; out-of-range channels clamp', async ({
        page,
    }) => {
        await open(page);
        for (const kind of ['spectral', 'mask'] as const) {
            for (const invalid of ['', 'NaN', 'Infinity']) {
                await number(
                    control(page, `${kind}-range-from-input`),
                    invalid,
                );
                const values = await page.evaluate((kind) => {
                    const w = (
                        window as any
                    ).app.widgetsStore.spectralProfileWidgets.get(
                        'spectral-profiler-0',
                    );
                    return kind === 'spectral'
                        ? [...w.channelValueRange]
                        : [...w.maskRange];
                }, kind);
                expect(values.every(Number.isFinite)).toBe(true);
            }
        }
        await range(page, 'spectral', -100, 100);
        await range(page, 'mask', 0, 100);
        const [map] = await generate(page, ['0']);
        await checkMap(page, map, '0');
    });

    test('MM-02 pinned source and Active source follow different images', async ({
        page,
    }) => {
        await open(page);
        await load(page, 'iquv.fits', true);
        await expect(control(page, 'file-info')).toContainText('cube.fits');
        await control(page, 'image-dropdown').selectOption({ label: 'Active' });
        await expect(control(page, 'file-info')).toContainText('iquv.fits');
        await activate(page, 'cube.fits');
        await expect(control(page, 'file-info')).toContainText('cube.fits');
        await page
            .locator('[data-testid$="-image-name"]')
            .filter({ hasText: 'iquv.fits' })
            .click({ button: 'right', force: true });
        await page
            .getByRole('menuitem', { name: 'Close image', exact: true })
            .click();
        await expect(
            control(page, 'image-dropdown').locator('option'),
        ).toHaveCount(2);
        await expect(control(page, 'generate-button')).toBeEnabled();
    });

    test('MM-15 keep, replace, and per-source ownership', async ({ page }) => {
        await open(page);
        const [a] = await generate(page, ['0']);
        const [b] = await generate(page, ['8']);
        expect((await getFrames(page)).map((f: any) => f.id)).not.toContain(
            a.id,
        );
        await setSwitch(page, 'Keep previous moment image(s)', true);
        const [c] = await generate(page, ['10'], 'cube.fits', true);
        expect((await getFrames(page)).map((f: any) => f.id)).toEqual(
            expect.arrayContaining([b.id, c.id]),
        );
        await load(page, 'iquv.fits', true);
        {
            const option = await control(page, 'image-dropdown')
                .locator('option')
                .filter({ hasText: 'iquv.fits' })
                .getAttribute('value');
            await control(page, 'image-dropdown').selectOption(option!);
        }
        await setSwitch(page, 'Keep previous moment image(s)', false);
        const [other] = await generate(page, ['0'], 'iquv.fits');
        await control(page, 'image-dropdown').selectOption({
            label: '0: cube.fits',
        });
        await generate(page, ['0']);
        const remaining = (await getFrames(page)).map((f: any) => f.id);
        expect(remaining).toContain(other.id);
        expect(remaining).not.toContain(b.id);
        expect(remaining).not.toContain(c.id);
    });

    test('MM-16 automatic spatial matching toggle', async ({ page }) => {
        await open(page);
        await setSwitch(page, 'Auto spatial matching', false);
        const [unmatched] = await generate(page, ['0']);
        expect(unmatched.matching).toBeNull();
        await setSwitch(page, 'Keep previous moment image(s)', true);
        await setSwitch(page, 'Auto spatial matching', true);
        const [matched] = await generate(page, ['8'], 'cube.fits', true);
        expect(matched.matching).toBe(0);
        expect(
            (await getFrames(page)).find((f: any) => f.id === unmatched.id)
                .matching,
        ).toBeNull();
        await control(page, 'image-dropdown').selectOption({ label: 'Active' });
        await expect(
            panel(page).getByLabel('Auto spatial matching'),
        ).toHaveCount(0);
    });

    test('MM-17 single-channel input and generated maps disable generation', async ({
        page,
    }) => {
        await open(page, 'single.fits');
        await expect(control(page, 'generate-button')).toBeDisabled();
        await expect(control(page, 'spectral-range-from-input')).toHaveCount(0);
        await load(page, 'cube.fits', true);
        const option = await control(page, 'image-dropdown')
            .locator('option')
            .filter({ hasText: 'cube.fits' })
            .getAttribute('value');
        await control(page, 'image-dropdown').selectOption(option!);
        await generate(page, ['0']);
        await control(page, 'image-dropdown').selectOption({ label: 'Active' });
        await expect(control(page, 'generate-button')).toBeDisabled();
    });

    test('MM-17 animation blocks generation and stop restores it', async ({
        page,
    }) => {
        await open(page);
        await moveSettings(page, 100, 400);
        await page.getByTestId('animator-0-header-title').click();
        await page.getByTestId('animator-play-stop-button').click();
        await expect(control(page, 'generate-button')).toBeDisabled();
        await page.getByTestId('animator-play-stop-button').click();
        await expect(control(page, 'generate-button')).toBeEnabled();
    });

    test('MM-20 generated image closes and regenerates', async ({ page }) => {
        await open(page);
        const [map] = await generate(page, ['0']);
        await checkMap(page, map, '0');
        await page
            .locator('[data-testid$="-image-name"]')
            .filter({ hasText: map.name })
            .click({ button: 'right', force: true });
        await page
            .getByRole('menuitem', { name: 'Close image', exact: true })
            .click();
        await expect.poll(async () => (await getFrames(page)).length).toBe(1);
        const [again] = await generate(page, ['0']);
        await checkMap(page, again, '0');
        expect(
            (await getFrames(page)).find((f: any) => f.filename === 'cube.fits')
                .channels,
        ).toBe(5);
    });

    test('MM-21 keyboard selection and generation', async ({ page }) => {
        await open(page);
        await control(page, 'clear-select-button').click();
        const input = panel(page).getByRole('textbox');
        await input.fill('8');
        await input.press('ArrowDown');
        await input.press('Enter');
        await input.press('Escape');
        await expect(tags(page)).toHaveText(['8']);
        await control(page, 'generate-button').focus();
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await getFrames(page)).length).toBe(2);
        const map = (await getFrames(page)).find((f: any) =>
            f.filename.includes('.moment.maximum'),
        );
        await checkMap(page, map, '8');
    });
});

test.describe('Moment Map regions and spectral settings', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10000));

    for (const [name, type, points] of [
        [
            'rectangle',
            3,
            [
                { x: 8, y: 8 },
                { x: 6, y: 6 },
            ],
        ],
        [
            'ellipse',
            4,
            [
                { x: 8, y: 8 },
                { x: 3, y: 3 },
            ],
        ],
        [
            'polygon',
            6,
            [
                { x: 5, y: 5 },
                { x: 11, y: 5 },
                { x: 8, y: 11 },
            ],
        ],
    ] as const)
        test(`MM-03 ${name} region generates a cropped map`, async ({
            page,
        }) => {
            await open(page);
            await new PlaywrightDevPage(page).fillSnippetInput(
                `const r=await app.frames[0].regionSet.addRegionAsync(${type}, ${JSON.stringify(points)}, 0, 'Moment ROI'); app.frames[0].regionSet.setFocusedRegion(r);`,
            );
            await expect(
                control(page, 'region-dropdown').locator('option', {
                    hasText: 'Moment ROI',
                }),
            ).toHaveCount(1);
            await control(page, 'region-dropdown').selectOption({
                label: 'Moment ROI',
            });
            const [map] = await generate(page, ['0']);
            expect(map.width).toBeGreaterThan(1);
            expect(map.height).toBeGreaterThan(1);
            expect(map.width).toBeLessThan(16);
            expect(map.height).toBeLessThan(16);
            const crpix = map.headers.find((h: any) => h.name === 'CRPIX1');
            expect(Number(crpix.value)).toBeLessThan(8);
            await activate(page, map.name);
            const x = Math.floor(map.width / 2),
                y = Math.floor(map.height / 2);
            expect(Number.isFinite(await pixel(page, x, y))).toBe(true);
        });

    test('MM-04 invalid regions cannot generate', async ({ page }) => {
        await open(page);
        await new PlaywrightDevPage(page).fillSnippetInput(`
      const set=app.frames[0].regionSet;
      await set.addRegionAsync(0,[{x:8,y:8}],0,'Moment point');
      await set.addRegionAsync(1,[{x:5,y:5},{x:11,y:11}],0,'Moment line');
    `);
        await expect(
            control(page, 'region-dropdown').locator('option', {
                hasText: 'Moment point',
            }),
        ).toHaveCount(1);
        await expect(
            control(page, 'region-dropdown')
                .locator('option')
                .filter({ hasText: 'Moment point' }),
        ).toBeDisabled();
        await expect(
            control(page, 'region-dropdown')
                .locator('option')
                .filter({ hasText: 'Moment line' }),
        ).toHaveCount(0);
        await control(page, 'region-dropdown').selectOption({
            label: 'Active',
        });
        await moveSettings(page, 100, 400);
        await page.getByTestId('region-list-0-header-title').click();
        await page
            .getByTestId('region-list-table')
            .getByText('Moment point', { exact: true })
            .click();
        await expect(control(page, 'generate-button')).toBeDisabled();
        await page
            .getByTestId('region-list-table')
            .getByText('Moment line', { exact: true })
            .click();
        await expect(control(page, 'generate-button')).toBeDisabled();
        await control(page, 'region-dropdown').selectOption({ label: 'Image' });
        await expect(control(page, 'generate-button')).toBeEnabled();
    });

    test('MM-11 all supported coordinates and systems expose finite ranges', async ({
        page,
    }) => {
        await open(page);
        const coordinate = panel(page).getByTestId(
            'spectral-profiler-coordinate-dropdown',
        );
        const options = await coordinate
            .locator('option')
            .evaluateAll((options) =>
                options.map((o) => (o as HTMLOptionElement).value),
            );
        expect(options).toContain('Channel');
        expect(options).toContain('Frequency (Hz)');
        for (const value of options)
            await test.step(value, async () => {
                await coordinate.selectOption(value);
                await expect(coordinate).toHaveValue(value);
                expect(
                    Number.isFinite(
                        Number(
                            await control(
                                page,
                                'spectral-range-from-input',
                            ).inputValue(),
                        ),
                    ),
                ).toBe(true);
                expect(
                    Number.isFinite(
                        Number(
                            await control(
                                page,
                                'spectral-range-to-input',
                            ).inputValue(),
                        ),
                    ),
                ).toBe(true);
            });
        await coordinate.selectOption('Frequency (Hz)');
        const system = group(page, 'System').locator('select');
        for (const value of await system
            .locator('option')
            .evaluateAll((options) =>
                options.map((o) => (o as HTMLOptionElement).value),
            )) {
            await system.selectOption(value);
            await expect(system).toHaveValue(value);
        }
        await system.selectOption('LSRK');
        for (const [coord, scale] of [
            ['Frequency (Hz)', 1],
            ['Frequency (MHz)', 1e6],
            ['Frequency (GHz)', 1e9],
        ] as const) {
            await coordinate.selectOption(coord);
            await range(
                page,
                'spectral',
                (1e9 - 1e9 / 299792.458) / scale,
                (1e9 - 3e9 / 299792.458) / scale,
            );
            const [map] = await generate(page, ['0']);
            await checkMap(page, map, '0', [2, 4, 8], [1, 2, 3]);
        }
    });

    test('MM-12 rest frequency edit, units and reset', async ({ page }) => {
        await open(page);
        const input = panel(page).getByRole('spinbutton', {
            name: 'Rest frequency',
            exact: true,
        });
        const unit = panel(page).locator('.freq-input select');
        const reset = input.locator('..').locator('a');
        await number(input, 2);
        await expect(input).toHaveValue('2');
        for (const [label, expected] of [
            ['MHz', 2e6],
            ['kHz', 2e3],
            ['Hz', 2],
            ['GHz', 2e9],
        ] as const) {
            await unit.selectOption(label);
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.frames[0].restFreqStore
                                .restFreqInHz,
                    ),
                )
                .toBe(expected);
        }
        await expect(reset).toBeEnabled();
        await reset.click();
        await expect(input).toHaveValue('1');
        test.fail(
            true,
            'Known defect: resetting the rest frequency restores the value but leaves the reset control enabled.',
        );
        await expect(reset).toBeDisabled();
        const [map] = await generate(page, ['1']);
        await checkMap(page, map, '1');
    });

    test('MM-12 missing rest frequency can be supplied', async ({ page }) => {
        await open(page, 'no-rest.fits');
        const input = panel(page).getByRole('spinbutton', {
            name: 'Rest frequency',
            exact: true,
        });
        await expect(input).toHaveValue('NaN');
        await number(input, 1);
        await panel(page).locator('.freq-input select').selectOption('GHz');
        const [map] = await generate(page, ['1'], 'no-rest.fits');
        await checkMap(page, map, '1');
    });

    test('MM-10 cursor mode toggle, mutual exclusion and typed exit', async ({
        page,
    }) => {
        await open(page);
        const cursors = panel(page).locator('.cursor-select a');
        await expect(cursors).toHaveCount(2);
        const channel = cursors.nth(0);
        const mask = cursors.nth(1);
        await channel.click();
        await expect(channel).toHaveClass(/bp6-active/);
        await channel.click();
        await expect(channel).not.toHaveClass(/bp6-active/);
        await channel.click();
        await mask.click();
        await expect(mask).toHaveClass(/bp6-active/);
        await expect(channel).not.toHaveClass(/bp6-active/);
        await number(control(page, 'mask-range-from-input'), 2);
        await expect(mask).not.toHaveClass(/bp6-active/);
        await channel.click();
        await number(control(page, 'spectral-range-from-input'), 1);
        await expect(channel).not.toHaveClass(/bp6-active/);
    });

    test('MM-21 Keep switch agrees with its store after tab remount', async ({
        page,
    }) => {
        await open(page);
        await setSwitch(page, 'Keep previous moment image(s)', true);
        await page.getByRole('tab', { name: 'Styling', exact: true }).click();
        await page.getByRole('tab', { name: 'Moments', exact: true }).click();
        await expect(
            panel(page).getByLabel('Keep previous moment image(s)'),
        ).toBeChecked();
        await generate(page, ['0'], 'cube.fits', true);
        await generate(page, ['8'], 'cube.fits', true);
    });

    test('MM-22 Stokes selection changes numerical results', async ({
        page,
    }) => {
        await open(page, 'iquv.fits');
        const [i] = await generate(page, ['0'], 'iquv.fits');
        await checkMap(page, i, '0');
        await activate(page, 'iquv.fits');
        await moveSettings(page, 100, 400);
        await page.getByTestId('animator-0-header-title').click();
        const slider = page
            .getByTestId('animator-polarization-slider')
            .getByRole('slider');
        await slider.focus();
        await slider.press('ArrowRight');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.activeFrame.requiredStokes,
                ),
            )
            .toBe(1);
        await moveSettings(page);
        const [q] = await generate(page, ['0'], 'iquv.fits');
        await checkMap(page, q, '0', [2, 4, 8, 16, 32]);
    });
});

test.describe('Moment Map injected failures', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => page.setDefaultTimeout(10000));
    test('MM-19 backend rejection clears loading and retry succeeds', async ({
        page,
    }) => {
        const injected = await fault(page, 'reject');
        await open(page);
        await control(page, 'generate-button').click();
        await expect.poll(injected.requests).toBe(1);
        await expect
            .poll(async () => (await getFrames(page))[0].requesting)
            .toBe(false);
        expect(await getFrames(page)).toHaveLength(1);
        await generate(page, ['0']);
    });
    test('MM-18 cancellation acknowledgment clears progress and retry succeeds [injected]', async ({
        page,
    }) => {
        const injected = await fault(page, 'cancel');
        await open(page);
        await control(page, 'generate-button').click();
        const progress = page.getByRole('dialog', {
            name: /Generating moments/,
        });
        await expect(progress).toBeVisible();
        await progress
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        await expect.poll(injected.cancels).toBe(1);
        await expect(progress).toBeHidden();
        expect(await getFrames(page)).toHaveLength(1);
        await generate(page, ['0']);
    });
    test('MM-19 disconnected request can recover in a fresh connection [injected]', async ({
        page,
    }) => {
        const injected = await fault(page, 'disconnect');
        await open(page);
        await control(page, 'generate-button').click();
        await expect.poll(injected.requests).toBe(1);
        await page.reload();
        await open(page);
        await generate(page, ['0']);
    });
});

test.describe('Moment Map real backend cancellation and loading failure', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });
    test.setTimeout(120000);
    test('MM-18 cancel real cube calculation, then retry a small range', async ({
        page,
    }) => {
        const source = 'Gaussian_array_wide.fits';
        await open(
            page,
            source,
            process.env.IMAGE_PATH ||
                '/Users/kchou/bz/carta_build/e2e-lite/test_data',
        );
        await selectMoments(
            page,
            moments.filter((m) => m[0] !== '4').map((m) => m[0]),
        );
        await control(page, 'generate-button').click();
        const progress = page.getByRole('dialog', {
            name: /Generating moments/,
        });
        await expect(progress).toBeVisible();
        await progress
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        await expect(progress).toBeHidden({ timeout: 30000 });
        await expect
            .poll(async () => (await getFrames(page))[0].requesting)
            .toBe(false);
        expect(await getFrames(page)).toHaveLength(1);
        await range(page, 'spectral', 0, 2);
        const [map] = await generate(page, ['0'], source);
        expect(map.width).toBeGreaterThan(16);
        expect(map.height).toBeGreaterThan(16);
    });
    test('MM-19 result load failure warns and retry succeeds [injected]', async ({
        page,
    }) => {
        test.fail(
            true,
            'Known defect: malformed generated-image acknowledgments are silently ignored instead of showing the Load file failed warning.',
        );
        await fault(page, 'load');
        await open(page);
        await control(page, 'generate-button').click();
        await expect(
            page.getByText('Load file failed.', { exact: true }),
        ).toBeVisible();
        await expect
            .poll(async () => (await getFrames(page))[0].requesting)
            .toBe(false);
        expect(await getFrames(page)).toHaveLength(1);
        await generate(page, ['0']);
    });
});
