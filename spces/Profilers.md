# Profilers test plan

**Source:** [`tests/Profilers.spec.ts`](../tests/Profilers.spec.ts) · **Cases:** 8

Spatial and spectral profiles, formatting, smoothing, fitting and viewer connection.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `HD163296_13CO_2-1_subimage.fits`, `IRCp10216_sci.spw0.cube.I.manual.pbcor.fits`, `IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits`, `disk_0.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                   | Action                                                                                                      | Expected result                                                                                                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Spatial widget](../tests/Profilers.spec.ts#L5)                                      | Open spatial profiler for two loaded images, change active image and region, and select X/Y direction.      | Widget image/region labels and profile title follow selection; compare spatial plot PNGs.                                        |
| [Spatial widget settings](../tests/Profilers.spec.ts#L144)                           | Open spatial settings and exercise visible options.                                                         | Control states and configured spatial profile output match selected settings.                                                    |
| [Spatial profile smoothing](../tests/Profilers.spec.ts#L257)                         | Choose Boxcar, Gaussian/scatter and Binning spatial smoothing.                                              | Each smoothing mode changes the plot; compare spatial profile PNGs and input values.                                             |
| [Spectral widget](../tests/Profilers.spec.ts#L343)                                   | Open spectral profiler for two images/regions and use settings shortcut.                                    | Source/region selections and profile plots update; settings tabs remain reachable.                                               |
| [Spectral widget settings -- conversion](../tests/Profilers.spec.ts#L534)            | Change spectral coordinate, unit, system, secondary information and intensity unit.                         | Reported spectral values and labels convert consistently; compare kHz, barycentric and MJy/sr plot PNGs.                         |
| [Spectral widget settings -- styling and smoothing](../tests/Profilers.spec.ts#L720) | Edit spectral plot styling and smoothing, including color, scatter, Hanning, Decimation and Savitzky-Golay. | Controls retain values and corresponding profile PNGs show the transformed series.                                               |
| [Spectral widget settings -- fitting](../tests/Profilers.spec.ts#L986)               | Configure manual and automatic spectral fitting on region data.                                             | Fitting tab state, component parameters and result text appear; compare pre-fit and fitted profile PNGs.                         |
| [Spectral profile connection](../tests/Profilers.spec.ts#L1244)                      | Click spectral plot and change animator channel.                                                            | Viewer channel/frequency and animator follow plot selection; spectral channel marker follows animator; compare viewer/plot PNGs. |

## Run

```sh
npx playwright test tests/Profilers.spec.ts --project=chromium
npx playwright test tests/Profilers.spec.ts
```
