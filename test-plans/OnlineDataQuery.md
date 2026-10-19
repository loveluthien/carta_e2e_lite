# OnlineDataQuery test plan

**Source:** [`tests/OnlineDataQuery.spec.ts`](../tests/OnlineDataQuery.spec.ts) · **Cases:** 4

SIMBAD and VizieR catalog queries and HiPS image queries, including failure/retry and rendered results.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `catalog-image.fits`, `cube.fits`, `hips-image.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test                                                                        | Action                                                                                                                                                            | Expected result                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SIMBAD online catalog query recovers from a failed mirror and plots sources | Inject HTTP 503, then retry with a two-row TAP JSON response.                                                                                                     | Failure leaves query retryable without a catalog; retry loads Alpha and Beta, validates axes, projected positions and teal RGB, and attaches a viewer PNG with profiler visible.                                                                                                                                     |
| VizieR online catalog query recovers from a failed mirror and plots sources | Discover a mock VOTable by keyword, select a table, clear selection and reselect; fail the first Load selected request and retry.                                 | Discovery creates no overlay. Clearing selection removes Load selected. Requests preserve J2000, keyword, selected table and object limit. Failed load remains retryable without a catalog; retry loads two rows and validates axes, projected positions and teal RGB, attaching a viewer PNG with profiler visible. |
| HiPS query by object                                                        | Select a survey, change controls, Clear, fill `M 31`, dimensions 16 × 16 and FOV 0.016°. Check invalid width 4, restore width 16, query, and retry after failure. | Clear resets all controls including system/projection/rotation; invalid dimensions disable Query. Failed download reports an error and preserves the existing image. Retry sends object parameters, appends exactly one image and closes the dialog.                                                                 |
| HiPS query by center                                                        | Repeat using ICRS center (180°, −30°), including restoring the query mode when reopening after failure.                                                           | Request contains RA/Dec and no object name; failure and retry preserve the original image and append exactly one result.                                                                                                                                                                                             |

## HiPS setup and checks

- Start with `cube.fits` loaded and the default viewer/profiler layout.
- Mock the survey discovery HTTP responses and the backend service's remote download method. The first remote response fails; the retry opens the real local `hips-image.fits` using the requested file ID and the normal backend file loader. These tests cover the frontend query and image loading integration, not the backend HTTP download or the live HiPS service.
- `hips-image.fits` is a 5.6 KiB, 16 × 16, 2D float FITS image with TAN WCS centered at (180°, −30°), 0.001° pixels, and row-major pixel values 1 through 256.

## HiPS rendering and profiler checks

Both cases verify the new image title and dimensions, cursor value 137 at (8, 8), grayscale RGB endpoints (0, 0, 0) and (255, 255, 255), and the exact horizontal profile values 129 through 144 at row 8. Attach viewer and profiler PNG snapshots to the test report; no image baseline is required.

## Run

```sh
npm test -- --project=test-group2 tests/OnlineDataQuery.spec.ts
```

## Exact overlay checks

Independently project both returned sky coordinates using the fixture's SIN WCS and compare the catalog GPU position buffers (0.0005 pixel tolerance for SIMBAD; 0.05 pixel for the VizieR FK5-to-ICRS reference-frame bias). Require the expected teal RGB (0, 163, 150), not merely an arbitrary non-transparent pixel. Attach the rendered viewer PNG.
