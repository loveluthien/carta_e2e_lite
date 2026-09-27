# Animator test plan

**Source:** [`tests/Animator.spec.ts`](../tests/Animator.spec.ts) · **Cases:** 3

Channel and polarization navigation, playback modes and synchronization with viewer/profiles.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `HD163296_13CO_2-1_subimage.fits`, `IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                        | Action                                                                                               | Expected result                                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [Channel change](../tests/Animator.spec.ts#L5)            | Load the HD163296 cube, select a point, and move the channel slider in Cube View.                    | Frequency, velocity, X/Y and spectral profile readouts track each chosen channel; compare viewer and spectral plot PNGs. |
| [Image and stokes change](../tests/Animator.spec.ts#L135) | Append the IQUV cube, switch active image, then select Stokes Q/U/V and derived polarization planes. | Animator image/plane labels and spectral readout follow selection; compare viewer PNGs for each plane.                   |
| [Animation play](../tests/Animator.spec.ts#L263)          | Use play/stop, first/last, frame rate, step size, slider drag, backward, bouncing and blink.         | Channel index and frequency advance in the expected direction and range; compare viewer PNGs at checkpoints.             |

## Run

```sh
npx playwright test tests/Animator.spec.ts --project=chromium
npx playwright test tests/Animator.spec.ts
```
