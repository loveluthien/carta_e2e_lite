# Stokes test plan

**Source:** [`tests/Stokes.spec.ts`](../tests/Stokes.spec.ts) · **Cases:** 3

Stokes cube assembly and analysis widget controls.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `stokes-varying.fits` (small generated cube with channel-varying Q/I and U/I), `stokes.I.fits`, `stokes.Q.fits`, `stokes.U.fits`, `stokes.V.fits`.
- Named PNG baselines under `tests/Stokes.spec.ts-snapshots` cover all nine merged viewer planes; absolute/fractional, converted and styled plots; every smoothing method and overlay mode; and the unavailable-data state. PNG comparison checks rendered RGB values, not just canvas visibility.

## Cases

| Test (source line)                                                                        | Action                                                                                                                                                                                                                       | Expected result                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [merges IQUV inputs and renders every Stokes plane](../tests/Stokes.spec.ts#L105)         | Select four named FITS files regardless of browser order, reject duplicate polarization assignments, merge and step through all original and derived planes.                                                                 | Invalid mapping disables Load without creating a frame; each selected plane has the expected label and stable viewer PNG.                                                                                |
| [exercises every Stokes Analysis widget control](../tests/Stokes.spec.ts#L204)            | Select image and point region; toggle fractional polarization; change spectral coordinate, both line colors and styles, scatter styling and axes; use the smoothing shortcut, both overlay modes and every smoothing method. | Source profiles give Q/I = 200–300% and U/I = 300–200%; all four plot canvases contain colored pixels, profiler readout is correct, and PNGs show the intended rendered curves after each analysis mode. |
| [keeps fractional polarization unavailable without Q and U](../tests/Stokes.spec.ts#L468) | Switch from a full Stokes cube to an intensity-only image, then back.                                                                                                                                                        | Fractional switch turns off and disables, no Q/U curve appears, the viewer stays available, and full Stokes plots recover when reselected.                                                               |

## Run

```sh
npx playwright test tests/Stokes.spec.ts --project=chromium
npx playwright test tests/Stokes.spec.ts
```
