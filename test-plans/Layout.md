# Layout test plan

**Source:** [`tests/Layout.spec.ts`](../tests/Layout.spec.ts) · **Cases:** 5

## Cases

| Test                                                                  | Action                                                                                                                                                                                                                          | Expected result                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preset layouts place the viewer and widgets in the expected groups    | Apply Default, Cube View, Cube Analysis, and Continuum Analysis.                                                                                                                                                                | Each preset shows its intended viewer, profiler, statistics, and shared widget tab groups.                                                                                                                                                                                                                                       |
| Docking and a new column preserve the viewer and profiler             | Load the small `cube.fits` fixture, dock Z Profile with X Profile, then drag Z Profile to the left edge.                                                                                                                        | The viewer remains on `cube.fits`; the dock tree gains a column; Z Profile remains visible and plots the cursor spectrum. The image raster and profile match reviewed PNG baselines, the raster center RGB stays within `R 235–250, G 210–235, B 65–105`, and image pixel `(8, 8)` reads `1.5`.                                  |
| Saved layout validates names and can be applied, renamed, and deleted | Check preset edit/delete buttons, reject an invalid and reserved name, save a layout, cancel overwrite, switch presets, reapply the saved layout, reject an invalid rename, rename, cancel deletion, then delete.               | Validation disables or rejects bad input; cancellation preserves the saved layout; reapplication restores the saved tab groups; deletion removes the user layout.                                                                                                                                                                |
| Dynamic layouts switch between 2D and 3D images                       | Delete every saved custom layout, apply Default, enable Dynamic Layout, save Continuum Analysis as `2D Image` for `m16_f0444w.fits` and Cube Analysis as `3D Cube` for `cube.fits`. Reload each image and then the application. | Only the two new custom layouts remain. The Dynamic Layout tab shows both mappings; each image type automatically restores its saved viewer and widget arrangement; mappings persist after reload. The 2D raster and 3D spectral plot match reviewed PNG baselines, and raster RGB and image pixel values match expected ranges. |
| Menu bar reflects whether an image is loaded                          | Inspect File and View before loading `single.fits`, then inspect File, View, Widgets, and Help. Compare Code Snippets visibility with its saved preference.                                                                     | Image-dependent commands change from disabled to enabled; the named widget and help entries remain available. Code Snippets appears only when its preference is enabled.                                                                                                                                                         |

Raster PNGs allow a 1.5–2% pixel difference for canvas annotation text. The RGB ranges still check the rendered image color.

## Coverage still needed

- Layout save rejection while the image viewer is popped out.
- User layout quota and server failure recovery.

## Run

```sh
npm test -- --project=test-group2 tests/Layout.spec.ts
```
