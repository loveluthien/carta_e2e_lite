# CursorInfo test plan

**Source:** [`tests/CursorInfo.spec.ts`](../tests/CursorInfo.spec.ts) · **Cases:** 1

Cursor values and coordinates across viewer, widget and profilers.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `cube.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                  | Action                                                                                                                       | Expected result                                                                                                                        |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [reports cursor state in the viewer and profilers](../tests/CursorInfo.spec.ts#L42) | Open Cursor Info before loading; load cube.fits and move to valid and blank pixels while opening spatial/spectral profilers. | Empty state appears first; viewer, widget, and profiler agree on value/units/coordinates; blank pixel reports NaN; compare three PNGs. |

## Run

```sh
npm test -- --project=test-group1 tests/CursorInfo.spec.ts
```
