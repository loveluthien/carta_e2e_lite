# TimeSeries test plan

**Source:** [`tests/TimeSeries.spec.ts`](../tests/TimeSeries.spec.ts) · **Cases:** 1

Dated series loading, ordering and navigation.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `J0423-0120_2015-05-24.fits`, `J0423-0120_2020-03-17.fits`, `J0423-0120_2024-08-13.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                     | Action                                                                         | Expected result                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [loads a dated image series and steps through its viewer and profile](../tests/TimeSeries.spec.ts#L10) | Select three dated FITS files, load as a time series and step next/last/first. | Files sort chronologically; active index/title and spatial matching are correct; viewer/profile screenshots change with date. Re-trigger the cursor profile after navigation by moving the pointer off the image before hovering again. |

## Run

```sh
npm test -- --project=test-group3 tests/TimeSeries.spec.ts
```
