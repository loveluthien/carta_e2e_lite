# OnlineDataQuery test plan

**Source:** [`tests/OnlineDataQuery.spec.ts`](../tests/OnlineDataQuery.spec.ts) · **Cases:** 1

Query failure/retry and catalog overlay rendering.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `catalog-image.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                          | Action                                                                                                                            | Expected result                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [online catalog query recovers from a failed mirror and plots sources](../tests/OnlineDataQuery.spec.ts#L4) | Load the catalog image and issue a SIMBAD TAP query with first response injected as HTTP 503 and second as a two-row JSON result. | Failure leaves query retryable and creates no catalog; retry closes dialog, shows two rows and a nonempty overlay beside viewer/profile. |

## Run

```sh
npm test -- --project=test-group2 tests/OnlineDataQuery.spec.ts
```

## Exact overlay checks

Independently project both returned sky coordinates using the fixture's SIN WCS and compare the catalog GPU position buffers. Require the expected teal RGB (0, 163, 150), not merely an arbitrary non-transparent pixel. Attach the rendered viewer PNG.
