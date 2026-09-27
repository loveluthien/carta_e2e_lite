# ImageLayer test plan

**Source:** [`tests/ImageLayer.spec.ts`](../tests/ImageLayer.spec.ts) · **Cases:** 4

Layer matching, WCS alignment and reordering.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `cube.fits`, `incompatible-spectral.fits`, `iquv.fits`, `matching-cube.fits`, `stokes.I.fits`, `stokes.Q.fits`, `stokes.U.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                       | Action                                                                                                             | Expected result                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [reports and preserves an unmatched frame when spectral matching fails](../tests/ImageLayer.spec.ts#L22) | Load images with incompatible spectral axes and request spectral matching.                                         | Unmatched frame is reported and original frame state remains usable.                                        |
| [matches and unmatches every frame when four images are open](../tests/ImageLayer.spec.ts#L59)           | Open four images and toggle spatial, spectral and render matching for each layer.                                  | Each frame reference attaches and detaches to the intended base image without stale matches.                |
| [spatial and spectral matching align shifted lightweight cubes](../tests/ImageLayer.spec.ts#L122)        | Load shifted lightweight cubes; turn spatial/spectral matching off and on while changing reference center/channel. | Target center/channel map to WCS coordinates; viewer value and spectral plot data follow the matched frame. |
| [reorders layers by dragging and toggles all matching modes](../tests/ImageLayer.spec.ts#L227)           | Toggle XY, Z and render matching, then drag the second layer above the first.                                      | Reference links toggle correctly and image-list order becomes iquv.fits before cube.fits.                   |

## Run

```sh
npx playwright test tests/ImageLayer.spec.ts --project=chromium
npx playwright test tests/ImageLayer.spec.ts
```
