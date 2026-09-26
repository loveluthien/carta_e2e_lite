import { expect, test } from '@playwright/test';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { getFrames, PlaywrightDevPage } from '../utilities';

const directory = '/carta_build/e2e-lite/test_data';

test.describe('Loading files', () => {
    test.setTimeout(60_000);

    test('small mock images load into the viewer and profiler', async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const fixtureDirectory = path.resolve(__dirname, '../test_data');
        for (const name of readdirSync(fixtureDirectory, {
            recursive: true,
        }).filter((name) => name.endsWith('.fits'))) {
            expect(
                statSync(path.join(fixtureDirectory, name)).size,
                name,
            ).toBeLessThanOrEqual(2_000_000);
        }

        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        for (const name of [
            'm16_f0444w.fits',
            'm16_f0770w.fits',
            'm16_f1130w.fits',
            'm16_f1500w.fits',
            'M17_SWex.fits',
            'HD163296_13CO_2-1_subimage.fits',
            'HD163296_C18O_2-1_subimage.fits',
            'Gaussian_array_wide.fits',
            'IRCp10216_sci.spw0.cube.I.manual.pbcor.fits',
        ]) {
            await carta.loadImage(name);
            await expect
                .poll(() => getFrames(page))
                .toMatchObject([{ filename: name }]);
            await expect(page.getByTestId('viewer-div')).toBeVisible();
            await page
                .locator('.region-stage > .konvajs-content > canvas')
                .first()
                .hover();
            await expect(page.getByTestId('x-profiler-info')).toContainText(
                'Data:',
            );
        }
    });

    test('opens and appends images in the viewer and profiler', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        const browser = page.getByTestId('file-browser-dialog');
        await expect(browser).toBeVisible();
        await browser.locator('.edit-path-button').click();
        const path = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await path.fill(directory);
        await path.press('Enter');

        await carta.loadImage('M17_SWex.fits');
        await expect(browser).toBeHidden();
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([{ filename: 'M17_SWex.fits' }]);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'M17_SWex.fits',
        );
        const firstImage = await page.getByTestId('viewer-div').screenshot();
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .first()
            .hover({ position: { x: 300, y: 200 } });
        await expect(page.getByTestId('x-profiler-info')).toContainText(
            'Data:',
        );
        const profile = page
            .locator('.spatial-profiler-widget .profile-plot')
            .first();
        const firstProfile = await profile.screenshot();

        await carta.loadImage('HD163296_13CO_2-1_subimage.fits', true);
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([
                { filename: 'M17_SWex.fits' },
                { filename: 'HD163296_13CO_2-1_subimage.fits' },
            ]);
        await expect(page.getByTestId('image-view-header-title')).toContainText(
            'HD163296_13CO_2-1_subimage.fits',
        );
        expect(
            (await page.getByTestId('viewer-div').screenshot()).equals(
                firstImage,
            ),
        ).toBe(false);
        await page.evaluate(() => {
            const frame = (window as any).app.activeFrame;
            frame.setCursorPosition({ x: 45, y: 45 });
            frame.updateCursorRegion({ x: 45, y: 45 });
        });
        await expect(page.getByTestId('x-profiler-info')).toContainText(
            'Data:',
        );
        expect((await profile.screenshot()).equals(firstProfile)).toBe(false);
    });

    test('rejects an invalid FITS file and then loads a valid image', async ({
        page,
    }) => {
        const carta = new PlaywrightDevPage(page);
        await carta.goto();
        const browser = page.getByTestId('file-browser-dialog');
        await browser.locator('.edit-path-button').click();
        const path = browser.getByPlaceholder(
            'Input directory path with respect to the top level folder',
        );
        await path.fill(directory);
        await path.press('Enter');

        const filter = browser.getByRole('textbox', {
            name: 'Filter by filename with fuzzy',
        });
        await filter.fill('invalid.fits');
        await filter.press('Enter');
        await browser
            .getByText('invalid.fits', { exact: true })
            .first()
            .click();
        await expect(browser.getByText('Cannot open file!')).toBeVisible();
        await expect(
            browser.getByRole('button', { name: 'Load' }),
        ).toBeDisabled();
        await expect.poll(() => getFrames(page)).toHaveLength(0);

        await carta.loadImage('cube.fits');
        await expect
            .poll(() => getFrames(page))
            .toMatchObject([
                { filename: 'cube.fits', width: 16, height: 16, channels: 5 },
            ]);
        await expect(page.locator('#raster-canvas').first()).toBeVisible();
        await page
            .locator('.region-stage > .konvajs-content > canvas')
            .first()
            .hover();
        await expect(page.getByTestId('x-profiler-info')).toContainText(
            'Data:',
        );
    });
});
