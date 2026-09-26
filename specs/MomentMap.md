# Moment Map end-to-end test plan

## Scope and status

Design coverage for every user-facing Moment Generator function, from Spectral Profiler configuration through backend calculation and generated-image use. This is a test design, not a claim of executed or passing coverage. The current `tests/MomentMap.spec.ts` is an interaction recording with no assertions; replace it with the independent scenarios below when implementing.

Source reviewed: sibling `carta-frontend-dev/src/components/SpectralProfiler/MomentGeneratorComponent/MomentGeneratorComponent.tsx`, `models/MomentDefinition/MomentDefinition.ts`, `stores/Widgets/SpectralProfileWidget/SpectralProfileWidgetStore.ts`, `stores/AppStore/AppStore.ts`, and `components/Shared/SpectralSettings/SpectralSettingsComponent.tsx`.

## Setup and result checks

- Reuse `PlaywrightDevPage.goto()` and `loadImage()`. Open `#SpectralProfilerButton`, then `moment-generator-button`; scope controls to `moment-generator-tab`.
- Start each test in a fresh browser context, with animation stopped and spectral streaming complete. Explicitly select the source cube and Image region so generated-image activation does not redirect later requests.
- Use existing `HD163296_13CO_2-1_subimage.fits` for real-data integration; append `IRCp10216_sci.spw0.cube.IQUV.fits` only after verifying its available filename for multi-source/Stokes checks.
- Add a small deterministic FITS cube before numerical tests: known WCS and rest frequency, nonuniform spatial pixels, positive and signed spectra, unique extrema, blank pixels, and a known channel interval. Store independently calculated reference pixels, units, dimensions and tolerances with the fixture. Do not derive expected results from the application's result or silently record screenshots as truth.
- Add a single-channel image, a cube lacking rest-frequency/conversion metadata, closed rectangle/ellipse/polygon regions, a point, and an open line. Use a bounded larger cube for real cancellation. These are fixture requirements, not files confirmed to exist.
- Every successful generation must assert completion, the exact number and identities of new images, correct source association, 2D dimensions/WCS/units, representative numerical pixels, and a rendered image. Image count or a screenshot alone does not establish numerical correctness.
- Read results through visible image properties/statistics/cursor values or exported FITS. Use a read-only application-state probe only where no public result surface exists. All interactions under test remain UI actions; snippets may prepare fixtures but must not perform the behavior being tested.

## Scenarios

