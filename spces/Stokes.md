# Stokes test plan

**Source:** [`tests/Stokes.spec.ts`](../tests/Stokes.spec.ts) · **Cases:** 2

Stokes cube assembly and analysis widget controls.

## Setup and checks

- Run each Playwright case in a fresh page against the configured CARTA server. Use the existing fixture and helper calls named by the source test.
- Check the requested widget/dialog state, data or store values, and the effect in the image viewer and applicable profiler. Treat a visible canvas alone as insufficient for a numerical result.
- For viewer or profile changes, compare a stable PNG with a reviewed baseline; inspect overlay text and numeric readouts as well.
- For rejected input or a failed operation, verify no unwanted image is created and the user can recover. Exercise every button relevant to the scenario.
- Referenced FITS fixtures: `iquv.fits`, `stokes.I.fits`, `stokes.Q.fits`, `stokes.U.fits`, `stokes.V.fits`.
- Current source contains no named PNG baseline check; the table below describes intended outcomes and does not claim any test has passed.

## Cases

| Test (source line)                                                               | Action                                                                                              | Expected result                                                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [merges IQUV inputs and renders every Stokes plane](../tests/Stokes.spec.ts#L79) | Load separate I/Q/U/V FITS inputs, merge into a hypercube and step through original/derived planes. | Stokes plane selection changes viewer and profile; values and raster PNGs agree with expected data. |
| [exercises every Stokes Analysis widget control](../tests/Stokes.spec.ts#L163)   | Open Stokes Analysis widget and exercise source, region, plotting, styling and analysis controls.   | Each control updates its visible state and produced profile/plot or value as expected.              |

## Run

```sh
npx playwright test tests/Stokes.spec.ts --project=chromium
npx playwright test tests/Stokes.spec.ts
```
