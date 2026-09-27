# Animator test plan

**Source:** [`tests/Animator.spec.ts`](../tests/Animator.spec.ts) · **Cases:** 4

Use the HD163296 cube, the IQUV cube, and three dated J0423-0120 images with a fresh CARTA page for each case. Compare reviewed PNGs for the image viewer and applicable profiles; the pixel comparisons cover their RGB output. Wait for rendered image pixels to change before capturing a new polarization plane.

| Case                    | Actions                                                                                                                                | Checks                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel change          | Select a point region for both spatial profilers; jump from first to last channel and back.                                            | Animator channel, viewer frequency, and spectral profile change together; both spatial profilers show data; viewer and plot PNGs match their baselines.                                 |
| Image and Stokes change | Switch from the HD163296 cube to the IQUV cube; select Q, U, V, Ptotal, Plinear, and Pangle.                                           | Animator filename and polarization slider, viewer polarization readout, changed raster pixels, and a PNG for each rendered plane.                                                       |
| Playback controls       | Exercise next, previous, first, last, frame rate increment and decrement, forward playback, step size, backwards, bouncing, and blink. | Channel advances in the expected direction or step and playback stops; viewer frequency remains visible. An out-of-range frame rate is rejected without changing the animator store.    |
| Time series data        | Load the 2015, 2020, and 2024 J0423-0120 FITS images as a time series; step through them and return to the first image.                | Active date and title follow the animator index. Pixel (150, 150) matches the FITS values 0.9235039, 1.8255513, and 3.5052781 Jy/beam. Viewer and X profile PNGs match their baselines. |

## Run

```sh
npx playwright test tests/Animator.spec.ts --project=chromium
```
