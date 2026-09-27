# ImageViewer test plan

**Source:** [`tests/ImageViewer.spec.ts`](../tests/ImageViewer.spec.ts) · **Cases:** 11

Viewer controls, settings, layouts and raster appearance.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `HD163296_13CO_2-1_subimage.fits`, `M17_SWex.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                               | Action                                                                                                 | Expected result                                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [Image Viewer](../tests/ImageViewer.spec.ts#L5)                                  | Load and append images; switch single/multi-panel views and maximize.                                  | Toolbar controls, image titles and panels are visible; compare viewer PNGs for image, multi-panel and maximize states. |
| [Image Viewer Toolbar](../tests/ImageViewer.spec.ts#L144)                        | Use zoom, pan, coordinate, grid, labels, region and channel-map toolbar controls.                      | Each toolbar action changes the intended viewer state; coordinate menu and region affordances appear; compare PNGs.    |
| [Image Viewer Settings - Pan and Zoom](../tests/ImageViewer.spec.ts#L303)        | Open settings Pan and Zoom; change fixed panel dimensions, zoom and position.                          | Fields report current and edited values; panel dimensions and viewport PNGs reflect the changes.                       |
| [Image Viewer Settings - Global](../tests/ImageViewer.spec.ts#L459)              | Edit Global settings across multiple frames, including panel layout, background and coordinate system. | Global control state and 1×3/2×2/2×3 panel rendering match selected settings.                                          |
| [Image Viewer Settings - Title and ticks](../tests/ImageViewer.spec.ts#L634)     | Toggle custom title and tick placement, color, width and density.                                      | Title/tick controls show edited values; viewer PNGs show visible labels and ticks.                                     |
| [Image Viewer Settings - Grid](../tests/ImageViewer.spec.ts#L798)                | Change grid visibility, gap and color.                                                                 | Grid controls and PNGs reflect each update.                                                                            |
| [Image Viewer Settings - Border and Axes](../tests/ImageViewer.spec.ts#L912)     | Edit border and axes settings.                                                                         | Control accessibility state and viewer PNGs show the chosen border/axes presentation.                                  |
| [Image Viewer Settings - Numbers and Labels](../tests/ImageViewer.spec.ts#L1011) | Edit numbers and coordinate labels, including offset/galactic display.                                 | Settings state and viewer PNGs show numbers, labels and coordinate formatting.                                         |
| [Image Viewer Settings - Colorbar](../tests/ImageViewer.spec.ts#L1144)           | Edit colorbar visibility, position, ticks, labels and number formatting.                               | Colorbar settings and viewer PNGs track each option.                                                                   |
| [Image Viewer Settings - Beam](../tests/ImageViewer.spec.ts#L1402)               | Toggle beam overlay and its styling.                                                                   | Beam indicator is shown/hidden in corresponding viewer PNGs.                                                           |
| [Raster Configuration](../tests/ImageViewer.spec.ts#L1455)                       | Change channel, scaling, percentile, alpha, gamma, colormap, inversion, bias and histogram options.    | Raster PNGs differ as expected for each rendering mode and colorbar.                                                   |

## Run

```sh
npx playwright test tests/ImageViewer.spec.ts --project=chromium
npx playwright test tests/ImageViewer.spec.ts
```
