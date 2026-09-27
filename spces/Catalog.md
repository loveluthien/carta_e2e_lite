# Catalog test plan

**Source:** [`tests/Catalog.spec.ts`](../tests/Catalog.spec.ts) · **Cases:** 3

Local catalog table, overlay, plot, coordinate and styling behavior.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `catalog-image-shifted.fits`, `catalog-image.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                                       | Action                                                                                                       | Expected result                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [loads sky sources, filters and sorts the table, and edits overlay styling](../tests/Catalog.spec.ts#L137)               | Load a local sky catalog; plot it, filter/sort/reset rows, limit row count, and edit size/color/orientation. | Table counts and selected columns update; four in-frame sources and nonempty catalog canvas remain visible alongside viewer and profiler. |
| [plots histogram and scatter, handles pixel and invalid coordinates, and closes catalogs](../tests/Catalog.spec.ts#L222) | Plot histogram and scatter, then pixel and invalid-coordinate catalogs; close and switch catalogs.           | Plot SVGs render; valid pixel points render while bad positions are excluded; table and columns restore after closing.                    |
| [keeps sky sources off a shifted image while pixel sources remain visible](../tests/Catalog.spec.ts#L296)                | Load a WCS-shifted image, plot sky coordinates, then pixel coordinates.                                      | No sky source lands within the shifted field; four pixel sources remain visible and canvas/viewer/profiler render.                        |

## Run

```sh
npx playwright test tests/Catalog.spec.ts --project=chromium
npx playwright test tests/Catalog.spec.ts
```
