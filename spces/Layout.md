# Layout test plan

**Source:** [`tests/Layout.spec.ts`](../tests/Layout.spec.ts) · **Cases:** 4

Built-in layouts, docking and context-aware menus.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `HD163296_13CO_2-1_subimage.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                  | Action                                                                               | Expected result                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| [CARTA provided layout](../tests/Layout.spec.ts#L5) | Apply CARTA-provided layouts from the View menu.                                     | Root accessibility snapshots show the expected viewer, profiler, animator and widget arrangement for each layout. |
| [Drag and dock](../tests/Layout.spec.ts#L646)       | Drag widgets among dock areas and floating positions.                                | Dock tree and visible tab layout match accessibility snapshots after moves.                                       |
| [Drag to new column](../tests/Layout.spec.ts#L828)  | Drag a widget into a new column.                                                     | A new column is created and the widget remains reachable in the resulting layout.                                 |
| [Menu bar items](../tests/Layout.spec.ts#L848)      | Inspect File, View, Widgets and Help menus before and after loading an image/region. | Menu entries and disabled states match context; submenu controls are present and reachable.                       |

## Run

```sh
npx playwright test tests/Layout.spec.ts --project=chromium
npx playwright test tests/Layout.spec.ts
```
