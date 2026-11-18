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
