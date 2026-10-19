# OnlineDataQuery test plan

**Source:** [`tests/OnlineDataQuery.spec.ts`](../tests/OnlineDataQuery.spec.ts) · **Cases:** 2

SIMBAD and VizieR query failure/retry and catalog overlay rendering.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `catalog-image.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test                                                                        | Action                                                                                                                            | Expected result                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SIMBAD online catalog query recovers from a failed mirror and plots sources | Inject HTTP 503, then retry with a two-row TAP JSON response.                                                                     | Failure leaves query retryable without a catalog; retry loads Alpha and Beta, validates axes, projected positions and teal RGB, and attaches a viewer PNG with profiler visible.                                                                                                                                     |
| VizieR online catalog query recovers from a failed mirror and plots sources | Discover a mock VOTable by keyword, select a table, clear selection and reselect; fail the first Load selected request and retry. | Discovery creates no overlay. Clearing selection removes Load selected. Requests preserve J2000, keyword, selected table and object limit. Failed load remains retryable without a catalog; retry loads two rows and validates axes, projected positions and teal RGB, attaching a viewer PNG with profiler visible. |

## Run

```sh
npm test -- --project=test-group2 tests/OnlineDataQuery.spec.ts
```

## Exact overlay checks

Independently project both returned sky coordinates using the fixture's SIN WCS and compare the catalog GPU position buffers (0.0005 pixel tolerance for SIMBAD; 0.05 pixel for the VizieR FK5-to-ICRS reference-frame bias). Require the expected teal RGB (0, 163, 150), not merely an arbitrary non-transparent pixel. Attach the rendered viewer PNG.
