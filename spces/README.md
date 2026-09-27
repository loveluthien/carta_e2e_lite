# CARTA E2E test plans

This directory maps every currently collected Playwright test to its action and expected result. The collector reports **132 cases in 21 spec files**; the configured Chromium, Firefox and WebKit projects produce **396 browser runs**. These are plans derived from the current source, not execution results.

## Shared execution plan

1. Start from a fresh Playwright page and load the fixture used by the test. The configured server serves the frontend/backend at `http://localhost:3002` and reads `test_data`.
2. Drive each dialog or widget through its visible controls. Assert enabled/disabled state, labels, numeric values, generated frames and error/recovery behavior.
3. For changes affecting an image or profile, check both the state and rendered output. Review PNG baselines for viewer, profile or overlay changes; use deterministic values for numerical assertions.
4. Use the small FITS fixtures in `test_data` or extend `test_data/create.mjs` with bounded, deterministic data. Keep failures explicit, including invalid input and retry paths.
5. Run the focused spec in Chromium while developing, then all three configured browser projects. Review screenshot baselines per platform and inspect the HTML report for failures.

```sh
npx playwright test --list --project=chromium
npx playwright test --project=chromium
npx playwright test
```

## Plans

| Plan                                    | Cases | Focus                                                                                         |
| --------------------------------------- | ----: | --------------------------------------------------------------------------------------------- |
| [Animator](./Animator.md)               |     3 | Channel and polarization navigation, playback modes and synchronization with viewer/profiles. |
| [Catalog](./Catalog.md)                 |     6 | Local catalog table, overlay, plot, coordinate and styling behavior.                          |
| [ChannelMap](./ChannelMap.md)           |     2 | Channel-map empty state, controls, image panels and selection synchronization.                |
| [Contours](./Contours.md)               |     2 | Contour generation methods and rendered overlay styling.                                      |
| [CursorInfo](./CursorInfo.md)           |     1 | Cursor values and coordinates across viewer, widget and profilers.                            |
| [Histogram](./Histogram.md)             |     1 | Channel-dependent histogram and pixel-bound validation.                                       |
| [ImageFitting](./ImageFitting.md)       |     1 | Fit validation and derived model/residual images.                                             |
| [ImageLayer](./ImageLayer.md)           |     4 | Layer matching, WCS alignment and reordering.                                                 |
| [ImageViewer](./ImageViewer.md)         |    11 | Viewer controls, settings, layouts and raster appearance.                                     |
| [Layout](./Layout.md)                   |     4 | Built-in layouts, docking and context-aware menus.                                            |
| [LoadingFiles](./LoadingFiles.md)       |     3 | Fixture size, open/append, and invalid-file recovery.                                         |
| [MomentMap](./MomentMap.md)             |    53 | Moment generator data, controls, lifecycle and failure recovery.                              |
| [OnlineDataQuery](./OnlineDataQuery.md) |     1 | Query failure/retry and catalog overlay rendering.                                            |
| [Profilers](./Profilers.md)             |     8 | Spatial and spectral profiles, formatting, smoothing, fitting and viewer connection.          |
| [PVImage](./PVImage.md)                 |    19 | PV generator validation, output, preview and cancellation.                                    |
| [Regions](./Regions.md)                 |     1 | Region creation/editing, visibility, locking, deletion and profiler connection.               |
| [Snippets](./Snippets.md)               |     6 | Code Snippets workflows that create or modify image products.                                 |
| [Statistics](./Statistics.md)           |     2 | Statistics for regions across images and Stokes planes.                                       |
| [Stokes](./Stokes.md)                   |     2 | Stokes cube assembly and analysis widget controls.                                            |
| [TimeSeries](./TimeSeries.md)           |     1 | Dated series loading, ordering and navigation.                                                |
| [VectorOverlay](./VectorOverlay.md)     |     1 | Vector configuration, rendering, invalid sources and clearing.                                |

## Coverage notes

- Several current tests inspect app stores or compare screenshots without asserting all user-visible values. The per-case expected results are the checks to retain or add when tests are updated.
- Some spec files have no PNG assertion even when they affect an image or profiler. Add focused reviewed snapshots there rather than treating canvas visibility as a visual regression check.
- The existing `specs/MomentMap.md` describes an earlier design and includes stale implementation status. Use `spces/MomentMap.md` for the inventory of current tests.
- These files document the suite; no CARTA browser test was executed as part of writing them.
