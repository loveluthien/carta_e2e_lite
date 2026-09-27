# VectorOverlay test plan

**Source:** [`tests/VectorOverlay.spec.ts`](../tests/VectorOverlay.spec.ts) · **Cases:** 1

Vector configuration, rendering, invalid sources and clearing.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `iquv.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                  | Action                                                                                                                                                   | Expected result                                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [configures every dialog control and renders the output canvas](../tests/VectorOverlay.spec.ts#L19) | On iquv.fits, edit all vector source, averaging, threshold, debiasing, length, rotation and color controls; apply, switch source combinations and clear. | Apply renders a changed vector canvas/viewer; both sources None disables Apply; clearing removes tiles and disables Clear. |

## Run

```sh
npx playwright test tests/VectorOverlay.spec.ts --project=chromium
npx playwright test tests/VectorOverlay.spec.ts
```