| ID    | Function and actions                                                                                                                                                       | Required assertions                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MM-01 | Open Moment Generator with no image, then load a cube; leave and reopen the tab.                                                                                           | No-image source/mask controls and Generate disabled; cube source label correct; default moment 0, mask None, full spectral extent, mask range 0–1, Keep off. Reopening reflects the effective stored settings.                                            |
| MM-02 | Select an explicit source; switch active image; select Active source and switch again. Close the selected source.                                                          | Explicit source remains pinned; Active follows the active image; file information and ranges reflect the effective source; closing it leaves a valid fallback or disabled state, never a stale request.                                                   |
| MM-03 | Use Image, Active with cursor/no focused region, Active with a closed region, and each explicit rectangle/ellipse/polygon. Move/resize the selected region and regenerate. | Whole-image cases agree; regional output covers the selected footprint with correct WCS and outside-region blanking; geometry changes affect results. Explicit region selection is independent of later active-region changes.                            |
| MM-04 | Focus a point or open line while using Active; inspect explicit region options; delete a selected region.                                                                  | Generate disabled for invalid Active geometry; points disabled in dropdown; open/temporary regions excluded; deletion cannot issue a request for the removed region. Returning to Image restores generation.                                              |
| MM-05 | Select each moment, toggle it off via its menu item, remove a tag, clear all, then reselect. Search `1`, `-1`, and a nonmatching string.                                   | Tags/menu checkmarks stay synchronized; no duplicates; `1` matches numeric prefixes 1, 10, 11; `-1` matches only -1; no match does not alter selection; clear removes every tag. See empty-selection decision below.                                      |
| MM-06 | Parameterize one real generation for each of the 13 moment types listed below.                                                                                             | Exactly one corresponding map per run; numerical and metadata oracle passes, including blank pixels and coordinate-valued output.                                                                                                                         |
| MM-07 | Select 0, 1, 2, 3 together, then all 13 and generate.                                                                                                                      | Exactly one result per selected type, no unselected or duplicate result; each matches its individual-generation reference.                                                                                                                                |
| MM-08 | Edit spectral From and To: full interval, subset, equal endpoints, reversed endpoints, first and last channels.                                                            | Full interval matches baseline; subset and single-channel output match oracle; reversed endpoints produce the same map as forward endpoints because request indices are sorted; boundaries are inclusive.                                                 |
| MM-09 | Enter blank/nonfinite text and values outside channel bounds; blur and attempt generation.                                                                                 | No crash, nonfinite request, stuck progress, or misleading successful image. Record the actual clamp/reject behavior and establish the product contract before locking the out-of-range assertion.                                                        |
| MM-10 | Toggle channel-range cursor selection on/off; drag both directions over the profiler. Switch directly to mask selection; edit an endpoint during selection.                | Only one mode active; channel drag changes spectral bounds, mask drag changes intensity bounds; overlay orientation/range correct; committed manual edits exit selection mode; generation agrees with equivalent typed bounds.                            |
| MM-11 | Iterate every supported coordinate/unit and spectral system option; use the same known physical channel subset after conversion.                                           | Range labels/values and profiler agree; converted endpoints select the expected channels; coordinate moments and units match the WCS oracle. Unsupported conversion controls disabled. Re-establish bounds after conversion if the UI resets them.        |
| MM-12 | Edit rest frequency, change its unit, clear/reset; repeat on unsupported metadata/PV input.                                                                                | Equivalent frequency units represent the same frequency; velocity coordinates respond correctly; reset restores source default and reset availability; unsupported settings disabled. Invalid input never reaches backend as nonfinite frequency.         |
| MM-13 | Generate with None, Include, Exclude masks; type both mask endpoints. Test exact threshold values, negative bounds, equal bounds, all-included and all-excluded spectra.   | None ignores mask bounds; Include/Exclude select the expected samples according to the verified backend boundary convention; masked/no-sample pixels have correct blank behavior; mask units match source intensity units.                                |
| MM-14 | Reverse mask bounds and enter blank/nonfinite mask input.                                                                                                                  | No crash or invalid numeric request. Unlike channel bounds, frontend does not sort mask bounds: establish and assert backend rejection/normalization, rather than assuming channel behavior.                                                              |
| MM-15 | Generate batch A, then B with Keep off; repeat with Keep on. Generate from a second source and repeat for the first.                                                       | Off removes the first source's prior moment images; on retains A and appends exactly B; originals, unrelated images and second-source outputs remain intact.                                                                                              |
| MM-16 | Make source the spatial reference; generate with Auto spatial matching on and off; use a nonreference source.                                                              | Option visible only for reference source; on links generated images to its spatial reference and coordinated pan/zoom works; off leaves new maps unmatched. Existing maps are not retroactively changed.                                                  |
| MM-17 | Start/stop animation, request a long spectral profile, select single-channel input and generated 2D output.                                                                | Generate disabled during animation/streaming and for one-channel frames; enabled again after valid cube becomes ready; disabled-state hint explains restrictions.                                                                                         |
| MM-18 | Generate a bounded long-running batch and cancel after progress appears; immediately retry after cancellation finishes.                                                    | Progress opens and updates; Cancel dismisses after acknowledgment; no cancelled batch images added; request/loading flags clear; retry completes once without duplicates. Do not require the progress dialog to be observable for tiny successful jobs.   |
| MM-19 | Exercise backend generation rejection, connection loss during a request, and result-image load failure in a controlled test environment.                                   | No success artifacts for failed outputs; app recovers from loading/progress state and supports retry after reconnection; image-load failure exposes its warning. Protocol fault injection supplements real-backend tests and must be labelled separately. |
| MM-20 | Activate each result, inspect properties, pan/zoom, switch back to source, then close a result and regenerate.                                                             | Generated images are usable, source cube unchanged, closed images do not persist as stale results, subsequent generation works.                                                                                                                           |
| MM-21 | Operate selectors, moment search/tag removal and Generate using keyboard; close/reopen or resize profiler.                                                                 | Focus remains usable, selection commits correctly, controls remain reachable, configuration and visible switch states agree after remount.                                                                                                                |
| MM-22 | On a verified IQUV cube, change the source Stokes plane and generate for at least two planes.                                                                              | Outputs use the intended Stokes data and match independent references; no reuse of a prior plane's result. Confirm backend contract because MomentRequest has no explicit Stokes field in this frontend path.                                             |

