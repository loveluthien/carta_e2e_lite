# Contours test plan

**Source:** [`tests/Contours.spec.ts`](../tests/Contours.spec.ts) · **Cases:** 2

Contour generation methods and rendered overlay styling.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `HD163296_13CO_2-1_subimage.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                  | Action                                                                                                                                 | Expected result                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Contour Dialog](../tests/Contours.spec.ts#L5)      | Open contours on HD163296, switch to channel 24, and generate levels with start-step-multiplier, min-max, percentages, and mean-sigma. | Histogram PNGs, numeric bounds and level lists match each mode; configuration and styling tabs expose their controls. |
| [Contour Rendering](../tests/Contours.spec.ts#L100) | Plot channel-24 contours, change thickness and constant color, then use mapped color with bias/contrast.                               | Contour canvas PNGs change at each styling step and numeric controls show the selected values.                        |

## Run

```sh
npx playwright test tests/Contours.spec.ts --project=chromium
npx playwright test tests/Contours.spec.ts
```
