# LoadingFiles test plan

**Source:** [`tests/LoadingFiles.spec.ts`](../tests/LoadingFiles.spec.ts) · **Cases:** 3

Fixture size, open/append, and invalid-file recovery.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `Gaussian_array_wide.fits`, `HD163296_13CO_2-1_subimage.fits`, `HD163296_C18O_2-1_subimage.fits`, `IRCp10216_sci.spw0.cube.I.manual.pbcor.fits`, `M17_SWex.fits`, `cube.fits`, `invalid.fits`, `m16_f0444w.fits`, `m16_f0770w.fits`, `m16_f1130w.fits`, `m16_f1500w.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                              | Action                                                                                              | Expected result                                                                                                       |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [small mock images load into the viewer and profiler](../tests/LoadingFiles.spec.ts#L11)        | Check all local FITS fixtures stay under 2 MB, then load nine representative FITS files one by one. | Each replaces the frame list with the expected filename; viewer and X profiler produce data.                          |
| [opens and appends images in the viewer and profiler](../tests/LoadingFiles.spec.ts#L53)        | Open M17, append HD163296, and inspect the new frame.                                               | Both filenames remain in frame list; title changes and viewer/profile screenshots differ from the first image.        |
| [rejects an invalid FITS file and then loads a valid image](../tests/LoadingFiles.spec.ts#L114) | Select invalid.fits, then recover by loading cube.fits.                                             | Invalid selection shows an error, disables Load and adds no frame; valid 16×16×5 cube renders in viewer and profiler. |

## Run

```sh
npx playwright test tests/LoadingFiles.spec.ts --project=chromium
npx playwright test tests/LoadingFiles.spec.ts
```
