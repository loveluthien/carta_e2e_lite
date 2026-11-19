# Workspace restore bugs

## Channel Map settings reset when a workspace opens

**Build tested** CARTA 6.1.0-dev, frontend revision `48e03ce9b1` (also reproduced on `eee9a151fc`) and backend revision `737e2d41`.

1. Open `test_data/cube.fits` and choose **Widgets → Channel Map Control**.
2. Enable channel map mode and **Show channel string**. Set **Number of rows** to 1 and leave **Number of columns** at 2. Confirm the viewer shows channels 0 and 1.
3. Choose **File → Save Workspace**. Start a fresh CARTA session and reopen the saved workspace through **File → Open Workspace**.

**Expected** The widget and both channel panels return, with the saved 1×2 grid and channel labels.

**Actual** The widget returns with channel map mode disabled, the row count reset to 2, and channel labels disabled. The viewer shows a single image. `ChannelMapStore` is neither captured by `WorkspaceSnapshotter` nor restored by `WorkspaceRestorer`.

The [Channel Map regression test](../tests/Workspace.spec.ts) uses the real frontend serializer and loader with isolated workspace storage. Its Playwright report includes before and after viewer PNGs and a failure trace.

```sh
npx playwright test tests/Workspace.spec.ts -g 'channel map mode'
```

## Channel Map mode leaks into a restored single-panel workspace

**Build tested** CARTA 6.1.0-dev, frontend revision `48e03ce9b1` and backend revision `737e2d41`.

1. Open `test_data/cube.fits` in normal single-panel mode and save a workspace via **File → Save Workspace**.
2. In the live session, open **Widgets → Channel Map Control**, enable channel map mode and **Show channel string**, and set **Number of rows** to 1 so the viewer displays channels 0 and 1.
3. Reopen the saved single-panel workspace via **File → Open Workspace** (without refreshing the browser).

**Expected** Opening the saved workspace clears Channel Map mode and restores the single-panel view.

**Actual** `WorkspaceRestorer.clearSession()` does not reset `ChannelMapStore.isChannelMapEnabled`. The restored workspace remains stuck in Channel Map mode, displaying the 1×2 channel panels and channel labels instead of the saved single-panel image.

```sh
npx playwright test tests/Workspace.spec.ts -g 'clears Channel Map mode'
```

## Restored floating catalog plot has mismatched `componentId` and leaks its binding on close

**Build tested** CARTA 6.1.0-dev, frontend revision `48e03ce9b1` and backend revision `737e2d41`.

1. Open `test_data/catalogs/catalog-image.fits` and import `test_data/catalogs/catalog-sky.vot`.
2. In the Catalog widget, select **2D scatter** with `Flux` and `Size` and click **Plot** to open a floating Catalog Scatter Plot widget.
3. Save the workspace via **File → Save Workspace**, start a fresh session, and open the workspace via **File → Open Workspace**.
4. Close the restored floating Catalog Scatter Plot widget using its close button.

**Expected** The restored floating widget's `componentId` matches the key registered in `CatalogStore.widgetBindings` (`catalog-plot-component-0`), and closing the widget removes its binding from `CatalogStore.widgetBindings`.

**Actual** `WidgetsStore.initializeCatalogPlotWidget` registers `catalog-plot-component-0` in `CatalogWidgetBindingStore`, but `WidgetsStore.createFloatingWidget` then overwrites `config.componentId = config.id` (`catalog-plot-0`). As a result, the restored floating widget's `componentId` does not match its binding, and closing the floating plot leaves an orphaned entry in `CatalogStore.widgetBindings` (which also persists if the workspace is saved again).

```sh
npx playwright test tests/Workspace.spec.ts -g 'keeps its componentId'
```

## Floating Moment Map settings overtake the PV Generator on restore

**Status** Fixed in frontend revision `48e03ce9b1` (previously reproduced on `eee9a151fc`).

## The HiPS Survey form resets on workspace restore

**Status** Fixed in frontend revision `48e03ce9b1` (previously reproduced on `eee9a151fc`).

## Invalid PV-axis zoom prevents scalar zoom fallback

The independent PV-axis zoom E2E test saved unequal X/Y zoom and reopened both the current workspace and a legacy copy with the axis-specific zoom omitted. Both restored the expected zoom.

To exercise malformed workspace recovery, the test then sets the saved `axisZoomLevel` to `{x: -1, y: 0}` while leaving the valid scalar zoom in place. The expected fallback is to open the workspace and use the saved scalar zoom for both axes. Instead, workspace validation fails and the Open Workspace dialog shows **Could not read the workspace**. This case uses an injected invalid record.

```sh
npx playwright test tests/ImageViewer.spec.ts -g 'PNG export and workspace round trip'
```
