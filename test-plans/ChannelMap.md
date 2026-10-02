# Channel Map test plan

**Source:** [`tests/ChannelMap.spec.ts`](../tests/ChannelMap.spec.ts) · **Cases:** 4

Channel-map empty state, navigation and bounds, rendered panels and labels, spectral-profile synchronization, and image selection.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the deterministic 5-channel `cube.fits` and one-channel `single.fits` fixtures.
- Check widget and image-viewer state as well as rendered labels, raster RGB values, and profile data. Compare viewer and profiler PNGs with reviewed baselines.
- Exercise the four navigation buttons, slider, numeric inputs and steppers, label and unit switches, font and color controls, image selector, and viewer mode button. Check rejected start-channel input and recovery.
- The table describes intended outcomes; it does not claim the full suite has passed.

## Cases

| Test                                                                                                        | Action                                                                                                                                                                         | Expected result                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [shows an empty state without an image](../tests/ChannelMap.spec.ts)                                        | Open Channel Map Control with no file loaded.                                                                                                                                  | Widget header and “No file loaded” state appear.                                                                                                                                                                                                                   |
| [navigates channels and pages, resizes the grid, and rejects invalid input](../tests/ChannelMap.spec.ts)    | Load `cube.fits`, change row/column counts, use all four navigation buttons and the start slider, then enter an out-of-range channel.                                          | Panel labels follow the visible channels and grid; navigation stops at cube bounds; invalid input does not alter store state; navigation PNG matches.                                                                                                              |
| [renders label styling and keeps the selected channel in the spectral profile](../tests/ChannelMap.spec.ts) | Toggle channel/frequency/velocity labels and units, change font and color, select a panel, and open a point-region spectral profile. Disable map mode using the viewer button. | Label text/style and active red border match; raster RGB samples and viewer PNG match; selecting panel 3 selects channel 3; profile values equal `[1.5, 3, 6, 12, 24]` and profile PNG matches; disabling removes map labels and restores the single-image viewer. |
| [switches the displayed image and handles a single-channel cube](../tests/ChannelMap.spec.ts)               | Load `single.fits` alongside the cube, select each image, and try an invalid start channel on the single-channel image.                                                        | Selection updates the viewer; single-channel map has no multi-panel labels and its slider is disabled; invalid input leaves channel 0 unchanged; returning to `cube.fits` restores four panels and the raster PNG.                                                 |

## Run

```sh
npm test -- --project=test-group1 tests/ChannelMap.spec.ts
```
