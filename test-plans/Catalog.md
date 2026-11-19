# Catalog test plan

**Source:** [`tests/Catalog.spec.ts`](../tests/Catalog.spec.ts) · **Cases:** 16

Local catalog table, overlay, plot, coordinate and styling behavior.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `catalog-image.fits`, `catalog-image-shifted.fits`, `catalog-angular-size-image.fits`, `catalog-format-image.fits`.
- Referenced catalog fixtures: `catalog-sky.vot`, `catalog-pixel.vot`, `catalog-invalid.vot`, `catalog-angular-size.vot`, `catalog-sky.xml`, `catalog-missing-tabledata.xml`.
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
| [imports a VOTable with an XML extension and renders its sources](../tests/Catalog.spec.ts)              | Import the same sky catalog as `.vot` and `.xml`, plot both, and compare the overlay coordinates.                                                           | The `.xml` file is listed and imported as a catalog, its table rows load, and its four rendered sources match the `.vot` control positions. Capture viewer and profiler PNGs.                                                             |
| [rejects XML without table data and recovers by loading a valid catalog](../tests/Catalog.spec.ts)       | Import a well-formed VOTable header with no `TABLEDATA`, dismiss the error, then import a valid `.xml` catalog.                                             | The invalid file reports an error without adding a catalog; the browser stays usable, and the valid catalog subsequently plots four turquoise sources with viewer and profiler PNG captures.                                              |

## Plot hover toolbars

- For both histogram and scatter, move the pointer outside the plot and assert toolbar opacity is 0. Hover the canvas and wait for opacity 1; check every toolbar button is visible and enabled. Repeat after leaving the plot.
- Histogram exposes Export image and Export data. Scatter also exposes Box select, Lasso select and Zoom; click each mode and verify its active state, returning to Box select before selecting a point.
- Check the full suggested download names: `catalog-histogram-Flux-YYYY-MM-DD-HH-mm-ss.png/.tsv` and `catalog-scatter-Flux-Size-YYYY-MM-DD-HH-mm-ss.png/.tsv`, rejecting missing prefixes, malformed timestamp structure, wrong extensions and trailing suffixes.
- Exercise PNG and TSV exports for both plots. Save exported PNGs and verify the numerical TSV contents. Capture plot, viewer and profiler PNGs after selection and check selected plot RGB `(172,47,51)`.

## Run

```sh
npm test -- --project=test-group1 tests/Catalog.spec.ts
```

## String coordinate regression coverage (PR #2956)

Use `catalog-format-image.fits`, a deterministic 16 × 16 image centred on RA 150.01°, Dec 2.52° with 0.01° pixels. All 20 reference sources fit inside this image; the manual suite's original mosaic has a smaller footprint.

| Test                        | Action and expected result                                                                                                                                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| String coordinate formats   | Compare all 20 rendered positions with `00_baseline_decimal_deg.vot` for one string path (colon coordinates with units) and one numeric path (radians). Each axis agrees within 0.01 image pixels. The full syntax/unit matrix belongs to frontend `src/utilities/catalog/coordinateFormat.matrix.test.ts`.                                   |
| Coordinate systems          | Galactic/ecliptic sexagesimal coordinates, implicit FK4 B1950 and explicit FK4 B1900 transform to the decimal control positions.                                                                                                                                                                                                  |
| Column discovery            | Unitless string coordinates beyond the default display cutoff are fetched and selected; error/proper-motion decoys do not replace the real axes. All 20 sources render at their control positions.                                                                                                                                |
| Invalid rows                | Out-of-range latitudes reject rows 2, 9, 17; malformed strings reject rows 1, 9, 18 (one-based). The other 17 markers keep their control positions and row identities.                                                                                                                                                            |
| Numeric plot transitions    | Switching from string overlay axes to histogram or scatter clears unsupported axes and disables Plot. String coordinates are absent from the numeric menu; selecting Jmag (and Hmag for scatter) produces a blue plot. Exported histogram counts sum to 20; scatter exports all 20 pairs with the expected first and last values. |
| Manual coordinate selection | Correct swapped names through the axis menus. Anonymous columns initially disable Plot; selecting col_a/col_b restores all 20 control positions.                                                                                                                                                                                  |
| Late streamed recognition   | Import 1200 rows with the first 60 coordinate pairs blank. Plot fetches subsequent chunks and renders 1140 valid sources, excluding the initial blank rows.                                                                                                                                                                       |

Coordinate overlay cases compare PNG baselines and exact marker RGB `(0,163,150)`. Every case captures the image viewer and spatial profiler, and numeric transitions capture both plots. Coordinate parsing edge-case matrices remain in frontend unit tests; these cases verify file loading, axis selection, streaming, WCS conversion and rendering together.

## Unit-test boundary

The configured frontend (`carta-frontend`) owns radius/diameter arithmetic in `src/stores/Catalog/CatalogDisplayStore.test.ts`. E2E still maps the real catalog columns and checks their data, then compares the diameter, radius and restored-diameter PNGs. Avoid repeating the factor-of-two store assertions here. Keep coordinate-system transforms, discovery, invalid-row identity, manual correction and streamed loading because these exercise integration beyond parsing.
