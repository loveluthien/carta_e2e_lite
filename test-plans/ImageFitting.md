# ImageFitting test plan

**Source:** [`tests/ImageFitting.spec.ts`](../tests/ImageFitting.spec.ts) · **Cases:** 2

Fit validation and derived model/residual images.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `dice_four.fits`, `Gaussian_triple.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                  | Action                                                                                                                                       | Expected result                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Auto-fits Gaussian_triple.fits](../tests/ImageFitting.spec.ts#L4)                                  | Fit three auto-initialized components in Gaussian_triple.fits, inspect numeric result and log, then view model, residual, and model profile. | Three amplitudes and integrated fluxes match fixture expectations; background remains fixed; model and residual PNGs and center RGB values match; model spatial profile has samples and matches its PNG. |
| [Image fitting validates inputs and displays the fitted images](../tests/ImageFitting.spec.ts#L113) | Fit four components in dice_four.fits, exercise auto-initialization guard, inspect results/log, then open model and residual images.         | Fit is disabled without initial values and enabled in Auto; four result components appear; both derived images and model profile render with PNG checks.                                                 |

## Run

```sh
npx playwright test tests/ImageFitting.spec.ts --project=chromium
npx playwright test tests/ImageFitting.spec.ts
```
