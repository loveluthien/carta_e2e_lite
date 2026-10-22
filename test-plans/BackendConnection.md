# Backend connection test plan

**Source:** [`tests/BackendConnection.spec.ts`](../tests/BackendConnection.spec.ts) · **Cases:** 3 · **Project:** `test-group5`

Use the existing 16×16×5 `cube.fits` fixture. Route only the current page's WebSocket; leave the shared backend running. Click the actual Retry alert rather than reloading the page or calling the reconnect action directly.

| Test                                                                              | Actions                                                                                                                                                            | Expected result                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retry restores the image, channel, region and profiler without reloading          | Select channel 2, draw a rectangle, close the transport and click Retry. Change to channel 3 and back after resume.                                                | The warning explains temporary-image removal. One resume request is sent, the page does not navigate, and region geometry survives. New channel data returns 12 K then 6 K at (8,8). The X profile is 6 K except for the zero-valued column 2. Raster RGB at (8,8) is white and at (2,8) is black. Compare viewer and profiler PNGs.                |
| Retry clears interrupted generation and temporary maps and allows a new map       | Generate a moment-0 image, activate the source, hold a second moment request until its progress dialog appears, disconnect and Retry. Generate again after resume. | The progress dialog closes, requesting state clears, the previous temporary map is removed, and only the source remains before retrying. Generation becomes enabled. The new map has the expected dimensions, units, headers, center value and NaN pixel; check white/black RGB through the existing moment oracle and compare viewer/profile PNGs. |
| An unavailable server keeps Retry usable and recovers when the connection returns | Disconnect a loaded channel-2 cube, reject the first reconnect transport, then allow another Retry.                                                                | The disconnection warning and enabled Retry button return after the failed attempt. No resume request or duplicate frame is created by that attempt. The next attempt resumes the session; channel navigation requests fresh data, with the same pixel, profile, RGB and PNG checks as the successful reconnect case.                               |

## Coverage boundary

These cases cover the frontend reconnect/resume workflow against a real backend. They do not stop or restart the backend process, test a timeout duration, or duplicate protocol serialization and service guard unit tests. The transport fault simulates a dropped connection and an unavailable reconnect; a real backend crash/restart remains outside this suite. Existing Moment Map and PV cases separately cover reopening the app after a failed operation.

## Run

```sh
npm test -- --project=test-group5 tests/BackendConnection.spec.ts --workers=1
```
