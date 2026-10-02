# Histogram test plan

**Source:** [`tests/Histogram.spec.ts`](../tests/Histogram.spec.ts) · **Cases:** 1

Channel-dependent histogram and pixel-bound validation.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `cube.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                          | Action                                                                                                          | Expected result                                                                                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [histogram widget follows the image channel](../tests/Histogram.spec.ts#L4) | Open histogram on cube.fits, jump from channel 0 to 4, then set invalid and valid fixed pixel bounds and reset. | Bin counts and graph change with channel; viewer/profiler follow; equal bounds disable generation, valid bounds crop counts, reset restores all pixels. |

## Run

```sh
npm test -- --project=test-group1 tests/Histogram.spec.ts
```
