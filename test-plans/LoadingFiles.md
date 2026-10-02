# LoadingFiles test plan

**Source:** [`tests/LoadingFiles.spec.ts`](../tests/LoadingFiles.spec.ts) · **Cases:** 9

Fixture size, open/append, invalid-file recovery, and FITS/HDF5/CASA file metadata and rendering, including FITS images with minimal headers.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `Gaussian_array_wide.fits`, `HD163296_13CO_2-1_subimage.fits`, `HD163296_C18O_2-1_subimage.fits`, `IRCp10216_sci.spw0.cube.I.manual.pbcor.fits`, `M17_SWex.fits`, `cube.fits`, `invalid.fits`, `m16_f0444w.fits`, `m16_f0770w.fits`, `m16_f1130w.fits`, `m16_f1500w.fits`, `minimal_header1.fits`, and `minimal_header2.fits`.
- Format comparison fixtures copied into `test_data` from `~/bz/test_images`: `M17_SWex-channel0-addOneGaussian.fits`, `.hdf5`, and `.image` (CASA directory). These represent the same 640×800 single channel image. The FITS, HDF5, and CASA fixtures are approximately 2.1 MB, 4.7 MB, and 2.3 MB.
- The three format and two minimal-header cases have reviewed viewer and spatial profiler PNG baselines for Chromium. The earlier cases inspect rendering without named baselines.

## Cases

| Test (source line)                                                                              | Action                                                                                                | Expected result                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [small mock images load into the viewer and profiler](../tests/LoadingFiles.spec.ts#L11)        | Check all local FITS fixtures stay under 2.5 MB, then load nine representative FITS files one by one. | Each replaces the frame list with the expected filename; viewer and X profiler produce data.                        |
| [opens and appends images in the viewer and profiler](../tests/LoadingFiles.spec.ts#L55)        | Open M17, append HD163296, and inspect the new frame.                                                 | Both filenames remain in frame list; title changes and viewer/profile screenshots differ from the first image.      |
| [rejects an invalid FITS file and then loads a valid image](../tests/LoadingFiles.spec.ts#L114) | Search for invalid.fits, then recover by loading cube.fits.                                           | Corrupt file is absent from the list, Load stays disabled and no frame is added; valid 16×16×5 cube renders.        |
| [FITS file information, header, image, and profile](../tests/LoadingFiles.spec.ts#L159)         | Inspect File Information and Header tabs, then load the FITS source image.                            | 640×800 shape, Jy/beam unit, `SIMPLE=T`, image/profile PNGs and expected blue, dark, and yellow raster RGBA values. |
| [HDF5 file information, header, image, and profile](../tests/LoadingFiles.spec.ts#L159)         | Inspect File Information and Header tabs, then load the matching HDF5 image.                          | Same dimensions, unit, header and rendered colors; file information reports mipmaps.                                |
| [CASA file information, header, image, and profile](../tests/LoadingFiles.spec.ts#L159)         | Inspect File Information and Header tabs, then load the matching CASA `.image` directory.             | Same dimensions, unit and rendered colors; header identifies an `IMAGE` extension.                                  |
| [minimal_header1.fits loads with minimal headers](../tests/LoadingFiles.spec.ts#L337)           | Inspect the 8-bit 1024×1024 image's sparse header, then load and inspect the viewer and X profile.    | Pixel-coordinate fallback works without WCS or unit cards; viewer/profile PNGs and raster RGB samples match.        |
| [minimal_header2.fits loads with minimal headers](../tests/LoadingFiles.spec.ts#L337)           | Inspect the 32-bit 10×10×10 cube's sparse header, then load and inspect the viewer and X profile.     | Ten channels load without spectral metadata; pixel-coordinate profile, PNGs, and raster RGB samples match.          |

## Run

```sh
npm test -- --project=test-group2 tests/LoadingFiles.spec.ts
```

## Coverage additions

Save channels 1–3 to a UUID FITS in test_data. Empty filename disables Save. Use a path relative to the top-level folder, wait for export completion, inspect NAXIS3=3, reload and verify 3/12 K first/last pixels. Attach viewer PNG and remove only this export in finally.
