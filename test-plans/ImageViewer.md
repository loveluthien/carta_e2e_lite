# ImageViewer test plan

**Source:** [`tests/ImageViewer.spec.ts`](../tests/ImageViewer.spec.ts) · **Cases:** 16

Viewer controls, settings, layouts and raster appearance.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. The local Playwright fixtures start CARTA and provide the viewer locator; each case loads its own image and applies its own settings.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `HD163296_13CO_2-1_subimage.fits`, `M17_SWex.fits`, `cube.fits`, `matching-cube.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test                                                                                    | Action                                                                                                 | Expected result                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [Image Viewer](../tests/ImageViewer.spec.ts)                                            | Load and append images; switch single/multi-panel views and maximize.                                  | Toolbar controls, image titles and panels are visible; compare viewer PNGs for image, multi-panel and maximize states. |
| [Image Viewer Toolbar](../tests/ImageViewer.spec.ts)                                    | Use zoom, pan, coordinate, grid, labels, region and channel-map toolbar controls.                      | Each toolbar action changes the intended viewer state; coordinate menu and region affordances appear; compare PNGs.    |
| [Image Viewer Settings - Pan and Zoom](../tests/ImageViewer.spec.ts)                    | Open settings Pan and Zoom; change fixed panel dimensions, zoom and position.                          | Fields report current and edited values; panel dimensions and viewport PNGs reflect the changes.                       |
| [Image Viewer Settings - Global](../tests/ImageViewer.spec.ts)                          | Edit Global settings across multiple frames, including panel layout, background and coordinate system. | Global control state and 1×3/2×2/2×3 panel rendering match selected settings.                                          |
| [Image Viewer Settings - Title and ticks](../tests/ImageViewer.spec.ts)                 | Toggle custom title and tick placement, color, width and density.                                      | Title/tick controls show edited values; viewer PNGs show visible labels and ticks.                                     |
| [Image Viewer Settings - Grid](../tests/ImageViewer.spec.ts)                            | Change grid visibility, gap and color.                                                                 | Grid controls and PNGs reflect each update.                                                                            |
| [Image Viewer Settings - Border and Axes](../tests/ImageViewer.spec.ts)                 | Edit border and axes settings.                                                                         | Control accessibility state and viewer PNGs show the chosen border/axes presentation.                                  |
| [Image Viewer Settings - Numbers and Labels](../tests/ImageViewer.spec.ts)              | Edit numbers and coordinate labels, including offset/galactic display.                                 | Settings state and viewer PNGs show numbers, labels and coordinate formatting.                                         |
| [Image Viewer Settings - Colorbar](../tests/ImageViewer.spec.ts)                        | Edit colorbar visibility, position, ticks, labels and number formatting.                               | Colorbar settings and viewer PNGs track each option.                                                                   |
| [Image Viewer Settings - Beam](../tests/ImageViewer.spec.ts)                            | Toggle beam overlay and its styling.                                                                   | Beam indicator is shown/hidden in corresponding viewer PNGs.                                                           |
| [Raster Configuration](../tests/ImageViewer.spec.ts)                                    | Change channel, scaling, percentile, alpha, gamma, colormap, inversion, bias and histogram options.    | Raster PNGs differ as expected for each rendering mode and colorbar.                                                   |
| [toolbar toggle and all export resolutions](../tests/ImageViewer.spec.ts)               | Hide and restore the toolbar; export PNGs at 100%, 200%, and 400%.                                     | Toolbar buttons disappear and return; each export is a valid PNG with the expected dimensions; compare raster PNG.     |
| [viewer matching controls spatial and spectral alignment](../tests/ImageViewer.spec.ts) | Apply none, spatial, spectral, and combined matching to an appended cube.                              | Frame references follow each selection and clear when matching is removed; compare viewer PNG.                         |
| [header paging, help, maximize, restore, and popout](../tests/ImageViewer.spec.ts)      | Page between images; open help, maximize and restore the viewer, then pop it out.                      | Title follows paging, help appears and closes, maximize state changes, and popup viewer renders; compare PNG.          |
| [ruler creation renders a measured region](../tests/ImageViewer.spec.ts)                | Create a distance ruler over the image.                                                                | A ruler region is added with measured geometry and its labels render in the viewer PNG.                                |
| [raster RGB and invalid beam width](../tests/ImageViewer.spec.ts)                       | Check raster center RGB, select gray, reject beam width 20, then set width 2.                          | Center RGB is in expected ranges, gray channels match, invalid width leaves state unchanged, and PNGs render.          |

## Run

```sh
npx playwright test tests/ImageViewer.spec.ts --project=chromium
npx playwright test tests/ImageViewer.spec.ts
```
