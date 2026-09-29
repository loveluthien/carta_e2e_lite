# MomentMap test plan

**Source:** [`tests/MomentMap.spec.ts`](../tests/MomentMap.spec.ts) · **Scenarios:** 39 Playwright tests

Moment generator data, controls, lifecycle and failure recovery.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `Gaussian_array_wide.fits`, `cube.fits`, `iquv.fits`, `no-rest.fits`, `single.fits`, `stokes.Q.fits`.
- The ellipse region case makes a unique temporary copy of `cube.fits` so repeated runs do not reuse the same generated-map source name; the test removes the copy afterward. Crop cases verify that a request with no partial result has settled before retrying once.
- Shared viewport, timeout and page-default-timeout setup is defined once at the top of the source. Frame state is represented by the typed `FrameSnapshot` helper, and the spectral-coordinate case opens the Moments tab once per scenario.
- The all-moments batch checks every moment type, while other cases cover single-moment requests. The channel-range cases focus on partial, reversed, and endpoint ranges.
- `checkMap` waits for the selected map to render a non-transparent RGB pixel, then validates its numerical oracle and rendered pixel. The close-and-regenerate case also writes a PNG artifact (`moment-map-generated.png`) to the Playwright test output for visual inspection.
- Injected failure cases route the WebSocket for the configured Moment Map server before opening the page.
- The table below describes intended outcomes and does not claim that a complete backend run has passed.

## Cases