## All moment types

| Tag | Expected statistic                                |
| --- | ------------------------------------------------- |
| -1  | Mean value of the spectrum                        |
| 0   | Integrated value of the spectrum                  |
| 1   | Intensity weighted coordinate                     |
| 2   | Intensity weighted dispersion of the coordinate   |
| 3   | Median value of the spectrum                      |
| 4   | Median coordinate                                 |
| 5   | Standard deviation about the mean of the spectrum |
| 6   | Root mean square of the spectrum                  |
| 7   | Absolute mean deviation of the spectrum           |
| 8   | Maximum value of the spectrum                     |
| 9   | Coordinate of the maximum value of the spectrum   |
| 10  | Minimum value of the spectrum                     |
| 11  | Coordinate of the minimum value of the spectrum   |

Use backend-defined conventions for median coordinate, standard-deviation normalization, integration widths, zero total weights and undefined dispersion. Confirm these from the backend implementation before calculating golden data; names alone are insufficient. Include signed/zero-weight spectra as edge cases, without assuming all statistics are finite.

## Implementation structure and selectors

Keep one `tests/MomentMap.spec.ts` with independent named tests and a data-driven loop for MM-06. Reuse existing utilities; add only local helpers for opening the panel, choosing moments, generating/waiting, and checking outputs. Group IDs in `test.step` where they share a single coherent scenario, not one long state-dependent test.

Existing test IDs: `moment-generator-tab`, `moment-generator-file-info`, `moment-generator-image-dropdown`, `moment-generator-region-info`, `moment-generator-region-dropdown`, `moment-generator-spectral-range-from-input`, `moment-generator-spectral-range-to-input`, `moment-generator-mask-dropdown`, `moment-generator-mask-range-from-input`, `moment-generator-mask-range-to-input`, `moment-generator-clear-select-button`, `moment-generator-generate-button`, and `spectral-profiler-coordinate-dropdown`.

Use exact menu labels from the table and label-based switch locators. Scope Blueprint popup menu items to the open popup where necessary. Inspect rendered numeric input structure before choosing the actual editable locator. Add accessible names or stable test IDs for the two cursor buttons and System/rest-frequency controls if their labels do not resolve; avoid positional SVG selectors. Wait for completion and output assertions, never fixed sleeps. Keep only a few reviewed canvas screenshots for rendering regression.

## Decisions and potential defects found during design

- Generate availability currently does not check `selectedMoments.length`. Clearing all can send an empty list. Desired behavior: block generation or show clear validation without side effects; confirm the contract and add a regression assertion, rather than encoding an empty request as success.
- Keep off closes previous moment images **before** the new request succeeds. Cancellation/failure therefore may remove previous maps. Test and document this current behavior separately; preserving old maps would require a product change.
- The Keep switch is uncontrolled (`onChange` without `checked`), although the store retains `shouldKeep`. MM-21 should detect a visual/store mismatch after remount.
- Channel bounds are sorted at request time; mask bounds are not. Out-of-range channel mapping and mask threshold semantics require backend verification.
- Numerical fixtures, protocol failure injection, and a reliable cancellation fixture are prerequisites for full coverage. Do not mark missing cases passed or silently skip them.

## Execution and completion criteria

First implement and run MM-01, MM-05, MM-06, MM-07 and MM-15 on Chromium against the real configured backend. Then complete region/range/mask/conversion cases, followed by lifecycle and fault cases. Run all functional cases on Chromium, Firefox and WebKit; maintain rendering baselines per platform only where needed.

Commands after implementation:

```sh
npx playwright test tests/MomentMap.spec.ts --project=chromium
npx playwright test tests/MomentMap.spec.ts
```

Coverage is complete when every scenario has passing assertions or an explicitly tracked product defect, all 13 moments pass independent numerical checks, and cancellation/failure recovery has been exercised. Report real-backend results separately from injected failure tests. This plan itself has not run those scenarios.
