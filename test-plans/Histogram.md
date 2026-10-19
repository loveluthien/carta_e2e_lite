# Histogram test plan

**Source:** [`tests/Histogram.spec.ts`](../tests/Histogram.spec.ts) · **Cases:** 3

Channel-dependent histogram and pixel-bound validation.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `cube.fits`.
- Named histogram PNG baselines cover visible/hidden mean/RMS markers and zero-centered bins; the single-bin selection has a diagnostic PNG artifact, and the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                   | Action                                                                                                          | Expected result                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [histogram widget follows the image channel](../tests/Histogram.spec.ts#L4)                          | Open histogram on cube.fits, jump from channel 0 to 4, then set invalid and valid fixed pixel bounds and reset. | Bin counts and graph change with channel; viewer/profiler follow; equal bounds disable generation, valid bounds crop counts, reset restores all pixels. |
| [histogram mean/RMS markers render vertically, export, refresh and hide](../tests/Histogram.spec.ts) | Toggle markers, export PNG, zoom away, change channel and hide markers.                                         | Mean and RMS pixels agree between screen/export; zoom excludes them; refreshed markers reappear and disabling removes them.                             |
| [histogram exports zero-centered and single selected bins](../tests/Histogram.spec.ts)               | Set zero-centered bins, export TSV, then select exactly the first bin.                                          | All 16 unique centers export, including zero; selecting one bin exports exactly that one point.                                                         |

## Regression coverage for frontend PR #2976

- Toggle Show mean/RMS through Histogram settings: markers start hidden, then a vertical green dashed mean and translucent RMS band appear. Close settings before snapshots and exports.
- Compare green marker bounds between the on-screen annotation canvas and the downloaded PNG, including the mean line's vertical orientation and RMS width. Zoom outside both markers and confirm neither is present on screen or in export.
- Restore the range, move to channel 4 and wait for its updated histogram mean; markers must reappear with the new data. Reopen settings, confirm the toggle persists, then disable it and require zero green marker pixels.
- Configure 16 bins over pixel bounds −1 to 31 so the first bin is centered at zero. Export TSV and require 16 unique centers and a nonempty first bin. Select exactly the zero-centered bin with plot bounds `(0,0)` and require the TSV to retain that one point.
- Reuse `cube.fits`; retain viewer and exported PNG artifacts and compare three histogram PNG baselines; record the single-bin selection as a diagnostic PNG artifact. Detailed bin arithmetic and invalid metadata remain covered by frontend unit tests.

## Run

```sh
npm test -- --project=test-group1 tests/Histogram.spec.ts
```

## Coverage additions

Compute all 255 finite pixels independently and compare every histogram bin for channels 0 and 4, including the distinct x=2 spectrum. Attach the final-channel plot PNG.