| Test                                                                             | Action                                                                           | Expected result                                                                                     |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [shows defaults and preserves range across tabs](../tests/MomentMap.spec.ts)     | Open Moments, inspect defaults, change spectral range, leave and reopen the tab. | Moment 0, mask None, full channel range, mask 0–1 and Keep off appear; edited range persists.       |
| [generates selected and all moment types](../tests/MomentMap.spec.ts)            | Generate moments 0–3, then all 13 moment types.                                  | Each selected moment yields one map and passes the per-moment map oracle.                           |
| [disables generation without an image](../tests/MomentMap.spec.ts)               | Open Moments before loading a file.                                              | Source, region, mask and Generate are disabled.                                                     |
| [selects, searches, removes, and clears moments](../tests/MomentMap.spec.ts)     | Select, deselect, remove tags, search and clear moments.                         | Tags and menu selection agree without duplicates; search narrows choices and Clear removes all.     |
| [disables generation with no selected moments](../tests/MomentMap.spec.ts)       | Clear all selected moments and try the generation control.                       | An empty selection cannot launch a destructive request or remove existing maps.                     |
| [generates from channels 1 to 3](../tests/MomentMap.spec.ts)                     | Set channels 1 to 3 and generate moment 0.                                       | The result matches the independently calculated inclusive-range oracle.                             |
| [generates from channels 3 to 1](../tests/MomentMap.spec.ts)                     | Set channels 3 to 1 and generate moment 0.                                       | The result matches the independently calculated inclusive-range oracle.                             |
| [generates from channels 0 to 0](../tests/MomentMap.spec.ts)                     | Set channels 0 to 0 and generate moment 0.                                       | The result matches the independently calculated inclusive-range oracle.                             |
| [generates from channels 4 to 4](../tests/MomentMap.spec.ts)                     | Set channels 4 to 4 and generate moment 0.                                       | The result matches the independently calculated inclusive-range oracle.                             |
| [None mask from 3 to 12](../tests/MomentMap.spec.ts)                             | Set None 3 to 12 mask and generate moment 0.                                     | Map values follow mask semantics, including reversed bounds, exact bound and empty/full mask cases. |
| [Include mask from 3 to 12](../tests/MomentMap.spec.ts)                          | Set Include 3 to 12 mask and generate moment 0.                                  | Map values follow mask semantics, including reversed bounds, exact bound and empty/full mask cases. |
| [Exclude mask from 3 to 12](../tests/MomentMap.spec.ts)                          | Set Exclude 3 to 12 mask and generate moment 0.                                  | Map values follow mask semantics, including reversed bounds, exact bound and empty/full mask cases. |
| [Include mask from 12 to 3](../tests/MomentMap.spec.ts)                          | Set Include 12 to 3 mask and generate moment 0.                                  | Map values follow mask semantics, including reversed bounds, exact bound and empty/full mask cases. |
| [Include mask from -100 to 100](../tests/MomentMap.spec.ts)                      | Set Include -100 to 100 mask and generate moment 0.                              | Map values follow mask semantics, including reversed bounds, exact bound and empty/full mask cases. |
| [Include mask from 100 to 200](../tests/MomentMap.spec.ts)                       | Set Include 100 to 200 mask and generate moment 0.                               | Map values follow mask semantics, including reversed bounds, exact bound and empty/full mask cases. |
| [Include mask from 6 to 6](../tests/MomentMap.spec.ts)                           | Set Include 6 to 6 mask and generate moment 0.                                   | Map values follow mask semantics, including reversed bounds, exact bound and empty/full mask cases. |
| [rejects invalid bounds and clamps channels](../tests/MomentMap.spec.ts)         | Enter nonfinite spectral/mask bounds and out-of-range channels.                  | Invalid text recovers without a malformed request; channel bounds clamp safely.                     |
| [keeps pinned source while Active follows image](../tests/MomentMap.spec.ts)     | Pin a source, switch active image, then choose Active source.                    | Pinned choice stays fixed while Active follows selection; metadata and output source agree.         |
| [retains and replaces maps per source](../tests/MomentMap.spec.ts)               | Generate batches with Keep off/on and across two sources.                        | Replacement/retention affects only the correct source and preserves unrelated images.               |
| [matches new maps only when enabled](../tests/MomentMap.spec.ts)                 | Toggle automatic spatial matching before generation.                             | New moment maps inherit spatial reference only when enabled.                                        |
| [disables generation for 2D images](../tests/MomentMap.spec.ts)                  | Select a single-channel source and generated 2D moment map.                      | Generate stays disabled for both unsuitable inputs.                                                 |
| [blocks generation during animation](../tests/MomentMap.spec.ts)                 | Start and stop channel animation while Moments is open.                          | Generate disables during playback and re-enables afterward.                                         |
| [regenerates after closing a moment map](../tests/MomentMap.spec.ts)             | Close a generated moment image and regenerate.                                   | Closed result disappears; a fresh usable result can be produced.                                    |
| [selects and generates with keyboard](../tests/MomentMap.spec.ts)                | Use keyboard to search/select moments and request generation.                    | Selection and resulting map match mouse-driven behavior.                                            |
| [crops map to rectangle region](../tests/MomentMap.spec.ts)                      | Generate with the named closed region shape.                                     | Output map is cropped/blanked to region geometry with expected dimensions and pixel data.           |
| [crops map to ellipse region](../tests/MomentMap.spec.ts)                        | Generate with the named closed region shape.                                     | Output map is cropped/blanked to region geometry with expected dimensions and pixel data.           |
| [crops map to polygon region](../tests/MomentMap.spec.ts)                        | Generate with the named closed region shape.                                     | Output map is cropped/blanked to region geometry with expected dimensions and pixel data.           |
| [rejects invalid regions](../tests/MomentMap.spec.ts)                            | Try point, open or removed regions for generation.                               | Invalid geometry cannot generate; returning to Image region restores availability.                  |
| [keeps ranges finite across coordinates and systems](../tests/MomentMap.spec.ts) | Cycle supported spectral coordinates and reference systems.                      | Displayed ranges remain finite and units/conversions agree with the source/profile.                 |
| [edits, converts, and resets rest frequency](../tests/MomentMap.spec.ts)         | Edit rest frequency, switch units and reset.                                     | Equivalent units preserve frequency; reset restores source value and velocity range.                |
| [supplies missing rest frequency](../tests/MomentMap.spec.ts)                    | Use a source without rest frequency and supply one.                              | Conversion becomes usable after a valid entry.                                                      |
| [toggles cursor modes and exits on typing](../tests/MomentMap.spec.ts)           | Toggle channel-range and mask cursor modes; then type an endpoint.               | Modes are mutually exclusive, drag updates correct bounds, and typing exits selection mode.         |
| [preserves Keep setting across tabs](../tests/MomentMap.spec.ts)                 | Toggle Keep, leave the tab and return.                                           | Rendered switch state agrees with stored setting after remount.                                     |
| [uses selected Stokes plane in generated map](../tests/MomentMap.spec.ts)        | Generate from two Stokes planes of an IQUV cube.                                 | Representative output pixels differ and match the selected plane.                                   |
| [clears rejected request and retries](../tests/MomentMap.spec.ts)                | Inject a backend rejection and retry normally.                                   | Requesting flag clears, no failed map remains, and retry succeeds.                                  |
| [clears cancelled request and retries](../tests/MomentMap.spec.ts)               | Inject cancellation acknowledgment after progress appears and retry.             | Progress closes, no cancelled map is added, and retry succeeds.                                     |
| [recovers after disconnect](../tests/MomentMap.spec.ts)                          | Inject a disconnected request, reload and retry.                                 | Fresh connection generates a normal map.                                                            |
| [cancels backend calculation and retries](../tests/MomentMap.spec.ts)            | Cancel a real large-cube calculation, then retry a short range.                  | Requesting flag clears, no cancelled map remains, and retry creates a map.                          |
| [warns when generated map fails to load (injected)](../tests/MomentMap.spec.ts)  | Inject a malformed generated-image acknowledgment.                               | A warning should appear; the missing warning is marked as an expected failure.                      |

## Known status

- `warns when generated map fails to load (injected)` uses `test.fail` for a known missing warning. Keep it marked as an expected failure until the product behavior is fixed.
- The all-moments batch covers tags −1 and 0 through 11. The four channel-range and seven mask rows are separate Playwright cases.
- This file indexes the implemented Moment Map suite and its expected outcomes.

## Run

```sh
npx playwright test tests/MomentMap.spec.ts --project=chromium
npx playwright test tests/MomentMap.spec.ts
```
