# LoadingFiles test plan

**Source:** [`tests/LoadingFiles.spec.ts`](../tests/LoadingFiles.spec.ts) · **Cases:** 15

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

## Blank FITS keyword regression (frontend PR #3027)

- Four cases cover ordinary sky cubes (`initFrame`), DEC/RA cubes (`initFrame2D`), spectral-versus-direction cubes (`initSpectralVsDirectionFrame`), and offset/frequency PV images (`initPVFrame`).
- `test_data/create-wcs-blank-headers.mjs` derives eight tiny clean/blank FITS fixtures from the existing cube fixtures; `node test_data/create.mjs` regenerates them with the other mocks. Each pair differs only by an eight-space keyword card with value 42 and a `PR3027 blank-keyword` comment.
- Load the clean control, then its blank-keyword counterpart. Both must retain a WCS handle, finite distinct world coordinates at two pixels, the expected axis classification, equal raster RGB, equal sampled intensity and equal finite spatial-profile data (16 samples). Use the Y direction for the swapped cube so its spatial profiler follows the sky axis.
- Open View → File Header and confirm the blank-keyword comment is still displayed and the backend header entries still contain a blank keyword. Close the dialog before viewer capture.
- Compare eight reviewed PNG baselines: a viewer with the WCS grid enabled and a spatial profile for each blank-keyword fixture. No pixel-coordinate fallback is accepted.

## Run

```sh
npm test -- --project=test-group2 tests/LoadingFiles.spec.ts
```

## Coverage additions

Save channels 1–3 to a UUID FITS in test_data. Empty filename disables Save. Use a path relative to the top-level folder, wait for export completion, inspect NAXIS3=3, reload and verify 3/12 K first/last pixels. Attach viewer PNG and remove only this export in finally.

## File browser numeric sorting regression (PR #2915)

Two cases exercise the image and catalog browsers using real backend file-list responses. Each creates a unique temporary directory beside `test_data` (outside the recursive fixture-size scan) and removes only that directory in `finally`.

- Generate three valid FITS cubes (8,640, 72,000 and 1,797,120 bytes) or three padded VOTables (9,000, 75,000 and 1,800,000 bytes). These raw byte counts sort differently as decimal strings, and filenames deliberately disagree with size order. All files stay below 2 MB; the frontend unit tests cover GB/TB magnitudes.
- Click Size twice and verify ascending/descending rendered row order and sort icons. Directories stay ahead of files and sort by item counts 1, 2 and 10.
- Set modification times to Unix seconds 900,000,000, 1,000,000,000 and 1,500,000,000. Click Date in both directions and verify the corresponding directory/file row orders, catching comparison across nine/ten-digit timestamps.
- Restore ascending Size, filter to no matches, require No results and disabled Load, then clear the filter and require the sorted rows to return.
- Select the smallest row after all sorts and filters. The image case must load the intended 16×16×5 cube; the catalog case must load the intended five-row table and render four in-frame sources on `cube.fits`.
- Check opaque raster RGB and exact catalog marker RGB `(0,163,150)`, wait for the 16-value X profile and the temporary image-size popup to disappear, compare viewer/profile PNG baselines, and retain the sorted browser PNG as an artifact.
