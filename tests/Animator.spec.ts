import { expect, test, type Page } from '@playwright/test';
import { LayoutName, PlaywrightDevPage, pixel } from '../utilities';

const cube = 'HD163296_13CO_2-1_subimage.fits';
const polarCube = 'IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits';

const currentChannel = (page: Page) =>
    page.evaluate(() => (window as any).app.activeFrame.channel as number);

async function expectChannel(page: Page, channel: number) {
    await expect.poll(() => currentChannel(page)).toBe(channel);
    await expect(
        page.getByTestId('animator-slider').getByRole('slider'),
    ).toHaveText(String(channel));
}

async function playUntil(
    page: Page,
    hasAdvanced: (channel: number) => boolean,
) {
    const play = page.getByTestId('animator-play-stop-button');
    await play.click();
    try {
        await expect
            .poll(async () => hasAdvanced(await currentChannel(page)), {
                timeout: 10_000,
            })
            .toBe(true);
    } finally {
        await play.click();
    }
    await expect
        .poll(() =>
            page.evaluate(
                () => (window as any).app.animatorStore.isAnimationActive,
            ),
        )
        .toBe(false);
}

async function rasterPixels(page: Page) {
    const box = await page.getByTestId('viewer-div').boundingBox();
    expect(box).not.toBeNull();
    return page.screenshot({
        clip: {
            x: box!.x + box!.width * 0.3,
            y: box!.y + box!.height * 0.2,
            width: box!.width * 0.35,
            height: box!.height * 0.2,
        },
    });
}

async function expectRasterChange(page: Page, previous: Buffer) {
    await expect
        .poll(async () => !(await rasterPixels(page)).equals(previous), {
            timeout: 10_000,
        })
        .toBe(true);
    return rasterPixels(page);
}

async function screenshotViewer(page: Page, name: string) {
    const viewer = page.getByTestId('viewer-div');
    await expect(viewer.locator('.image-ratio-popup')).toHaveCSS(
        'opacity',
        '0',
    );
    await expect(viewer).toHaveScreenshot(name, { maxDiffPixels: 2500 });
}

