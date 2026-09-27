# Catalog test plan

**Source:** [`tests/Catalog.spec.ts`](../tests/Catalog.spec.ts) · **Cases:** 6

Local catalog table, overlay, plot, coordinate and styling behavior.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `catalog-image.fits`, `catalog-image-shifted.fits`, `catalog-angular-size-image.fits`.
- Referenced catalog fixtures: `catalog-sky.vot`, `catalog-pixel.vot`, `catalog-invalid.vot`, `catalog-angular-size.vot`.
- Each case captures viewer and spatial-profile PNG artifacts in the Playwright output directory. They are diagnostic captures rather than checked-in screenshot baselines.

## Cases

| Test (source line)                                                                                            | Action                                                                                                                                                      | Expected result                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [loads sky sources, filters and sorts the table, and edits overlay styling](../tests/Catalog.spec.ts#L255)    | Load the sky catalog; plot it, filter/sort/reset rows, limit row count, and map size, color and orientation columns.                                        | RA/Dec columns are selected, four sources are in frame, table counts follow each operation, mapped sizes remain ordered and distinct, and the catalog/viewer/profile canvases render.        |
| [verifies histogram bins and selects catalog rows from a bar](../tests/Catalog.spec.ts#L347)                  | Plot Flux as a histogram, inspect its data and bins, then click the first bar.                                                                              | Values are `[10,20,30,40,50]`, bin counts are `[2,1,2]`, source indices 0 and 1 become selected, and their table cells are highlighted.                                                      |
| [verifies scatter values and selects a catalog row from a point](../tests/Catalog.spec.ts#L377)               | Plot Flux against Size, inspect both arrays, then click the point `(30, 8)`.                                                                                | Plot values match the catalog, source index 2 is selected in Plotly and the catalog store, and its table row is highlighted.                                                                 |
| [renders angular major and minor axes with position angles and missing values](../tests/Catalog.spec.ts#L419) | Load the 1 arcsec/pixel image and ten-row angular catalog; select Angular size and ellipse mode; map MajorAxis, MinorAxis and PositionAngle; toggle Radius. | All ten coordinates are in frame; empty and explicit `NaN` cells normalize safely; rendered axes and P.A. arrays match expected values; Radius doubles both axes and Diameter restores them. |
| [handles pixel and invalid coordinates, closes and switches catalogs](../tests/Catalog.spec.ts#L514)          | Load sky, pixel and invalid-coordinate catalogs; plot each; close the active catalog and switch back to the sky catalog.                                    | Four pixel sources and three valid-coordinate sources render; closing restores the prior five-row catalog and its RA/Dec selections.                                                         |
| [keeps sky sources off a shifted image while pixel sources remain visible](../tests/Catalog.spec.ts#L548)     | Load the WCS-shifted image, plot sky coordinates, then plot pixel coordinates.                                                                              | No sky source lands within the shifted field; four pixel sources remain visible and the viewer and profiler continue rendering.                                                              |

## Run

```sh
npx playwright test tests/Catalog.spec.ts --project=chromium
npx playwright test tests/Catalog.spec.ts
```
