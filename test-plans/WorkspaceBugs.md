# Workspace restore bugs

## Channel Map settings reset when a workspace opens

**Build tested** CARTA 6.1.0-dev, frontend revision `eee9a151fc` and backend revision `737e2d41`.

1. Open `test_data/cube.fits` and choose **Widgets → Channel Map Control**.
2. Enable channel map mode and **Show channel string**. Set **Number of rows** to 1 and leave **Number of columns** at 2. Confirm the viewer shows channels 0 and 1.
3. Choose **File → Save Workspace**. Start a fresh CARTA session and reopen the saved workspace through **File → Open Workspace**.

**Expected** The widget and both channel panels return, with the saved 1×2 grid and channel labels.

**Actual** The widget returns with channel map mode disabled, the row count reset to 2, and channel labels disabled. The viewer shows a single image.

The [Channel Map regression test](../tests/Workspace.spec.ts) uses the real frontend serializer and loader with isolated workspace storage. Its Playwright report includes before and after viewer PNGs and a failure trace.

```sh
npx playwright test tests/Workspace.spec.ts -g 'channel map mode'
```

## Floating Moment Map settings overtake the PV Generator on restore

**Build tested** CARTA 6.1.0-dev, frontend revision `eee9a151fc` and backend revision `737e2d41`.

1. Open the Spectral Profiler settings on the **Moments** tab.
2. Open the floating **PV Generator** afterward so it is in front of the Moment Map settings in the window stack.
3. Save the workspace with both windows open. Reopen it in a fresh CARTA session.

**Expected** The PV Generator stays in front of the Moment Map settings.

**Actual** The Moment Map settings move in front of the PV Generator. Both windows keep their positions and settings values. The regression test checks their relative stacking order separately from the restored settings and regenerated images.

The loader restores the regular widget layout before recreating floating widget settings panels, which places the recreated settings panels on top.

```sh
npx playwright test tests/Workspace.spec.ts -g 'changed moment map and PV'
```

## The HiPS Survey form resets on workspace restore

**Build tested** CARTA 6.1.0-dev, frontend revision `eee9a151fc` and backend revision `737e2d41`.

1. Open **View → Online Data Query → HiPS Survey** and load a cutout. The regression uses a mocked survey for M 31 with a 16×16 cutout, a field of view of 0.016, SIN projection, and a 45° rotation.
2. Reopen the HiPS Survey tab, edit the width to 24, and save the workspace with the form still open.
3. Open the workspace in a fresh CARTA session.

**Expected** CARTA regenerates the original 16×16 cutout and restores the open form with the unsent width of 24 and the other saved values.

**Actual** CARTA replays the original request, restores the cutout pixels, and reopens the HiPS Survey tab. The survey, object, dimensions, and field of view are blank. The projection returns to TAN and the rotation returns to 0°.

```sh
npx playwright test tests/Workspace.spec.ts -g 'a HiPS image'
```