test.describe('Animator E2E Tests', () => {
    test('Channel change updates viewer and spatial/spectral profiles', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage(cube);
        await carta.applyLayout(LayoutName.CubeView);

        await page.getByTestId('point-region-shortcut-button').click();
        const imageCanvas = page.locator(
            '.region-stage > .konvajs-content > canvas',
        );
        const canvasBounds = await imageCanvas.boundingBox();
        expect(canvasBounds).not.toBeNull();
        await imageCanvas.click({
            position: {
                x: canvasBounds!.width / 2,
                y: canvasBounds!.height / 2,
            },
        });
        for (const profiler of [
            'spatial-profiler-0-content',
            'spatial-profiler-1-content',
        ]) {
            await page
                .getByTestId(profiler)
                .getByTestId('region-dropdown')
                .selectOption('1');
        }

        const plot = page.locator(
            '.split-pane-pane > .line-plot-component > .annotation-stage > .konvajs-content > canvas',
        );
        const xInfo = page.getByTestId('x-profiler-info').locator('pre');
        const yInfo = page.getByTestId('y-profiler-info').locator('pre');
        const spectralInfo = page
            .getByTestId('spectral-profiler-info-0')
            .locator('pre');
        const frequency = page.getByTestId('viewer-cursor-info-bar');

        await expectChannel(page, 0);
        await expect(xInfo).toContainText('Data:');
        await expect(yInfo).toContainText('Data:');
        await expect(spectralInfo).toContainText('Data:');
        const firstProfile = await spectralInfo.textContent();
        await page.mouse.move(0, 0);
        await screenshotViewer(page, 'Animator_ChannelChange_1.png');
        await expect(plot).toHaveScreenshot(
            'Animator_ChannelChange_1_SpectralProfiler.png',
            { maxDiffPixels: 500 },
        );

        await page.getByTestId('animator-last-button').click();
        await expectChannel(page, 109);
        await expect(frequency).toContainText('Frequency (LSRK):');
        await expect(spectralInfo).toContainText('Data:');
        await expect
            .poll(() => spectralInfo.textContent())
            .not.toBe(firstProfile);
        await page.mouse.move(0, 0);
        await screenshotViewer(page, 'Animator_ChannelChange_2.png');
        await expect(plot).toHaveScreenshot(
            'Animator_ChannelChange_2_SpectralProfiler.png',
            { maxDiffPixels: 500 },
        );

        await page.getByTestId('animator-first-button').click();
        await expectChannel(page, 0);
        await expect(spectralInfo).toHaveText(firstProfile!);
    });

    test('Image and stokes change updates the rendered plane', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.setPreferenceDefaults();
        await carta.loadImage(cube);
        await carta.loadImage(polarCube, true);
        await page.getByTestId('animator-0-header-title').click();
        await page
            .getByTestId('image-view-header-multipanel-view-switch')
            .click();

        const animator = page.getByTestId('animator-0-content');
        await page.getByText('0', { exact: true }).first().click();
        await expect(animator).toContainText(cube);
        await expect(page.getByTestId('animator-slider-info')).toContainText(
            'LSRK 220.4009 GHz',
        );
        await screenshotViewer(
            page,
            'Animator_ImageAndStokesChange_HD163296_13CO_2-1_subimage.png',
        );

        await page.getByText('1', { exact: true }).click();
        await expect(animator).toContainText(polarCube);
        await expect(page.getByTestId('animator-slider-info')).toContainText(
            /LSRK\s+\d+\.\d+ GHz/,
        );
        let raster = await rasterPixels(page);
        await screenshotViewer(
            page,
            'Animator_ImageAndStokesChange_IQUV_subimage.png',
        );

        const polarization = page.getByTestId('animator-polarization-slider');
        for (const plane of [
            'Stokes Q',
            'Stokes U',
            'Stokes V',
            'Ptotal',
            'Plinear',
            'Pangle',
        ]) {
            await polarization.getByText(plane, { exact: true }).click();
            await expect(polarization.getByRole('slider')).toHaveText(plane);
            await expect(
                page.getByTestId('viewer-cursor-info-bar'),
            ).toContainText(`Polarization: ${plane}`);
            raster = await expectRasterChange(page, raster);
            await screenshotViewer(
                page,
                `Animator_ImageAndStokesChange_IQUV_subimage_${plane.replace(' ', '')}.png`,
            );
        }
    });

    test('Playback controls move through channels and stop cleanly', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        await carta.loadImage(cube);
        await carta.applyLayout(LayoutName.CubeView);

        const control = page.getByTestId('animator-control-input');
        const mode = page
            .getByTestId('animator-0-content')
            .getByRole('combobox');
        await expectChannel(page, 0);
        await page.getByTestId('animator-next-button').click();
        await expectChannel(page, 1);
        await page.getByTestId('animator-previous-button').click();
        await expectChannel(page, 0);
        await page.getByTestId('animator-last-button').click();
        await expectChannel(page, 109);
        await page.getByTestId('animator-first-button').click();
        await expectChannel(page, 0);
        await screenshotViewer(page, 'Animator_AnimationPlay2.png');

        await page
            .getByTestId('animator-control-input-increment-button')
            .click();
        await expect(control).toHaveValue('6');
        await page
            .getByTestId('animator-control-input-decrement-button')
            .click();
        await expect(control).toHaveValue('5');
        await control.fill('0');
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.animatorStore.frameRate,
                ),
            )
            .toBe(5);
        await control.fill('5');
        await playUntil(page, (channel) => channel > 0);
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'Frequency (LSRK):',
        );

        await mode.selectOption('Step');
        await control.fill('3');
        await page.getByTestId('animator-first-button').click();
        await playUntil(page, (channel) => channel >= 3);
        expect((await currentChannel(page)) % 3).toBe(0);

        await mode.selectOption('Frame rate');
        await page.getByTestId('animator-last-button').click();
        await page.getByTestId('animator-playback-mode-button').click();
        await page.getByRole('menuitem', { name: 'Play backwards' }).click();
        await playUntil(page, (channel) => channel < 109);

        await page.getByTestId('animator-playback-mode-button').click();
        await page.getByRole('menuitem', { name: 'Bouncing' }).click();
        await page.getByTestId('animator-last-button').click();
        await playUntil(page, (channel) => channel < 109);

        await page.getByTestId('animator-playback-mode-button').click();
        await page.getByRole('menuitem', { name: 'Blink' }).click();
        await page.getByTestId('animator-first-button').click();
        await playUntil(page, (channel) => channel === 109);
        await page.getByTestId('animator-first-button').click();
        await expectChannel(page, 0);
    });

    test('Time series navigation loads the expected image data', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const epochs = [
            { file: 'J0423-0120_2015-05-24.fits', value: 0.9235039 },
            { file: 'J0423-0120_2020-03-17.fits', value: 1.8255513 },
            { file: 'J0423-0120_2024-08-13.fits', value: 3.5052781 },
        ];
        await carta.goto();

        const browser = page.getByTestId('file-browser-dialog');
        await browser.locator('.edit-path-button').click();
        const directory = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await directory.fill('/carta_build/e2e-lite/test_data/time_series');
        await directory.press('Enter');
        for (const [index, epoch] of epochs.entries()) {
            await browser
                .getByText(epoch.file, { exact: true })
                .click(index ? { modifiers: ['ControlOrMeta'] } : undefined);
        }
        await browser
            .getByTestId('file-browser-load-as-time-series-button')
            .click();
        await expect(browser).toBeHidden();
        await expect(
            page.getByTestId('animator-time-series-mode'),
        ).toBeChecked();
        await page.evaluate(() =>
            (window as any).app.widgetsStore.setImageMultiPanelEnabled(false),
        );

        const plot = page
            .locator('.spatial-profiler-widget .profile-plot')
            .first();
        for (const [index, epoch] of epochs.entries()) {
            await expect
                .poll(() =>
                    page.evaluate(
                        () => (window as any).app.timeSeriesStore.currentIndex,
                    ),
                )
                .toBe(index);
            await expect(
                page.getByTestId('image-view-header-title'),
            ).toContainText(epoch.file);
            await pixel(page, 150, 150);
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as any).app.activeFrame.cursorValue?.value,
                    ),
                )
                .toBeCloseTo(epoch.value, 5);
            await expect(page.getByTestId('x-profiler-info')).toContainText(
                'Data:',
            );
            await page.mouse.move(0, 0);
            await screenshotViewer(page, `Animator_TimeSeries_${index}.png`);
            await expect(plot).toHaveScreenshot(
                `Animator_TimeSeries_Profile_${index}.png`,
                { maxDiffPixelRatio: 0.02 },
            );
            if (index < epochs.length - 1) {
                await page.getByTestId('animator-next-button').click();
            }
        }
        await page.getByTestId('animator-first-button').click();
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            epochs[0].file,
        );
    });
});
