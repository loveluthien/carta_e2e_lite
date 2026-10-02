# PVImage test plan

**Source:** [`tests/PVImage.spec.ts`](../tests/PVImage.spec.ts) · **Cases:** 20

PV generator validation, output, preview and cancellation.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `Gaussian_array_wide.fits`, `HD163296_13CO_2-1_subimage.fits`, `M17_SWex.fits`.
- The line geometry, generated PV image, rest-frame viewer, and interactive previews compare PNG pixels against named baselines. The table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test                                                         | Action                                                                    | Expected result                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Test                                                         | Action                                                                    | Expected result                                                                        |
| ---                                                          | ---                                                                       | ---                                                                                    |
| Initial state filters unsupported regions                    | Open the generator without a cut; add rectangle and point regions.        | Both actions stay disabled and the cut list excludes these regions.                    |
| Invalid line geometry disables generation and preview        | Move a line outside the image, collapse it to one pixel, then restore it. | Both actions work only for a valid line; the restored viewer matches its PNG baseline. |
| Polyline supports generation but not preview                 | Select a polyline cut.                                                    | Generate enables and Preview stays disabled.                                           |
| Animation playback disables generation and preview           | Start and stop playback with a valid cut.                                 | Both actions disable during playback and re-enable afterward.                          |
| Spectral coordinate changes range units                      | Cycle frequency, velocity, wavelength and channel.                        | The displayed range unit follows the selected coordinate.                              |
| Invalid spectral range disables generation                   | Set equal endpoints, then a valid subset.                                 | Both actions disable for the invalid range, no PV frame appears, and both recover.     |
| Switching data sources restores the selected cut             | Append another image and switch data sources.                             | An image without a cut disables generation; returning to the original restores it.     |
| Generate PV images with multiple spectral coordinates        | Generate with defaults, then in MHz.                                      | A PV frame appears, the range shows MHz, and the viewer matches its PNG baseline.      |
| Generate a PV image with custom average width                | Set average width to five and generate.                                   | A PV frame opens.                                                                      |
| Generate a PV image from a spectral subset                   | Generate channels 10 through 30.                                          | The result has 21 spectral samples.                                                    |
| Transpose PV image axes                                      | Put spectral on X and spatial on Y.                                       | The result is 110 pixels wide and 3 pixels high for the fixture cut.                   |
| Keep or replace previous PV images                           | Generate with Keep off, on, then off.                                     | The frame count follows the switch state.                                              |
| Generate a PV image from a polyline                          | Generate from a three-vertex polyline.                                    | The output frame is marked PV and appears in the viewer.                               |
| Cancel and retry PV generation                               | Cancel a request, then generate again.                                    | Progress closes and the retry creates a usable PV frame.                               |
| Rest-frame conversion validates input and updates the viewer | Reject an invalid redshift, then apply redshift and optical velocity.     | Effective correction updates and the viewer matches its PNG baseline.                  |
| Start, move, close and reopen a PV preview                   | Start preview, move its line, then close and reopen it.                   | Before and after PNGs match distinct rendered states; the widget can reopen.           |
| Restarted preview applies width and axes order               | Close preview, change average width and axes order, then restart.         | Selected values persist and the reversed preview matches its PNG baseline.             |
| Rebin controls retain preview eligibility                    | Set the supported size limit and increment XY and Z rebin.                | Both values become 2 and preview stays enabled.                                        |
| Generate a preview within a rectangle region                 | Select a line cut and rectangle preview region.                           | Preview remains eligible and renders.                                                  |
| Generate a full PV image while preview remains open          | Generate a full image with preview active.                                | A full PV frame appears and preview remains open.                                      |

## Run

```sh
npm test -- --project=test-group3 tests/PVImage.spec.ts
```
