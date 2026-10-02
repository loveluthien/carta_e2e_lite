export const testGroups = [
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
            '**/TimeSeries.spec.ts',
            'VectorOverlay.spec.ts',
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
            '**/Profilers.spec.ts',
        ],
    },
];

export const defaultWorkers = 6;

export const projectNames = testGroups.map(({ name }) => name);
