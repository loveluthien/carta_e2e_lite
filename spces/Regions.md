# Regions test plan

**Source:** [`tests/Regions.spec.ts`](../tests/Regions.spec.ts) · **Cases:** 1

Region creation/editing, visibility, locking, deletion and profiler connection.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `HD163296_13CO_2-1_subimage.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                                                            | Action                                                                                                                          | Expected result                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [rectangle edits update the viewer and profiler; invalid edits and locked deletion are rejected](../tests/Regions.spec.ts#L7) | Draw a rectangle, inspect region list/profile, edit name and width, attempt negative width, lock, toggle visibility and delete. | Viewer/profile PNGs reflect creation/edit; invalid width is rejected, locked delete disabled, opacity toggles, and deletion removes region/profile option. |

## Run

```sh
npx playwright test tests/Regions.spec.ts --project=chromium
npx playwright test tests/Regions.spec.ts
```
