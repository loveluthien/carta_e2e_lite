# Regions test plan

**Source:** [`tests/Regions.spec.ts`](../tests/Regions.spec.ts) · **Cases:** 5

Region geometry creation, editing and styling, matched frames, the Region List widget, and connected profiler output.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server.
- Use `cube.fits` and `matching-cube.fits` for lightweight region and spatial matching cases; use `HD163296_13CO_2-1_subimage.fits` for WCS editing and style checks.
- Check UI state and frame/region stores, reject invalid inputs, verify exact region overlay RGB pixels, and compare viewer and profile PNGs.
- Keep screenshot baselines per configured browser for creation, editing, matching, the list widget, and profiles.

## Cases

| Test                                                                                                                                          | Action                                                                                                                                                               | Expected result                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [rectangle name and style edits update the viewer and profiler; invalid edits and locked deletion are rejected](../tests/Regions.spec.ts#L34) | Create and select a rectangle, rename it, change size/color/line width, enter an invalid width, and use dialog focus, export, lock, visibility, and delete controls. | The dialog title and list row show the new name; redrawn viewer pixels include the selected RGB color; invalid size is rejected; the profile and viewer PNGs match; locked deletion is disabled and deletion removes the profile option. |
| [creates every region shape and cancels an incomplete polygon](../tests/Regions.spec.ts#L192)                                                 | Create point, line, rectangle, ellipse, polygon, and polyline regions, then cancel a polygon with too few vertices.                                                  | All six types appear in the Region List and viewer; the selected region produces a profile; cancelling the incomplete polygon leaves the region count unchanged.                                                                         |
| [region list actions control regions and open import/export flows](../tests/Regions.spec.ts#L349)                                             | Select rows, toggle row and global visibility/locks, open import/export, cancel delete-all, and inspect the profile.                                                 | Region state and rendered viewer follow list actions; import/export dialogs open and close; cancelling delete-all preserves regions and profile output.                                                                                  |
| [saves regions to a file and loads them back into the image](../tests/Regions.spec.ts#L464)                                                   | Create and name a rectangle, export it as CRTF and DS9 files, delete it, then import each saved file.                                                                | Both exports contain the region label; each imported rectangle restores its type, color, center, and size within format coordinate precision; viewer PNGs match.                                                                         |
| [spatially matched images share region selection and profiler data](../tests/Regions.spec.ts#L656)                                            | Match the shifted cube spatially, create a rectangle on the matched frame, and select it in the spectral profiler.                                                   | Both frames share the region set, the aligned viewer renders the region, and the matched data appears in the profile PNG.                                                                                                                |

## Run

```sh
npx playwright test tests/Regions.spec.ts --project=chromium
npx playwright test tests/Regions.spec.ts
```
