# ImageFitting test plan

**Source:** [`tests/ImageFitting.spec.ts`](../tests/ImageFitting.spec.ts) · **Cases:** 1

Fit validation and derived model/residual images.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `dice_four.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                | Action                                                                                                                               | Expected result                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Image fitting validates inputs and displays the fitted images](../tests/ImageFitting.spec.ts#L4) | Fit four components in dice_four.fits, exercise auto-initialization guard, inspect results/log, then open model and residual images. | Fit is disabled without initial values and enabled in Auto; four result components appear; both derived images and model profile render with PNG checks. |

## Run

```sh
npx playwright test tests/ImageFitting.spec.ts --project=chromium
npx playwright test tests/ImageFitting.spec.ts
```
