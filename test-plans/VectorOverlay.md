# VectorOverlay test plan

**Source:** [`tests/VectorOverlay.spec.ts`](../tests/VectorOverlay.spec.ts) · **Cases:** 2

Vector configuration, rendering, invalid sources and clearing.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `iquv.fits`.
- Named Chromium PNG baselines cover the white vector canvas, threshold-rejected empty canvas, and mapped-color canvas. Canvas pixel checks verify visibility and exact white RGB values, while store checks verify generated vertices and applied settings.

## Cases

| Test                                                                                                | Action                                                                                                                                                                                       | Expected result                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configures every dialog control and renders the output canvas](../tests/VectorOverlay.spec.ts)     | On iquv.fits, edit vector sources, averaging, threshold, debiasing, length, rotation, and color controls; apply, switch source combinations, then clear.                                     | Applied settings match the store; each source combination produces vertices and visible canvas pixels; both sources None disables Apply; Clear removes tiles and canvas pixels.                                                                                                                                  |
| [threshold rejects vectors and recovers with white rendered pixels](../tests/VectorOverlay.spec.ts) | Apply a white constant-color overlay, raise Stokes I threshold above all fixture values, restore it, change thickness, rotation, and colormap, then hide/show the overlay in the Image List. | White RGB pixels and PNG match the baseline; excessive threshold leaves no vertices/pixels and matches the empty PNG; recovery restores the baseline; styling changes the rendered canvas and mapped colors match their PNG; hiding clears canvas pixels without destroying vertices, and showing restores them. |

## Run

```sh
npx playwright test tests/VectorOverlay.spec.ts --project=chromium
npx playwright test tests/VectorOverlay.spec.ts
```
