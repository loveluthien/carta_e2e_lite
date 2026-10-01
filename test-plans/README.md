# CARTA E2E test plans

This directory maps every currently collected Playwright test to its action and expected result. The collector reports **154 cases in 21 spec files**. The Playwright configuration currently enables Chromium. These are plans derived from the current source, not execution results.

## Shared execution plan

1. Start from a fresh Playwright page with a 1920×1080 viewport and load the fixture used by the test. The shared backend serves tests at `http://localhost:<CARTA_PORT>` (`3102` by default); Moment Map uses its own backend at `http://localhost:<CARTA_MOMENT_MAP_PORT>` (`3103` by default). Both read `test_data`.
2. Drive each dialog or widget through its visible controls. Assert enabled/disabled state, labels, numeric values, generated frames and error/recovery behavior.
3. For changes affecting an image or profile, check both the state and rendered output. Review PNG baselines for viewer, profile or overlay changes; use deterministic values for numerical assertions.
4. At app startup, `goto()` sets `telemetryMode: "none"` and marks telemetry consent as handled before test interactions. Before changing other persisted preferences, call `resetAllPreferences()` and then set only the values needed by the test. Tests that need the shared multi-panel baseline can use `setTestPreferences()`, which resets preferences before applying that baseline. Use the small FITS fixtures in `test_data` or extend `test_data/create.mjs` with bounded, deterministic data. Keep failures explicit, including invalid input and retry paths.
5. Run the focused spec in Chromium while developing, then all configured browser projects. Review screenshot baselines per platform and inspect the HTML report for failures.

```sh
npx playwright test --list --project=chromium
npx playwright test --project=chromium
npx playwright test
```

Each `npx playwright test` invocation starts one shared CARTA backend and one dedicated Moment Map backend. The default is two workers; adjust `workers` in `playwright.config.ts` to change browser parallelism without starting more backends.

## Test title style

Use concise Title Case names for `test.describe()` groups. Write individual test titles in sentence case, describe the behavior being checked, and omit trailing punctuation. The E2E context is implicit, so do not add an `E2E` suffix to group names.

## Plans

| Plan                                    | Cases | Focus                                                                                                                           |
| --------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------- |
| [Animator](./Animator.md)               |     5 | Channel and polarization navigation, spectral matching, playback modes and viewer/profile synchronization.                      |
| [Catalog](./Catalog.md)                 |     7 | Local catalog table, overlay, plot, coordinate and styling behavior.                                                            |
| [ChannelMap](./ChannelMap.md)           |     4 | Channel-map empty state, controls, image panels and selection synchronization.                                                  |
| [Contours](./Contours.md)               |     8 | Generators, scaling, Apply/Clear recovery, styling, spatial and spectral matching together, histogram and smoothing.            |
| [CursorInfo](./CursorInfo.md)           |     1 | Cursor values and coordinates across viewer, widget and profilers.                                                              |
| [Histogram](./Histogram.md)             |     1 | Channel-dependent histogram and pixel-bound validation.                                                                         |
| [ImageFitting](./ImageFitting.md)       |     2 | Fit validation and derived model/residual images.                                                                               |
| [ImageLayer](./ImageLayer.md)           |     6 | Layer matching, WCS alignment and reordering.                                                                                   |
| [ImageViewer](./ImageViewer.md)         |    16 | Viewer controls, settings, layouts and raster appearance.                                                                       |
| [Layout](./Layout.md)                   |     5 | Preset layouts, docking, dynamic layout mappings and context-aware menus.                                                       |
| [LoadingFiles](./LoadingFiles.md)       |     8 | Fixture size, open/append, invalid-file recovery, and FITS/HDF5/CASA metadata and rendering.                                    |
| [MomentMap](./MomentMap.md)             |    39 | Moment generator data, controls, lifecycle and failure recovery.                                                                |
| [OnlineDataQuery](./OnlineDataQuery.md) |     1 | Query failure/retry and catalog overlay rendering.                                                                              |
| [Profilers](./Profilers.md)             |    12 | Spatial and spectral profiles, formatting, smoothing, matching and viewer connection.                                           |
| [PVImage](./PVImage.md)                 |    20 | PV generator validation, output, preview and cancellation.                                                                      |
| [Regions](./Regions.md)                 |     5 | All region shapes, CRTF/DS9 load/save, spatial matching, styling and title edits, Region List actions, and profiler connection. |
| [Snippets](./Snippets.md)               |     6 | Code Snippets workflows that create or modify image products.                                                                   |
| [Statistics](./Statistics.md)           |     2 | Statistics for regions across images and Stokes planes.                                                                         |
| [Stokes](./Stokes.md)                   |     3 | Stokes cube assembly and analysis widget controls.                                                                              |
| [TimeSeries](./TimeSeries.md)           |     1 | Dated series loading, ordering and navigation.                                                                                  |
| [VectorOverlay](./VectorOverlay.md)     |     2 | Vector configuration, rendering, invalid sources and clearing.                                                                  |

## Coverage notes

- The 154-case count is collection output, not a passing-test count. Chromium is the only enabled browser project; Firefox and WebKit are currently commented out in `playwright.config.ts`.
- Coverage targets selected functional workflows and recovery paths described in the linked plans. It does not establish exhaustive coverage of every CARTA widget or dialog control, and it does not measure performance.
- Visual checks are targeted: selected viewer and profiler outputs use reviewed PNG snapshots or direct pixel/RGB assertions. Other cases rely on UI state or data assertions, so a snapshot does not imply that every visible property is compared.
- Three Moment Map cases are annotated with `test.fail()` to track known defects: generation with no selected moments, the rest-frequency reset control remaining enabled, and a missing warning for malformed generated-image acknowledgments. Check the Playwright report to see how those cases behave in a given run.
- Each plan records the checks present in the current spec; neither the plans nor test collection indicate that a suite has passed.
