import { expect, test, type Page } from '@playwright/test';
import { LayoutName, PlaywrightDevPage } from '../utilities';

async function moveCursorToPixel(page: Page, x: number, y: number) {
    const canvas = page
        .locator('.region-stage > .konvajs-content > canvas')
        .first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const view = await page.evaluate(
        () => (window as any).app.activeFrame.requiredFrameView,
    );

    const position = {
        x: ((x - view.xMin) / (view.xMax - view.xMin)) * box!.width,
        y: ((view.yMax - y) / (view.yMax - view.yMin)) * box!.height,
    };
    await canvas.dispatchEvent('mousemove', {
        bubbles: true,
        clientX: box!.x + position.x,
        clientY: box!.y + position.y,
    });
    await expect
        .poll(() =>
            page.evaluate(
                ({ x, y }) => {
                    const position = (window as any).app.activeFrame.cursorInfo
                        ?.posImageSpace;
                    return (
                        position &&
                        Math.round(position.x) === x &&
                        Math.round(position.y) === y
                    );
                },
                { x, y },
            ),
        )
        .toBe(true);
}

test.describe('Cursor info widget E2E set', () => {
    test('reports cursor state in the viewer and profilers', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        const viewer = page.getByTestId('viewer-div');

        await carta.goto();
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Cursor Info Widget',
        ]);

        const widgetContent = page.locator(
            '[data-testid^="cursor-info-"][data-testid$="-content"]',
        );
        await expect(widgetContent).toContainText('No file loaded');

        await carta.loadImage('cube.fits');
        await carta.applyLayout(LayoutName.Default);
        await expect(viewer).toBeVisible();
        await carta.selectMenuItem('Widgets', [
            'Info Panels',
            'Cursor Info Widget',
        ]);

        const widget = page.locator('.cursor-info-widget');

        await moveCursorToPixel(page, 7, 7);
        await moveCursorToPixel(page, 8, 8);
        await page.locator('#SpectralProfilerButton').click();
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const frame = (window as any).app.activeFrame;
                    return frame.isCursorValueCurrent
                        ? frame.cursorValue?.value
                        : undefined;
                }),
            )
            .toBeCloseTo(1.5, 3);
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            '1.5 K',
        );
        await expect(widget.getByTestId('simple-table-0-0')).toHaveText(
            'cube.fits',
        );
        await expect(widget.getByTestId('simple-table-0-1')).toContainText(
            '1.5',
        );
        await expect(widget.getByTestId('simple-table-0-1')).toContainText('K');
        await expect(widget.getByTestId('simple-table-0-4')).toContainText(
            '8.01',
        );
        await expect(widget.getByTestId('simple-table-0-6')).toHaveText('0');

        await expect(page.getByTestId('x-profiler-info')).toContainText(
            'Image: 8 px, 1.5',
        );
        await expect(page.getByTestId('y-profiler-info')).toContainText(
            'Image: 8 px, 1.5',
        );

        await page
            .locator(
                '[data-testid^="cursor-info-"][data-testid$="-header-title"]',
            )
            .last()
            .dispatchEvent('mousedown');
        await carta.screenShot(viewer, 'CursorInfo_Viewer.png');
        await carta.screenShot(widget, 'CursorInfo_Widget.png');

        await page.locator('#SpectralProfilerButton').click();
        await expect(
            page.locator('[data-testid^="spectral-profiler-info-"]').last(),
        ).toContainText('1.5');

        await carta.screenShot(
            page
                .locator(
                    '.line-plot-component > .annotation-stage > .konvajs-content > canvas',
                )
                .first(),
            'CursorInfo_Profiler.png',
        );

        await moveCursorToPixel(page, 1, 1);
        await expect
            .poll(() =>
                page.evaluate(
                    () => (window as any).app.activeFrame.cursorValue?.value,
                ),
            )
            .toBeNaN();
        await expect(page.getByTestId('viewer-cursor-info-bar')).toContainText(
            'NaN',
        );
        await expect(widget.getByTestId('simple-table-0-1')).toContainText(
            'NaN',
        );
    });
});
