# Snippets test plan

**Source:** [`tests/Snippets.spec.ts`](../tests/Snippets.spec.ts) · **Cases:** 6

Code Snippets workflows that create or modify image products.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Apply the shared test preferences before executing snippets so the Code Snippets menu is enabled. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `IRCp10216_sci.spw0.cube.IQUV.manual.pbcor.subimage.fits`, `M17_SWex.fits`, `dice_four.fits`, `m16_f0444w.fits`, `m16_f0770w.fits`, `m16_f1130w.fits`, `m16_f1500w.fits`.
- Current source contains named PNG baseline checks; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                               | Action                                                                                                | Expected result                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Image properties](../tests/Snippets.spec.ts#L5) | Run image-property snippets for center, zoom, channel, Stokes, percentile scaling and gray inversion. | Animator reflects channel/Stokes choice and the viewer PNG shows the rendered Stokes U grayscale image within 3% pixel tolerance. |
| [Regions](../tests/Snippets.spec.ts#L55)         | Run region-creation and edit snippet.                                                                 | Viewer PNG shows scripted regions and styling.                                                                                    |
| [Moment images](../tests/Snippets.spec.ts#L76)   | Run moment-generation snippet.                                                                        | Generated moment image appears in the image-panel PNG.                                                                            |
| [PV images](../tests/Snippets.spec.ts#L110)      | Run PV-generation snippet after creating a line region.                                               | PV image appears in the image-panel PNG.                                                                                          |
| [Image fitting](../tests/Snippets.spec.ts#L134)  | Run automatic and manual four-component fitting snippets.                                             | Result text contains four components and model/residual viewer PNGs render.                                                       |
| [Color blending](../tests/Snippets.spec.ts#L216) | Create, remove and modify a multi-image color blend through snippets.                                 | Viewer PNGs show layer addition/removal and alpha changes.                                                                        |

## Run

```sh
npm test -- --project=test-group3 tests/snippets.spec.ts
```
