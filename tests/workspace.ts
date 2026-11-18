import {
    expect,
    test,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import { PlaywrightDevPage, renderedRgb } from '../utilities';

type CheckRestore = (stage: 'saved' | 'restored') => Promise<void>;

async function workspaceWindows(page: Page) {
    return page.evaluate(() => {
        const text = (element: Element | null) =>
            element?.textContent?.trim() ?? '';
        const selectedTabs = (element: Element) =>
            Array.from(
                element.querySelectorAll('[role="tab"][aria-selected="true"]'),
                text,
            );
        const bounds = (element: Element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return {
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(width),
                height: Math.round(height),
            };
        };
        const docked = Array.from(
            document.querySelectorAll('.flexlayout__tabset'),
            (group) => ({
                bounds: bounds(group),
                tabs: Array.from(
                    group.querySelectorAll('.flexlayout__tab_button'),
                    (tab) => ({
                        title: text(
                            tab.querySelector(
                                '.flexlayout__tab_button_content',
                            ) ?? tab,
                        ),
                        selected: tab.classList.contains(
                            'flexlayout__tab_button--selected',
                        ),
                    }),
                ),
            }),
        );
        const floating = Array.from(
            document.querySelectorAll('.floating-widget'),
            (element) => {
                const title = element.querySelector('.floating-title');
                return {
                    id: title?.getAttribute('data-testid'),
                    title: text(title),
                    tabs: selectedTabs(element),
                    bounds: bounds(element),
                    zIndex: Number(getComputedStyle(element).zIndex),
                };
            },
        );
        const dialogs = Array.from(
            document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
            (dialog) => {
                if (
                    !dialog.getClientRects().length ||
                    getComputedStyle(dialog).visibility === 'hidden'
                )
                    return null;
                const wrapper = dialog.closest(
                    '.draggable-dialog[data-dialog-id]',
                );
                const container = wrapper?.firstElementChild ?? dialog;
                return {
                    id:
                        wrapper?.getAttribute('data-dialog-id') ??
                        dialog.getAttribute('data-testid'),
                    title:
                        dialog.getAttribute('aria-label') ??
                        text(
                            dialog.querySelector(
                                '.bp6-dialog-header .bp6-heading',
                            ),
                        ),
                    tabs: selectedTabs(dialog),
                    bounds: bounds(container),
                    zIndex: Number(getComputedStyle(container).zIndex) || 0,
                };
            },
        ).filter((dialog) => dialog !== null);

        return {
            docked,
            floating: floating
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(({ zIndex, ...widget }) => widget),
            dialogs: dialogs
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(({ zIndex, ...dialog }) => dialog),
        };
    });
}

// Keep workspace storage local to the test. CARTA captures and restores the
// snapshot through the File menu and loads the data from the real backend.
export async function workspaceRoundTrip(
    page: Page,
    info: TestInfo,
    prepare: (carta: PlaywrightDevPage) => Promise<CheckRestore>,
    { verifyDatabaseFailures = false } = {},
) {
    info.setTimeout(90000);
    page.setDefaultTimeout(10000);
    const name = 'e2e-workspace-snapshot';
    const missingName = 'e2e-missing-workspace';
    let rejectSave = verifyDatabaseFailures;
    let saved: { date: number } | undefined;
    await page.route('**/database/list/workspaces', (route) =>
        route.fulfill({
            json: {
                success: true,
                workspaces: saved
                    ? [
                          name,
                          ...(verifyDatabaseFailures ? [missingName] : []),
                      ].map((name) => ({ name, date: saved!.date }))
                    : [],
            },
        }),
    );
    await page.route(/\/database\/workspace(?:\/.*)?$/, async (route) => {
        if (
            new URL(route.request().url()).pathname.endsWith('/' + missingName)
        ) {
            await route.fulfill({ status: 404, json: { success: false } });
            return;
        }
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
        await route.fulfill({ json: { success: !!saved, workspace: saved } });
    });

    const carta = new PlaywrightDevPage(page);
    await carta.goto();
    const check = await prepare(carta);
    const viewer = page.getByTestId('viewer-div').first();
    const imageState = () =>
        page.evaluate(() => {
            const app = (window as any).app;
            return {
                files: app.frames.map((frame: any) => frame.filename),
                active: app.activeFrame?.filename,
                channel: app.activeFrame?.channel,
                stokes: app.activeFrame?.stokes,
            };
        });

    const before = await test.step('Verify and save the snapshot', async () => {
        await check('saved');
        await expect.poll(async () => (await renderedRgb(page))[3]).toBe(255);
        const rgb = await renderedRgb(page);
        const state = await imageState();
        expect(state.files.length).toBeGreaterThan(0);
        const windows = await workspaceWindows(page);
        expect(windows.docked.some((group) => group.tabs.length > 0)).toBe(
            true,
        );
        await attachWorkspacePng(info, 'saved-viewer', viewer);
        await info.attach('saved-workspace.png', {
            body: await page.screenshot(),
            contentType: 'image/png',
        });

        await carta.selectMenuItem('File', 'Save Workspace');
        const save = page.getByRole('dialog', {
            name: 'Save Workspace',
            exact: true,
        });
        const submit = save.getByRole('button', { name: 'Save', exact: true });
        await expect(submit).toBeDisabled();
        await save.getByPlaceholder('Enter workspace name').fill(name);
        await submit.click();
        if (verifyDatabaseFailures) {
            await expect(
                page.getByText('Error saving workspace', { exact: true }),
            ).toBeVisible();
            expect(saved).toBeUndefined();
            await expect(submit).toBeEnabled();
            await submit.click();
        }
        await expect(save).toBeHidden();
        expect(saved).toBeDefined();
        return { state, rgb, windows };
    });

    const open = page.getByRole('dialog', {
        name: 'Open Workspace',
        exact: true,
    });
    const openButton = open.getByRole('button', { name: 'Open', exact: true });
    if (verifyDatabaseFailures) {
        await test.step('A failed open preserves the current session', async () => {
            await carta.selectMenuItem('File', 'Open Workspace');
            await expect(openButton).toBeDisabled();
            await open.getByText(missingName, { exact: true }).first().click();
            await expect(
                open.getByText('Could not read the workspace'),
            ).toBeVisible();
            await openButton.click();
            await expect(
                page.getByText(`Could not load workspace "${missingName}"`, {
                    exact: true,
                }),
            ).toBeVisible();
            await expect(open).toBeVisible();
            await expect.poll(imageState).toEqual(before.state);
        });
    }

    await test.step('Open the snapshot in a fresh CARTA session', async () => {
        await carta.goto();
        await expect.poll(imageState).toMatchObject({ files: [] });
        await page
            .getByTestId('file-browser-dialog-header-close-button')
            .click();
        await carta.selectMenuItem('File', 'Open Workspace');

        await open.getByText(name, { exact: true }).first().click();
        await openButton.click();
        await expect(open).toBeHidden({ timeout: 30000 });
        await expect
            .poll(() =>
                page.evaluate(() => (window as any).app.isLoadingWorkspace),
            )
            .toBe(false);
    });

    await test.step('Compare the restored viewer, widgets and dialogs', async () => {
        await expect(viewer).toBeVisible();
        await attachWorkspacePng(info, 'restored-viewer', viewer);
        await info.attach('restored-workspace.png', {
            body: await page.screenshot(),
            contentType: 'image/png',
        });
        const compare = expect.configure({ soft: true });
        for (const panel of ['docked', 'floating', 'dialogs'] as const) {
            await compare
                .poll(
                    () => workspaceWindows(page).then((state) => state[panel]),
                    {
                        message: `Restored ${panel} should match the saved workspace`,
                    },
                )
                .toEqual(before.windows[panel]);
        }
        await compare.poll(imageState).toEqual(before.state);
        await compare.poll(() => renderedRgb(page)).toEqual(before.rgb);
        await check('restored');
    });
}

export async function attachWorkspacePng(
    info: TestInfo,
    name: string,
    target: Locator,
) {
    await info.attach(`${name}.png`, {
        body: await target.screenshot({ timeout: 5000 }),
        contentType: 'image/png',
    });
}

export async function workspaceRegion(page: Page, shape: 'rectangle' | 'line') {
    const canvas = page
        .locator('.region-stage > .konvajs-content > canvas')
        .first();
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    await page.getByTestId(`${shape}-region-shortcut-button`).click();
    await canvas.dragTo(canvas, {
        sourcePosition: { x: box.width * 0.35, y: box.height * 0.35 },
        targetPosition: { x: box.width * 0.65, y: box.height * 0.65 },
    });
    await expect
        .poll(() =>
            page.evaluate(
                () => (window as any).app.activeFrame.regionSet.regions.length,
            ),
        )
        .toBeGreaterThan(1);
}
