# CARTA E2E test plans

This directory maps every currently collected Playwright test to its action and expected result. The collector reports **136 cases in 21 spec files**. The current Playwright configuration enables Chromium. These are plans derived from the current source, not execution results.

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

## Plans

| Plan                                    | Cases | Focus                                                                                         |
| --------------------------------------- | ----: | --------------------------------------------------------------------------------------------- |
| [Animator](./Animator.md)               |     4 | Channel and polarization navigation, playback modes and synchronization with viewer/profiles. |
| [Catalog](./Catalog.md)                 |     7 | Local catalog table, overlay, plot, coordinate and styling behavior.                          |
| [ChannelMap](./ChannelMap.md)           |     4 | Channel-map empty state, controls, image panels and selection synchronization.                |
| [Contours](./Contours.md)               |     4 | Generators, scaling, Apply/Clear recovery, and rendered overlay styling.                      |
| [CursorInfo](./CursorInfo.md)           |     1 | Cursor values and coordinates across viewer, widget and profilers.                            |
| [Histogram](./Histogram.md)             |     1 | Channel-dependent histogram and pixel-bound validation.                                       |
| [ImageFitting](./ImageFitting.md)       |     1 | Fit validation and derived model/residual images.                                             |
| [ImageLayer](./ImageLayer.md)           |     4 | Layer matching, WCS alignment and reordering.                                                 |
| [ImageViewer](./ImageViewer.md)         |    16 | Viewer controls, settings, layouts and raster appearance.                                     |
| [Layout](./Layout.md)                   |     5 | Preset layouts, docking, dynamic layout mappings and context-aware menus.                     |
| [LoadingFiles](./LoadingFiles.md)       |     8 | Fixture size, open/append, invalid-file recovery, and FITS/HDF5/CASA metadata and rendering.  |
| [MomentMap](./MomentMap.md)             |    39 | Moment generator data, controls, lifecycle and failure recovery.                              |
| [OnlineDataQuery](./OnlineDataQuery.md) |     1 | Query failure/retry and catalog overlay rendering.                                            |
| [Profilers](./Profilers.md)             |     8 | Spatial and spectral profiles, formatting, smoothing, fitting and viewer connection.          |
| [PVImage](./PVImage.md)                 |    20 | PV generator validation, output, preview and cancellation.                                    |
| [Regions](./Regions.md)                 |     1 | Region creation/editing, visibility, locking, deletion and profiler connection.               |
| [Snippets](./Snippets.md)               |     6 | Code Snippets workflows that create or modify image products.                                 |
| [Statistics](./Statistics.md)           |     2 | Statistics for regions across images and Stokes planes.                                       |
| [Stokes](./Stokes.md)                   |     2 | Stokes cube assembly and analysis widget controls.                                            |
| [TimeSeries](./TimeSeries.md)           |     1 | Dated series loading, ordering and navigation.                                                |
| [VectorOverlay](./VectorOverlay.md)     |     1 | Vector configuration, rendering, invalid sources and clearing.                                |

## Coverage notes

- Several current tests inspect app stores or compare screenshots without asserting all user-visible values. The per-case expected results are the checks to retain or add when tests are updated.
- Some spec files have no PNG assertion even when they affect an image or profiler. Add focused reviewed snapshots there rather than treating canvas visibility as a visual regression check.
- `MomentMap.md` and `Contours.md` map current cases to their expected outcomes; plans are not claims that every suite case has passed.
- The Contours spec passed all 4 cases in the currently configured Chromium project.
