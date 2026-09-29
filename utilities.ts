import { expect, type Locator, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

export interface FrameSnapshot {
    id: number;
    filename: string;
    width: number;
    height: number;
    channels: number;
    unit: string;
    matching: number | null;
    moments: number[];
    requesting: boolean;
    headers: Array<{ name: string; value?: unknown }>;
    isPVImage: boolean;
}

export async function getFrames(page: Page): Promise<FrameSnapshot[]> {
    return page.evaluate(() =>
        ((window as any).app?.frames || []).map((f: any) => ({
            id: f.frameInfo?.fileId,
            filename: f.filename,
            width: f.frameInfo?.fileInfoExtended?.width,
            height: f.frameInfo?.fileInfoExtended?.height,
            channels: f.numChannels,
            unit: f.requiredUnit,
            matching: f.spatialReference?.frameInfo.fileId ?? null,
            moments: f.momentImages?.map((m: any) => m.frameInfo.fileId) ?? [],
            requesting: f.isRequestingMoments,
            headers: f.frameInfo?.fileInfoExtended?.headerEntries ?? [],
            isPVImage: f.isPVImage,
        })),
    );
}

export const pvPanel = (page: Page) => page.locator('.pv-generator-panel');
export const pvCutDropdown = (page: Page) =>
    page.getByTestId('pv-generator-pv-cut-region-dropdown');
export const imageDropdown = (page: Page) =>
    page.getByTestId('pv-generator-image-dropdown');
export const generateButton = (page: Page) =>
    page.getByTestId('pv-generator-generate-button');
export const previewButton = (page: Page) =>
    page.getByRole('button', { name: 'Start preview' });
export const coordDropdown = (page: Page) =>
    page.getByTestId('spectral-profiler-coordinate-dropdown');
export const spectralFromInput = (page: Page) =>
    page.getByTestId('pv-generator-spectral-range-from-input');
export const spectralToInput = (page: Page) =>
    page.getByTestId('pv-generator-spectral-range-to-input');
export const rebinXyInput = (page: Page) =>
    page.getByTestId('pv-generator-preview-rebin-xy-input');
export const rebinZInput = (page: Page) =>
    page.getByTestId('pv-generator-preview-rebin-z-input');
export const axesOrderSelect = (page: Page) =>
    pvPanel(page)
        .locator('.bp6-form-group')
        .filter({ hasText: 'Axes order' })
        .locator('select');
export const averageWidthInput = (page: Page) =>
    pvPanel(page)
        .locator('.bp6-form-group')
        .filter({ hasText: 'Average width' })
        .locator('input');
export const keepSwitch = (page: Page) =>
    pvPanel(page)
        .locator('.bp6-form-group')
        .filter({ hasText: 'Keep previous PV image(s)' })
        .locator('.bp6-control-indicator');
export const previewRegionSelect = (page: Page) =>
    pvPanel(page)
        .locator('.bp6-form-group')
        .filter({ hasText: 'Preview region' })
        .locator('select');
export const previewWidget = (page: Page) => page.locator('.pv-preview-widget');
export const previewCloseBtn = (page: Page) =>
    page.locator(
        '[data-testid*="pv-preview"][data-testid$="-header-close-button"]',
    );
export const generatorCloseBtn = (page: Page) =>
    page.locator(
        '[data-testid^="pv-generator-"][data-testid$="-header-close-button"]',
    );
export const cubeSizeLabel = (page: Page) =>
    pvPanel(page).locator('.cube-size');

export const fixtureFolder = path.resolve(__dirname, 'test_data');
export const moments = [
    ['-1', 'Mean value of the spectrum', 'average'],
    ['0', 'Integrated value of the spectrum', 'integrated'],
    ['1', 'Intensity weighted coordinate', 'weighted_coord'],
    [
        '2',
        'Intensity weighted dispersion of the coordinate',
        'weighted_dispersion_coord',
    ],
    ['3', 'Median value of the spectrum', 'median'],
    ['4', 'Median coordinate', 'median_coord'],
    [
        '5',
        'Standard deviation about the mean of the spectrum',
        'standard_deviation',
    ],
    ['6', 'Root mean square of the spectrum', 'rms'],
    ['7', 'Absolute mean deviation of the spectrum', 'abs_mean_dev'],
    ['8', 'Maximum value of the spectrum', 'maximum'],
    ['9', 'Coordinate of the maximum value of the spectrum', 'maximum_coord'],
    ['10', 'Minimum value of the spectrum', 'minimum'],
    ['11', 'Coordinate of the minimum value of the spectrum', 'minimum_coord'],
] as const;
export const panel = (page: Page) => page.getByTestId('moment-generator-tab');
export const control = (page: Page, name: string) =>
    panel(page).getByTestId(`moment-generator-${name}`);
export const group = (page: Page, label: string) =>
    panel(page)
        .locator('.bp6-form-group')
        .filter({
            has: page
                .locator('.bp6-label')
                .filter({ hasText: new RegExp(`^${label}\\s*$`) }),
        });
export const tags = (page: Page) => panel(page).locator('.bp6-tag');

export async function load(
    page: Page,
    name = 'cube.fits',
    append = false,
    folder = fixtureFolder,
) {
    const carta = new PlaywrightDevPage(page);
    const dialog = page.getByTestId('file-browser-dialog');
    if (!(await dialog.isVisible()))
        await carta.selectMenuItem(
            'File',
            append ? 'Append Image' : 'Open Image',
        );
    await dialog.locator('.edit-path-button').click();
    const directory = dialog.getByPlaceholder(
        'Input directory path with respect to the top level folder',
    );
    await directory.fill(
        (folder === fixtureFolder && process.env.MOMENT_FIXTURE_DIRECTORY) ||
            folder.replace('/Users/kchou/bz', ''),
    );
    await directory.press('Enter');
    await carta.loadImage(name, append);
    await expect
        .poll(() =>
            page.evaluate(
                (name) =>
                    (window as any).app.frames.some(
                        (f: any) => f.filename === name,
                    ),
                name,
            ),
        )
        .toBe(true);
}

export async function open(
    page: Page,
    name = 'cube.fits',
    folder = fixtureFolder,
) {
    await new PlaywrightDevPage(page).goto();
    await load(page, name, false, folder);
    await new PlaywrightDevPage(page).fillSnippetInput(
        'app.widgetsStore.setImageMultiPanelEnabled(false);',
    );
    await new PlaywrightDevPage(page).applyLayout(LayoutName.Default);
    await page.locator('#SpectralProfilerButton').click();
    await new PlaywrightDevPage(page).dragAndDock(
        page.getByTestId('spectral-profiler-0-header-title'),
        page.getByTestId('spatial-profiler-0-header-title'),
    );
    await new PlaywrightDevPage(page).dragAndDock(
        page.getByTestId('layer-list-0-header-title'),
        page.getByTestId('render-config-0-header-title'),
    );
    await page.getByTestId('moment-generator-button').click();
    await expect(panel(page)).toBeVisible();
    await moveSettings(page);
    await control(page, 'image-dropdown').selectOption({ label: `0: ${name}` });
    await control(page, 'region-dropdown').selectOption({ label: 'Image' });
    if (name !== 'single.fits') {
        await panel(page)
            .getByTestId('spectral-profiler-coordinate-dropdown')
            .selectOption('Channel');
        await expect(control(page, 'generate-button')).toBeEnabled();
    }
}

export async function moveSettings(page: Page, x = 1000, y = 70) {
    const title = page.getByTestId(
        'spectral-profiler-0-floating-settings-0-header-title',
    );
    await title.hover({ position: { x: 20, y: 12 } });
    await page.mouse.down();
    await page.mouse.move(x + 20, y + 12, { steps: 5 });
    await page.mouse.up();
}

export async function setSwitch(page: Page, label: string, checked: boolean) {
    const input = panel(page).getByLabel(label);
    if ((await input.isChecked()) !== checked)
        await input.locator('..').click();
    await expect(input).toBeChecked({ checked });
}

export async function selectMoments(page: Page, selected: string[]) {
    await control(page, 'clear-select-button').click();
    for (const tag of selected) {
        await panel(page).getByRole('textbox').fill(tag);
        const definition = moments.find((m) => m[0] === tag)!;
        await page
            .getByRole('menuitem', {
                name: `${tag}: ${definition[1]}`,
                exact: true,
            })
            .click();
    }
    await panel(page).getByRole('textbox').press('Escape');
    await expect(tags(page)).toHaveCount(selected.length);
}

export async function number(input: Locator, value: number | string) {
    await input.fill(String(value));
    await input.press('Tab');
}

export async function range(
    page: Page,
    kind: 'spectral' | 'mask',
    from: number,
    to: number,
) {
    await number(control(page, `${kind}-range-from-input`), from);
    await number(control(page, `${kind}-range-to-input`), to);
}

export async function generate(
    page: Page,
    selected: string[],
    source = 'cube.fits',
    keep = false,
) {
    const before = await getFrames(page);
    const old = before.map((f) => f.id);
    await selectMoments(page, selected);
    await control(page, 'generate-button').click();
    await expect
        .poll(
            async () =>
                (await getFrames(page)).filter((f) => !old.includes(f.id))
                    .length,
            { timeout: 30000 },
        )
        .toBe(selected.length);
    await expect
        .poll(
            async () =>
                (await getFrames(page)).find((f) => f.filename === source)
                    ?.requesting,
        )
        .toBe(false);
    const after = await getFrames(page);
    const added = after.filter((f) => !old.includes(f.id));
    const sourceFrame = after.find((f) => f.filename === source);
    if (!sourceFrame) throw new Error(`Missing source frame ${source}`);
    expect(sourceFrame.moments).toEqual(
        keep
            ? [
                  ...before.find((f) => f.filename === source)!.moments,
                  ...added.map((f) => f.id),
              ]
            : added.map((f) => f.id),
    );
    for (const tag of selected) {
        const suffix = moments.find((m) => m[0] === tag)![2];
        const result = added.find((f) =>
            new RegExp(`\\.moment\\.${suffix}\\d*$`).test(f.filename),
        );
        expect(result, `Missing moment ${tag}`).toBeTruthy();
        if (!result) throw new Error(`Missing moment ${tag}`);
        expect(result.channels).toBe(1);
    }
    await expect(page.getByTestId('viewer-div')).toBeVisible();
    return added;
}

export async function activate(page: Page, name: string) {
    await page
        .locator('[data-testid^="image-list-"][data-testid$="-image-name"]')
        .filter({
            hasText: new RegExp(
                `^${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`,
            ),
        })
        .click({ force: true });
    await expect
        .poll(() =>
            page.evaluate(() => (window as any).app.activeFrame.filename),
        )
        .toBe(name);
}

export async function pixel(page: Page, x: number, y: number) {
    const canvas = page
        .getByTestId('viewer-div')
        .locator('.region-stage > .konvajs-content > canvas')
        .first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const view = await page.evaluate(() => {
        const f = (window as any).app.activeFrame;
        return f.requiredFrameView;
    });
    await page.mouse.move(
        box!.x + ((x - view.xMin) / (view.xMax - view.xMin)) * box!.width,
        box!.y + ((view.yMax - y) / (view.yMax - view.yMin)) * box!.height,
    );
    await expect
        .poll(() =>
            page.evaluate(
                ({ x, y }) => {
                    const c = (window as any).app.activeFrame.cursorValue;
                    return (
                        c &&
                        Math.round(c.position.x) === x &&
                        Math.round(c.position.y) === y
                    );
                },
                { x, y },
            ),
        )
        .toBe(true);
    return page.evaluate(
        () => (window as any).app.activeFrame.cursorValue.value,
    );
}

export async function renderedRgb(page: Page) {
    const canvas = page.locator('#raster-canvas').first();
    return canvas.evaluate((source: HTMLCanvasElement) => {
        const context = source.getContext('2d');
        if (!context) throw new Error('Viewer canvas has no 2D context');
        const { data } = context.getImageData(
            0,
            0,
            source.width,
            source.height,
        );
        for (let index = 0; index < data.length; index += 4) {
            if (data[index + 3] > 0)
                return Array.from(data.slice(index, index + 4));
        }
        return [0, 0, 0, 0];
    });
}

export function oracle(
    tag: string,
    samples = [1, 2, 4, 8, 16],
    channels = [0, 1, 2, 3, 4],
) {
    if (!samples.length) return NaN;
    const sum = samples.reduce((a, b) => a + b, 0),
        n = samples.length,
        mean = sum / n;
    const weighted = samples.reduce((a, b, i) => a + b * channels[i], 0) / sum;
    const median = [...samples].sort((a, b) => a - b);
    const values: Record<string, number> = {
        '-1': mean,
        '0': sum,
        '1': weighted,
        '2': Math.sqrt(
            samples.reduce(
                (a, b, i) => a + b * (channels[i] - weighted) ** 2,
                0,
            ) / sum,
        ),
        '3':
            n % 2
                ? median[(n - 1) / 2]
                : (median[n / 2 - 1] + median[n / 2]) / 2,
        '4': channels[
            samples.findIndex(
                (_, i) =>
                    samples.slice(0, i + 1).reduce((a, b) => a + b, 0) >=
                    sum / 2,
            )
        ],
        '5':
            n > 1
                ? Math.sqrt(
                      samples.reduce((a, b) => a + (b - mean) ** 2, 0) /
                          (n - 1),
                  )
                : NaN,
        '6': Math.sqrt(samples.reduce((a, b) => a + b * b, 0) / n),
        '7': samples.reduce((a, b) => a + Math.abs(b - mean), 0) / n,
        '8': Math.max(...samples),
        '9': channels[samples.indexOf(Math.max(...samples))],
        '10': Math.min(...samples),
        '11': channels[samples.indexOf(Math.min(...samples))],
    };
    return values[tag];
}

export async function checkMap(
    page: Page,
    map: FrameSnapshot,
    tag: string,
    samples = [1, 2, 4, 8, 16],
    channels = [0, 1, 2, 3, 4],
) {
    expect([map.width, map.height]).toEqual([16, 16]);
    const coordinate = ['1', '2', '4', '9', '11'].includes(tag);
    expect(map.unit).toBe(tag === '0' ? 'K.km/s' : coordinate ? 'km/s' : 'K');
    for (const key of [
        'CTYPE1',
        'CTYPE2',
        'CRVAL1',
        'CRVAL2',
        'CDELT1',
        'CDELT2',
    ]) {
        expect(map.headers.some((h) => h.name === key)).toBe(true);
    }
    await activate(page, map.filename);
    await expect
        .poll(async () => (await renderedRgb(page))[3], { timeout: 10_000 })
        .toBeGreaterThan(0);
    const rgb = await renderedRgb(page);
    expect(rgb).toHaveLength(4);
    expect(
        rgb.slice(0, 3).every((channel) => channel >= 0 && channel <= 255),
    ).toBe(true);
    expect(rgb[3]).toBeGreaterThan(0);
    const value = await pixel(page, 8, 8);
    const expected = oracle(
        tag,
        samples.map((v) => v * 1.5),
        channels,
    );
    if (Number.isNaN(expected)) expect(Number.isNaN(value)).toBe(true);
    else expect(value).toBeCloseTo(expected, 3);
    expect(Number.isNaN(await pixel(page, 1, 1))).toBe(true);
}

export async function fault(
    page: Page,
    mode: 'reject' | 'cancel' | 'disconnect' | 'load',
) {
    let pending: Buffer | undefined;
    let intercepted = 0,
        cancelled = 0;
    const cartaPort =
        new URL(page.url()).port || process.env.CARTA_PORT || '3102';
    await page.routeWebSocket(new RegExp(`localhost:${cartaPort}/`), (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((message) => {
            const bytes = Buffer.isBuffer(message)
                ? message
                : Buffer.from(message);
            if (
                bytes.length >= 8 &&
                bytes.readUInt16LE(0) === 61 &&
                intercepted++ === 0
            ) {
                pending = Buffer.from(bytes.subarray(0, 8));
                if (mode === 'disconnect') {
                    server.close();
                    ws.close();
                    return;
                }
                if (mode === 'cancel') return;
                pending.writeUInt16LE(62, 0);
                if (mode === 'load') {
                    ws.send(
                        Buffer.concat([
                            pending,
                            Buffer.from([0x08, 1, 0x1a, 0]),
                        ]),
                    );
                    return;
                }
                const message = Buffer.from('Injected moment failure');
                ws.send(
                    Buffer.concat([
                        pending,
                        Buffer.from([0x12, message.length]),
                        message,
                    ]),
                );
            } else if (
                mode === 'cancel' &&
                bytes.length >= 8 &&
                bytes.readUInt16LE(0) === 64 &&
                pending
            ) {
                cancelled++;
                pending.writeUInt16LE(62, 0);
                ws.send(
                    Buffer.concat([pending, Buffer.from([0x08, 1, 0x20, 1])]),
                );
            } else server.send(message);
        });
    });
    return { requests: () => intercepted, cancels: () => cancelled };
}

export enum LayoutName {
    Default,
    CubeView,
    CubeAnalysis,
    ContinuumAnalysis,
}

export class PlaywrightDevPage {
    readonly page: Page;
    readonly imagePath: string;

    constructor(page: Page) {
        this.page = page;
        this.imagePath =
            process.env.IMAGE_PATH ||
            '/Users/kchou/bz/carta_build/e2e-lite/test_data';
    }

    async goto() {
        this.page.on('console', (msg) =>
            console.log('PAGE LOG:', msg.type(), msg.text()),
        );
        this.page.on('pageerror', (err) =>
            console.log('PAGE ERROR:', err.message),
        );
        await this.page.goto('/');
        await this.page.waitForFunction(
            () => (window as any).app?.preferenceStore?.isPreferenceReady,
        );
        await this.setTestTelemetryPreferences();
        await expect(this.page.locator('.root-menu')).toBeVisible({
            timeout: 15000,
        });
    }

    private async setTestTelemetryPreferences() {
        const preferencesSet = await this.page.evaluate(async () => {
            const store = (window as any).app.preferenceStore;
            const modeSet = await store.setPreference('telemetryMode', 'none');
            const consentSet = await store.setPreference(
                'telemetryConsentShown',
                true,
            );
            return modeSet && consentSet;
        });
        if (!preferencesSet) {
            throw new Error('Failed to disable telemetry for the test');
        }
    }

    async openMenu(
        menuName: 'File' | 'View' | 'Widgets' | 'Snippets' | 'Help',
    ) {
        if (this.page.url() === 'about:blank') {
            await this.goto();
        }
        await this.page
            .locator('.root-menu')
            .getByText(menuName, { exact: true })
            .click();
    }

    async selectMenuItem(
        menuName: 'File' | 'View' | 'Widgets' | 'Snippets' | 'Help',
        itemPath: string | string[],
    ) {
        await this.openMenu(menuName);
        const path = Array.isArray(itemPath) ? itemPath : [itemPath];
        for (let i = 0; i < path.length - 1; i++) {
            const parent = this.page
                .getByRole('menuitem', { name: path[i] })
                .first();
            await parent.hover();
            await this.page.waitForTimeout(300);
        }
        await this.page
            .getByRole('menuitem', { name: path[path.length - 1] })
            .first()
            .click();
    }

    async expectDialogVisible(dialogId: string) {
        if (dialogId === 'hotkey-dialog') {
            await expect(this.page.locator('.hotkeys-dialog')).toBeVisible({
                timeout: 10000,
            });
        } else {
            await expect(
                this.page.locator(`[data-testid="${dialogId}"]`),
            ).toBeVisible({ timeout: 10000 });
        }
    }

    async closeDialog(dialogId: string) {
        if (dialogId === 'hotkey-dialog') {
            await this.page.keyboard.press('Escape');
            await expect(this.page.locator('.hotkeys-dialog')).toBeHidden({
                timeout: 5000,
            });
            return;
        }
        const closeBtn = this.page.locator(
            `[data-testid="${dialogId}-header-close-button"]`,
        );
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await expect(
            this.page.locator(`[data-testid="${dialogId}"]`),
        ).toBeHidden({ timeout: 5000 });
    }

    async expectWidgetVisible(widgetId: string) {
        await expect(
            this.page
                .locator(
                    `[data-testid^="${widgetId}"][data-testid$="-header-title"]`,
                )
                .first(),
        ).toBeVisible({ timeout: 10000 });
    }

    async closeWidget(widgetId: string) {
        let closeBtn = this.page
            .locator(
                `[data-testid^="${widgetId}"][data-testid$="-header-close-button"]`,
            )
            .first();
        let attempts = 0;
        while (
            (await closeBtn.isVisible().catch(() => false)) &&
            attempts < 5
        ) {
            attempts++;
            await closeBtn.click();
            await this.page.waitForTimeout(200);
            closeBtn = this.page
                .locator(
                    `[data-testid^="${widgetId}"][data-testid$="-header-close-button"]`,
                )
                .first();
        }
    }

    async loadImage(fileName: string, isAppended: boolean = false) {
        if (this.page.url() === 'about:blank') {
            await this.goto();
        }
        const fbDialog = this.page.locator(
            '[data-testid="file-browser-dialog"]',
        );
        try {
            await expect(fbDialog).toBeVisible({ timeout: 400 });
        } catch {
            await this.selectMenuItem(
                'File',
                isAppended ? 'Append Image' : 'Open Image',
            );
            await expect(fbDialog).toBeVisible({ timeout: 1000 });
        }
        // If needed to navigate subdirectories:
        // await this.page.locator('.bp6-button.bp6-minimal.edit-path-button').click();
        let folder = '';
        let file = fileName;
        if (fileName.includes('/')) {
            const parts = fileName.split('/');
            file = parts.pop()!;
            folder = parts.join('/');
        }
        // if file includes no extension, show an error message and return
        if (!file.includes('.')) {
            throw new Error(
                `File name "${file}" does not include an extension.`,
            );
        }

        if (folder) {
            await this.page
                .getByRole('textbox', { name: 'Filter by filename with fuzzy' })
                .click();
            await this.page
                .getByRole('textbox', { name: 'Filter by filename with fuzzy' })
                .fill(folder);
            await this.page
                .getByRole('textbox', { name: 'Filter by filename with fuzzy' })
                .press('Enter');
            await this.page.getByText(folder, { exact: true }).first().click();
            // wait for filter input to be ready again or clear it
            const filterBox = this.page.getByRole('textbox', {
                name: 'Filter by filename with fuzzy',
            });
            await filterBox.clear();
        }

        await this.page
            .getByRole('textbox', { name: 'Filter by filename with fuzzy' })
            .click();
        await this.page
            .getByRole('textbox', { name: 'Filter by filename with fuzzy' })
            .fill(file);
        await this.page
            .getByRole('textbox', { name: 'Filter by filename with fuzzy' })
            .press('Enter');
        await this.page.waitForTimeout(100);

        await this.page.getByText(file, { exact: true }).first().click();
        await expect(this.page.getByText(`= ${file}`)).toBeVisible({
            timeout: 1000,
        });

        const loadBtn = isAppended
            ? this.page.getByRole('button', { name: 'Append' })
            : this.page.getByRole('button', { name: 'Load' });
        await expect(loadBtn).toBeEnabled({ timeout: 1000 });
        await loadBtn.click();
        await expect(fbDialog).toBeHidden({ timeout: 1500 });
    }

    async dragAndDock(
        source: Locator,
        target: Locator,
        steps: number = 5,
        waitForTimeout: number = 500,
    ) {
        const targetBox = await target.boundingBox();
        if (!targetBox) {
            throw new Error('Target bounding box not found');
        }
        await source.hover();
        await this.page.mouse.down();
        await this.page.mouse.move(
            targetBox.x + targetBox.width / 2,
            targetBox.y + targetBox.height / 2,
            { steps: steps },
        );
        await this.page.waitForTimeout(waitForTimeout); // wait for the mouse move to complete
        await this.page.mouse.up();
    }

    async dragToNewColumn(
        source: Locator,
        dockLeft: boolean = true,
        steps: number = 5,
        waitForTimeout: number = 500,
    ) {
        const viewportSize = this.page.viewportSize();
        if (!viewportSize) {
            throw new Error('Viewport size not available');
        }
        await source.hover();
        await this.page.mouse.down();
        let targetX = dockLeft ? 5 : viewportSize.width - 5;
        await this.page.mouse.move(targetX, (viewportSize.height - 40) / 2, {
            steps: steps,
        });
        await this.page.waitForTimeout(waitForTimeout); // wait for the mouse move to complete
        await this.page.mouse.up();
    }

    async sliderDragAndDrop(
        page: Page,
        sliderLocator: Locator,
        moveX: number,
        moveY: number = 0,
        steps: number = 5,
    ) {
        const boundingBox = await sliderLocator.boundingBox();

        if (boundingBox) {
            // Calculate start coordinates (center of the thumb element)
            const startX = boundingBox.x + boundingBox.width / 2;
            const startY = boundingBox.y + boundingBox.height / 2;

            // Move mouse to thumb, click down, drag, and release
            await page.mouse.move(startX, startY);
            await page.mouse.down();

            // Drag moveX pixels to the right and moveY pixels down
            await page.mouse.move(startX + moveX, startY + moveY, {
                steps: steps,
            });
            await page.mouse.up();
        }
    }

    async fillSnippetInput(inputString: string) {
        await this.page.getByRole('menuitem', { name: 'Snippets' }).click();
        await this.page
            .getByRole('menuitem', { name: 'Create New Snippet' })
            .click();
        await this.page
            .getByRole('textbox', { name: 'Enter execution string' })
            .fill(inputString);
        await this.page.getByRole('button', { name: 'Execute' }).click();
        await this.page
            .getByTestId('snippet-dialog-header-close-button')
            .click();
    }

    async setChannel(frame: number, channel: number) {
        await this.fillSnippetInput(
            `const frame${frame} = app.frames[${frame}]; frame${frame}.setChannel(${channel});`,
        );
    }

    async plotContour(
        frame: number,
        levels: number[],
        smoothMod: number = 2,
        smoothFactor: number = 4,
    ) {
        await this.fillSnippetInput(
            `const frame${frame} = app.frames[${frame}]; frame${frame}.contourConfig.setContourConfiguration([${levels.join(', ')}], ${smoothMod}, ${smoothFactor}); await app.contourDataSource.applyContours();`,
        );
    }

    async screenShot(Locator: Locator, screenshotName: string): Promise<void> {
        return expect(Locator).toHaveScreenshot(screenshotName);
    }

    async applyLayout(layout: LayoutName | number) {
        await this.page.getByRole('menuitem', { name: 'View' }).click();
        await this.page.getByRole('menuitem', { name: 'Layout' }).click();
        await this.page
            .getByRole('button', { name: 'Apply' })
            .nth(layout)
            .click();
        await this.page
            .getByTestId('layout-dialog-header-close-button')
            .click();
    }

    async setMultiPanelLayout(rows: number = 2, columns: number = 2) {
        await this.fillSnippetInput(
            `app.widgetsStore.setImageMultiPanelEnabled(true); app.preferenceStore.setPreference("imagePanelMode", "dynamic"); app.preferenceStore.setPreference("imagePanelColumns", ${columns}); app.preferenceStore.setPreference("imagePanelRows", ${rows});`,
        );
    }

    async enablePixelGrid(isVisible: boolean) {
        await this.fillSnippetInput(
            `app.preferenceStore.setPreference("pixelGridVisible", ${isVisible});`,
        );
    }

    async setPixelGridColor(color: string) {
        await this.fillSnippetInput(
            `app.preferenceStore.setPreference("pixelGridColor", "${color}");`,
        );
    }

    async setSystem(system: string) {
        await this.fillSnippetInput(
            `app.overlaySettings.global.setSystem("${system}");`,
        );
    }

    async setLabelType(labelType: string) {
        await this.fillSnippetInput(
            `app.overlaySettings.global.setLabelType("${labelType}");`,
        );
    }

    async setZoom(frame: number, zoom: number) {
        await this.fillSnippetInput(`app.frames[${frame}].setZoom(${zoom});`);
    }

    async resetAllPreferences() {
        await this.page.waitForFunction(
            () => (window as any).app?.preferenceStore?.isPreferenceReady,
        );
        const keys = await this.page.evaluate(() =>
            Array.from(
                (window as any).app.preferenceStore.preferences.keys(),
            ).filter(
                (key) =>
                    key !== '$schema' &&
                    key !== 'version' &&
                    key !== 'telemetryUuid',
            ),
        );
        if (keys.length) {
            const clearResponse = this.page.waitForResponse(
                (response) =>
                    response.request().method() === 'DELETE' &&
                    response.url().includes('/database/preferences'),
            );
            await this.page.evaluate(async (preferenceKeys) => {
                await (window as any).app.preferenceStore.clearPreferences(
                    preferenceKeys,
                );
            }, keys);
            const response = await clearResponse;
            const result = await response.json();
            if (!response.ok() || result.success !== true) {
                throw new Error(
                    `Failed to clear CARTA preferences (${response.status()}): ${JSON.stringify(result)}`,
                );
            }
        }

        await this.setTestTelemetryPreferences();
    }

    async setTestPreferences() {
        await this.resetAllPreferences();
        await this.page.evaluate(async () => {
            const app = (window as any).app;
            const preferences = [
                ['codeSnippetsEnabled', true],
                ['imagePanelMode', 'dynamic'],
                ['imagePanelColumns', 2],
                ['imagePanelRows', 2],
                ['pixelGridVisible', false],
                ['imageMultiPanelEnabled', true],
            ];
            for (const [key, value] of preferences) {
                if (!(await app.preferenceStore.setPreference(key, value))) {
                    throw new Error(`Failed to set test preference: ${key}`);
                }
            }
            app.widgetsStore.setImageMultiPanelEnabled(true);
            app.overlaySettings.global.setLabelType('Exterior');
        });
    }
}
