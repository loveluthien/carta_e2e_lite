import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
    path: fileURLToPath(new URL('../setting.env', import.meta.url)),
    quiet: true,
});

const testGroups = [
    {
        name: 'test-group1',
        testMatch: [
            '**/Animator.spec.ts',
            '**/Catalog.spec.ts',
            '**/Contours.spec.ts',
            '**/CursorInfo.spec.ts',
            '**/Histogram.spec.ts',
        ],
    },
    {
        name: 'test-group2',
        testMatch: [
            '**/ImageFitting.spec.ts',
            '**/ImageLayer.spec.ts',
            '**/ImageViewer.spec.ts',
            '**/Layout.spec.ts',
            '**/LoadingFiles.spec.ts',
            '**/OnlineDataQuery.spec.ts',
        ],
    },
    {
        name: 'test-group3',
        testMatch: [
            '**/PVImage.spec.ts',
            '**/Regions.spec.ts',
            '**/Snippets.spec.ts',
            '**/Statistics.spec.ts',
            '**/Stokes.spec.ts',
            '**/VectorOverlay.spec.ts',
        ],
    },
    {
        name: 'test-group4',
        testMatch: ['**/MomentMap.spec.ts'],
    },
    {
        name: 'test-group5',
        testMatch: [
            '**/ChannelMap.spec.ts',
            '**/BackendConnection.spec.ts',
            '**/Profilers.spec.ts',
            '**/Preferences.spec.ts',
        ],
    },
];
const defaultWorkers = Number(process.env.workers ?? 6);
if (!Number.isSafeInteger(defaultWorkers) || defaultWorkers < 1) {
    throw new Error('workers in setting.env must be a positive integer');
}
const projectNames = testGroups.map(({ name }) => name);

export { defaultWorkers, projectNames, testGroups };
