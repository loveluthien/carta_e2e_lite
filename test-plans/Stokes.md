# Stokes test plan

**Source:** [`tests/Stokes.spec.ts`](../tests/Stokes.spec.ts) · **Cases:** 13

Stokes cube assembly and analysis widget controls.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- Before capturing a per-plane viewer PNG, wait for CARTA's image-data requests and canvas redraw to finish; clear transient pointer overlays from the capture.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `stokes-varying.fits` (small generated cube with channel-varying Q/I and U/I), `stokes.I.fits`, `stokes.Q.fits`, `stokes.U.fits`, `stokes.V.fits`.
- Named PNG baselines under `tests/Stokes.spec.ts-snapshots` cover all nine merged viewer planes; absolute/fractional, converted and styled plots; every smoothing method and overlay mode; and the unavailable-data state. PNG comparison checks rendered RGB values, not just canvas visibility.

## Cases

| Test (source line)                                                                        | Action                                                                                                                                                                                                                       | Expected result                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [merges IQUV inputs and renders every Stokes plane](../tests/Stokes.spec.ts#L105)         | Select four named FITS files regardless of browser order, reject duplicate polarization assignments, merge and step through all original and derived planes.                                                                 | Invalid mapping disables Load without creating a frame; each selected plane has the expected label and stable viewer PNG.                                                                                |
| [exercises every Stokes Analysis widget control](../tests/Stokes.spec.ts#L204)            | Select image and point region; toggle fractional polarization; change spectral coordinate, both line colors and styles, scatter styling and axes; use the smoothing shortcut, both overlay modes and every smoothing method. | Source profiles give Q/I = 200–300% and U/I = 300–200%; all four plot canvases contain colored pixels, profiler readout is correct, and PNGs show the intended rendered curves after each analysis mode. |
| [keeps fractional polarization unavailable without Q and U](../tests/Stokes.spec.ts#L468) | Switch from a full Stokes cube to an intensity-only image, then back.                                                                                                                                                        | Fractional switch turns off and disables, no Q/U curve appears, the viewer stays available, and full Stokes plots recover when reselected.                                                               |

## Export filenames

- Eight independent cases exercise PNG and TSV export buttons on Q/U, polarized-intensity, polarization-angle and Q-versus-U plots with the lightweight `stokes-varying.fits` fixture.
- Require the full `stokes-varying.fits-{content}-YYYY-MM-DD-HH-mm-ss.{png|tsv}` filename. These cases enable fractional polarization. PNG content names are `quLine`, `fractional-PI-profile`, `fractional-PA-profile`, `fractional-QU-scatter`; Q/U data export must produce both `fractional-Q-profile` and `fractional-U-profile` TSVs, while the other TSVs use the same content names as their PNGs. The filename matcher accepts only the expected content names for each export.
- Check loaded Q/I and U/I values and all four rendered color counts before export. Validate PNG signatures and five finite rows in each TSV; retain exported files and plot/viewer PNGs as artifacts.

## Run

```sh
npm test -- --project=test-group3 tests/Stokes.spec.ts
```

## Smoothing color regression (PR #2935)

Two focused cases use `stokes-varying.fits` with Boxcar width 3 and Binning width 2. Select Channel coordinates and disable the unsmoothed overlay. Enlarge scatter symbols to allow exact RGB checks.

- Boxcar retains spectral coordinates 0–4 and gives the central smoothed Q/U pair `(18.25, 16.75)`; missing edge values do not require a rendered marker.
- Binning gives spectral coordinates `[0.5, 2.5, 4]`, Q/U pairs `[(4.875, 6.375), (24, 21), (72, 48)]`, and retains the incomplete final bin.
- The first and last scatter colors use the full colormap endpoints in the correct order for the fixture's frequency axis. Every finite marker's exact RGB must appear on the scatter canvas.
- Navigate channels through the animator. Channels 1, 2, 3 and 4 map to their containing bins (including the partial last bin), rather than falling back to the first scatter point. Hover channels 1 and 3 in the Q/U line profile and verify the same mapping in the scatter hover indicator.
- Compare reviewed PNG baselines for all four plots after smoothing and channel changes. Capture the image viewer with settings closed.

These cases inspect the props of the mounted scatter component to check the plotted data and channel indicators; RGB assertions and PNG comparisons independently check rendering. Existing control tests continue covering every smoothing method, overlay controls and scatter styling.
