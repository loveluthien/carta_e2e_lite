# Statistics test plan

**Source:** [`tests/Statistics.spec.ts`](../tests/Statistics.spec.ts) · **Cases:** 2

Statistics for regions across images and Stokes planes.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `cube.fits`, `iquv.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                               | Action                                                                                  | Expected result                                                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [shows values for regions from multiple images](../tests/Statistics.spec.ts#L27) | Create full-image regions in cube.fits and iquv.fits; switch image/region and Stokes Q. | Ten-row statistics table shows independently expected pixel count, sum, mean, min and max for each choice. |
| [shows values for a non-full image region](../tests/Statistics.spec.ts#L84)      | Create a partial rectangle on cube.fits.                                                | Region selector and statistics values match the known subimage pixel count and intensity totals.           |

## Run

```sh
npx playwright test tests/Statistics.spec.ts --project=chromium
npx playwright test tests/Statistics.spec.ts
```
