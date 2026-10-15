# Catalog test plan

**Source:** [`tests/Catalog.spec.ts`](../tests/Catalog.spec.ts) · **Cases:** 7

Local catalog table, overlay, plot, coordinate and styling behavior.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `catalog-image.fits`, `catalog-image-shifted.fits`, `catalog-angular-size-image.fits`.
- Referenced catalog fixtures: `catalog-sky.vot`, `catalog-pixel.vot`, `catalog-invalid.vot`, `catalog-angular-size.vot`.
- The toolbar case compares the viewer against a named PNG baseline. The other cases capture viewer and spatial-profile PNG artifacts in the Playwright output directory as diagnostic captures.

## Cases

| Test                                                                                                     | Action                                                                                                                                                      | Expected result                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [viewer toolbar selects a rendered catalog source](../tests/Catalog.spec.ts)                             | Load and plot a sky catalog; activate viewer catalog selection and click the rendered overlay.                                                              | Toolbar selection activates, one catalog source is selected in the store, and the viewer PNG shows the plotted overlay.                                                                                                                   |
| [loads sky sources, filters and sorts the table, and edits overlay styling](../tests/Catalog.spec.ts)    | Load the sky catalog; plot it, filter/sort/reset rows, limit row count, and map size, color and orientation columns.                                        | RA/Dec columns are selected, four sources are in frame, table counts follow each operation, all five mapped sizes follow their catalog values in increasing order, and the catalog/viewer/profile canvases render.                        |
| [verifies histogram bins and selects catalog rows from a bar](../tests/Catalog.spec.ts)                  | Plot Flux as a canvas histogram, export its bins as TSV, then locate and click the first blue bar by RGB.                                                   | Exported bin centers match the Flux range and counts are `[2,1,2]`; source indices 0 and 1 become selected, their table cells are highlighted, and the selected bar turns RGB `(172,47,51)`. Capture histogram, viewer and profiler PNGs. |
| [verifies scatter values and selects a catalog row from a point](../tests/Catalog.spec.ts)               | Plot Flux against Size, inspect both arrays, then click the point `(30, 8)`.                                                                                | Exported values match the catalog; clicking the middle rendered point selects source index 2 in the catalog store, highlights its table row and renders the point red.                                                                    |
| [renders angular major and minor axes with position angles and missing values](../tests/Catalog.spec.ts) | Load the 1 arcsec/pixel image and ten-row angular catalog; select Angular size and ellipse mode; map MajorAxis, MinorAxis and PositionAngle; toggle Radius. | All ten coordinates are in frame; mapped columns retain the expected values and missing entries; major and minor axes increase for the first four sources, position angles differ, Radius doubles both axes, and Diameter restores them.  |
| [handles pixel and invalid coordinates, closes and switches catalogs](../tests/Catalog.spec.ts)          | Load sky, pixel and invalid-coordinate catalogs; plot each; close the active catalog and switch back to the sky catalog.                                    | Four pixel sources and three valid-coordinate sources render; closing restores the prior five-row catalog and its RA/Dec selections.                                                                                                      |
| [keeps sky sources off a shifted image while pixel sources remain visible](../tests/Catalog.spec.ts)     | Load the WCS-shifted image, plot sky coordinates, then plot pixel coordinates.                                                                              | No sky source lands within the shifted field; four pixel sources remain visible and the viewer and profiler continue rendering.                                                                                                           |

## Plot hover toolbars

- For both histogram and scatter, move the pointer outside the plot and assert toolbar opacity is 0. Hover the canvas and wait for opacity 1; check every toolbar button is visible and enabled. Repeat after leaving the plot.
- Histogram exposes Export image and Export data. Scatter also exposes Box select, Lasso select and Zoom; click each mode and verify its active state, returning to Box select before selecting a point.
- Exercise PNG and TSV exports for both plots. Save exported PNGs and verify the numerical TSV contents. Capture plot, viewer and profiler PNGs after selection and check selected plot RGB `(172,47,51)`.

## Run

```sh
npm test -- --project=test-group1 tests/Catalog.spec.ts
```
