# PVImage test plan

**Source:** [`tests/PVImage.spec.ts`](../tests/PVImage.spec.ts) · **Cases:** 20

PV generator validation, output, preview and cancellation.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `Gaussian_array_wide.fits`, `HD163296_13CO_2-1_subimage.fits`, `M17_SWex.fits`.
- PVG-02 and PVI-08 compare the viewer against named PNG baselines; other cases capture diagnostic images. The table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test                                                                                                          | Action                                                                                                                   | Expected result                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [PVG-01: Initial state, region filtering and tooltips](../tests/PVImage.spec.ts)                              | Open PV generator without a cut; add rectangle and point regions.                                                        | Generate/Preview stay disabled and ineligible regions are absent from the cut list.                            |
| [PVG-02: Line geometry validation (out-of-bounds and single-pixel)](../tests/PVImage.spec.ts)                 | Create a line on the 90×90 image, move it outside the image, collapse it to one pixel, then restore it inside the image. | Generate and Preview enable only for a valid in-bounds nondegenerate line; viewer PNG shows the restored line. |
| [PVG-03: Polyline region enables Generate but disables Preview](../tests/PVImage.spec.ts)                     | Create a polyline and select it as the cut.                                                                              | Generate enables while Preview remains disabled.                                                               |
| [PVG-04: Animation playback disables Generate and Preview](../tests/PVImage.spec.ts)                          | Start and stop animation with a valid cut.                                                                               | Generate and Preview disable during playback and re-enable after stop.                                         |
| [PVG-05: Spectral coordinate and system settings update units](../tests/PVImage.spec.ts)                      | Cycle frequency, velocity, wavelength and channel spectral coordinates.                                                  | Displayed PV range units follow coordinate choice.                                                             |
| [PVG-06: Spectral range validation](../tests/PVImage.spec.ts)                                                 | Set equal spectral endpoints, then a valid subset.                                                                       | Equal endpoints block generation; valid subset enables it.                                                     |
| [PVG-07: Data source switching across multiple loaded images](../tests/PVImage.spec.ts)                       | Append a second image and switch PV data source back and forth.                                                          | Cut resets for an image with no region and restores usable selection on original image.                        |
| [PVI-01: Full-resolution PV generation and multi-coordinate generation](../tests/PVImage.spec.ts)             | Generate full-resolution PV, change spectral coordinate, alter cut geometry and axes.                                    | Each PV frame is marked as PV, appears in viewer and matches expected dimensions/coordinate display.           |
| [PVI-02: Custom average width generation](../tests/PVImage.spec.ts)                                           | Set average cut width to five and generate.                                                                              | A PV image opens with the selected averaging width applied.                                                    |
| [PVI-03: Custom spectral range subset generation](../tests/PVImage.spec.ts)                                   | Generate from a restricted spectral range.                                                                               | Result has the inclusive 21-channel spectral dimension.                                                        |
| [PVI-04: Axes order transposition (X-axis: Spectral, Y-axis: Spatial)](../tests/PVImage.spec.ts)              | Transpose X and Y axes for PV generation.                                                                                | Spectral dimension becomes width and spatial cut length becomes height; restore default axes afterward.        |
| [PVI-05: Keep previous PV images toggle behaviour](../tests/PVImage.spec.ts)                                  | Generate with Keep off, then on, then off again.                                                                         | Off replaces old PV output; on retains both; repeated generation follows switch state.                         |
| [PVI-06: Polyline cut PV generation](../tests/PVImage.spec.ts)                                                | Generate a PV from a three-vertex polyline cut.                                                                          | Result frame exists, is marked PV and is visible.                                                              |
| [PVI-07: PV generation cancellation and re-request](../tests/PVImage.spec.ts)                                 | Start a long PV request, cancel it, then request again.                                                                  | Progress dialog closes on cancel; retry creates exactly one usable PV result.                                  |
| [PVI-08: Image viewer conversion validates rest-frame input and renders correction](../tests/PVImage.spec.ts) | Generate a PV image; reject invalid redshift, apply valid redshift, then use optical radial velocity.                    | Invalid input falls back to zero, valid inputs update effective correction, and PV viewer PNG renders.         |
| [PVP-01: Preview widget activation, interaction and lifecycle](../tests/PVImage.spec.ts)                      | Start preview, move the line, close and reopen preview.                                                                  | Preview canvas appears, responds to geometry and survives widget lifecycle.                                    |
| [PVP-02: Interactive preview responsiveness to generator controls](../tests/PVImage.spec.ts)                  | Change average width, axes order and coordinate while preview is open.                                                   | Preview canvas remains active and updates with each control.                                                   |
| [PVP-03: Preview cube size limit and rebinning controls](../tests/PVImage.spec.ts)                            | Limit preview cube size, then increase XY and Z rebinning.                                                               | Estimated size decreases and Preview changes from disabled to enabled.                                         |
| [PVP-04: Restricting preview cube size with rectangular Preview Region](../tests/PVImage.spec.ts)             | Choose a small rectangular preview region on a large cube.                                                               | Full-cube preview is blocked by size; bounded region permits and renders preview.                              |
| [PVP-05: Transition from preview to full PV generation](../tests/PVImage.spec.ts)                             | Generate the full PV while a preview is active.                                                                          | Full PV frame opens while the preview widget remains visible.                                                  |

## Run

```sh
npx playwright test tests/PVImage.spec.ts --project=chromium
npx playwright test tests/PVImage.spec.ts
```
