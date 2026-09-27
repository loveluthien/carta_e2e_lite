# ChannelMap test plan

**Source:** [`tests/ChannelMap.spec.ts`](../tests/ChannelMap.spec.ts) · **Cases:** 2

Channel-map empty state, controls, image panels and selection synchronization.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `cube.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                                               | Action                                                                                                                         | Expected result                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [CM-01 shows the empty state without an image](../tests/ChannelMap.spec.ts#L10)                  | Open Channel Map Control with no file loaded.                                                                                  | Widget appears with the “No file loaded” state.                                                                                |
| [CM-02 configures, renders, and synchronizes channel selection](../tests/ChannelMap.spec.ts#L26) | Load cube.fits, create a point and spectral profile, enable the map and edit start, step, grid, labels, and channel selection. | Control defaults and edited values persist; rendered channel panels and selection synchronize with the viewer and profile PNG. |

## Run

```sh
npx playwright test tests/ChannelMap.spec.ts --project=chromium
npx playwright test tests/ChannelMap.spec.ts
```
