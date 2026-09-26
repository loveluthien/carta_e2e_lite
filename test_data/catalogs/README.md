# Catalog coordinate-column variants (#2954)

## How to use these

**Every file that is expected to work holds the same 20 sources.** Load one, then
load another, and not a single marker should move. Anything that moves is a bug;
you do not have to check numbers.

Two things to know before counting dots:

- The image is `mosaic_SCI.fits`. It is **5.9′ × 2.3′** and the catalog has a
  **3′ radius**, so only **12 of the 20 sources fall on it**. A correct overlay shows
  12 markers, not 20. Rows 1, 2, 3, 6, 8, 9, 12, 13, 14, 17, 18 and 19 (one-based)
  are the visible ones.
- The rows deliberately corrupted in the `PARTIAL` files were chosen from those
  12, so a dropped row is a marker you can actually see disappear.

Each file's decoded positions were checked against the branch's own parser before
it was written, so a marker in the wrong place is a bug in the app, not the data.

---

## 1. Formats: all must look identical to `00_baseline`

Load one, load the next, and not a single marker may move. `00`–`11`.

| File | RA / longitude | Dec / latitude | Units | What it exercises |
| --- | --- | --- | --- | --- |
| `00_baseline_decimal_deg` | `150.011475` | `2.524293` | `deg` | control |
| `01_sexagesimal_colon_units` | `10:00:02.754` | `+02:31:27.45` | `h:m:s` / `d:m:s` | declared sexagesimal |
| `02_sexagesimal_colon_nounits` | same | same | none | format sniffed from values; hours vs degrees decided by the axis |
| `03_sexagesimal_letters` | `10h00m02.754s` | `+02d31m27.45s` | none | explicit markers override everything |
| `04_sexagesimal_space` | `10 00 02.754` | `+02 31 27.45` | `h:m:s` / `d:m:s` | whitespace separators |
| `05_compact_hhmmss` | `100002.754` | `+023127.45` | `h:m:s` / `d:m:s` | separator-free ESO form |
| `06_decimal_hours` | `10.00076` | `2.524293` | `h` / `deg` | decimal hours, as a **string** |
| `07_radians` | `2.6182` | `0.04406` | `rad` | radians, as **strings** |
| `08_unicode_dms` | `150°00′41.31″` | `+2°31′27.45″` | none | Unicode marks; RA as a **degree** longitude, not hours |
| `09_casa_dot_dec` | `10:00:02.754` | `+02.31.27.45` | `h:m:s` / `d:m:s` | CASA dot-separated declination |
| `10_numeric_hours` | `10.00076` | `2.524293` | `h` / `deg` | the same values as `06`, but a **numeric** column. A Double never reaches the string parser, so only the declared unit can scale it |
| `11_numeric_radians` | `2.6182` | `0.04406` | `rad` | the same values as `07`, as **numeric** columns |

`10` and `11` are the two that were not covered before: the unit was ignored on a
numeric column and the values taken as degrees, which puts RA about 140° away and
empties the overlay.

## 1b. The one file you check in the table, not on the image

| File | RA / longitude | Dec / latitude | Units | What it exercises |
| --- | --- | --- | --- | --- |
| `12_unicode_minus` | `10:00:02.754` | `−22:31:27.45` | `h:m:s` / `d:m:s` | U+2212 minus instead of ASCII hyphen |

Kept apart from group 1 because it cannot be checked the way the rest are. Every
declination is shifted 20° south so that all of them are negative, which puts the whole
catalog off the image: there are no markers to compare. Read the decoded RA and Dec in
the catalog table instead.

## 2. Must fail, and visibly

| File | Expected |
| --- | --- |
| `20_FAIL_compact_no_units` | **nothing plotted.** Same values as `05` with the units removed. Nothing in `100002.754` says it is sexagesimal, so it has to be read as a decimal degree value; that puts every declination past a pole and drops every row. If markers appear, the compact form is being guessed from the values, which it must never be. |
| `21_PARTIAL_out_of_range_lat` | **9 markers instead of 12.** Rows 2, 9 and 17 hold declinations of +91, −95 and +100. Those must vanish; the rest must be untouched. A marker parked at the edge of the frame means the row was misplaced instead of dropped. |
| `22_PARTIAL_unparseable_rows` | **9 markers instead of 12.** Rows 1, 9 and 18 hold an object name, an empty value, and a minutes field of 70. |

## 3. Which columns the UI offers and picks

The **Displayed columns** preference (Preferences > Catalog, default 10) decides how many
columns a catalog shows on load. It has no upper bound, and `30` / `31` only mean anything
while the coordinate columns sit beyond it, since otherwise they would be displayed for that
reason alone and the file would pass whether or not the fix is there. Their coordinates are
at positions 31 and 32 so that no plausible setting reaches them; if yours is above 30,
lower it before this group.

| File | Expected |
| --- | --- |
| `30_coords_past_display_cut` | Coordinates sit at positions 31 and 32, past any displayed column count. They must be **displayed on load anyway** and auto-selected. |
| `31_coords_past_display_cut_string_nounits` | The same, as unitless strings. This is the case that cannot recover later: without values there is nothing to recognize, and values only arrive for displayed columns. |
| `32_decoy_error_columns` | `e_RAJ2000`, `pmRA`, `RA_err` and `sigma_DE` come first. Auto-select must take `RAJ2000` / `DEJ2000`; the decoys must still be **selectable by hand**, listed below the real ones. |
| `33_swapped_names` | The column named `DEJ2000` holds the RA. Auto-select will get it wrong. The point is that you can then pick the other column on each axis and the sources land correctly. A name must not stop a column being chosen. |
| `34_no_coordinate_names` | Columns named `col_a` / `col_b`. Nothing auto-selected; both must appear on both axis menus so it can be plotted by hand. |
| `35_system_priority_icrs` | Three equatorial pairs, system ICRS. `RA_ICRS` / `DE_ICRS` must win. |
| `36_system_priority_fk4` | The same three pairs, system FK4/B1950. `RAB1950` / `DEB1950` must win. |

The B1950 columns are a real decoy: fifty years of precession moves RA by 0.65°,
about seven times the image width, so a wrong pick is unmistakable.

## 4. Coordinate frames: all must land on the same sources

| File | Expected |
| --- | --- |
| `40_galactic_decimal` | Galactic, decimal degrees. |
| `41_galactic_sexagesimal` | Galactic as **unitless** sexagesimal. The longitude must be read as degrees; reading it as hours would move every source by a factor of fifteen. This is the strongest test that hours-vs-degrees comes from the axis and not from the separator. |
| `42_ecliptic_decimal` | Ecliptic, decimal degrees. |
| `43_ecliptic_sexagesimal` | Ecliptic with declared `d:m:s` on both axes. |
| `44_ecliptic_fk4` | The **B1950** ecliptic, declared the VOTable way as `ecl_FK4`. The system name implies B1950 with no equinox attribute to read, so this is the one file that exercises that default. Reading it on the J2000 ecliptic moves every source 0.69°. |
| `45_fk4_b1900` | FK4 with a **declared equinox of B1900**, which is not the standard value for the system. Every other file declares the equinox its system implies anyway, so this is the only one that shows whether the declared value is read at all. Ignoring it and falling back to B1950 moves every source 0.69°. |

These are the files where a failure is silent. A frame error is two-thirds of a degree,
which is seven image widths, so a wrong result plots **nothing at all** rather than
plotting somewhere visibly wrong. Read an empty overlay here as "which frame did it
use", not as "it could not parse the values".

`42` and `43` were regenerated in September 2026. They had been written on the *true*
ecliptic (which carries nutation) while AST's `System=ECLIPTIC` is the *mean* ecliptic,
so every source sat 13.8" from where the app correctly put it, which is 229 mosaic pixels.
Checked against the AST wasm itself rather than assumed. If you have an older copy of
these two files, replace them.

## 5. Pixel axes: computed from the image WCS

| File | Expected |
| --- | --- |
| `50_pixel0_numeric` | Zero-based `xcentroid` / `ycentroid` under PIX0. Same sources as every other file. |
| `51_pixel0_string_nounits` | The same values as unitless strings. A pixel axis must not scale them the way a longitude would, and a y of 2288 must not be mistaken for an out-of-range latitude. |
| `52_pixel1_numeric` | One-based `X_IMAGE` / `Y_IMAGE` under PIX1, as SExtractor writes them. Must land on the same sources as `50` despite the one-pixel offset. If they sit one pixel off, the PIX0/PIX1 handling is wrong. |
| `53_pixel0_angular_decoy` | Pixel columns alongside `radius_arcsec` and `radius_arcmin`. The angular columns must stay **selectable** on the pixel axes, ranked below the pixel ones rather than hidden. |

Sources that fall outside the image have pixel coordinates that are negative or
larger than the image, which is correct: they are simply off-frame.

## 6. Streamed columns

| File | Expected |
| --- | --- |
| `60_stream_late_string_format` | 1200 rows of unitless sexagesimal strings whose **first 60 rows are blank**. Every other file here holds 20 rows and arrives in a single response, so the format is settled from the first chunk and none of the streaming logic runs. The store asks for 50 rows first and then in chunks of 50, so 60 blank rows mean the format cannot be settled from the first response but is settled by the second, which forces the store to re-read the rows it had already buffered. |

What to watch for:

- **No marker at the image origin.** Rows whose format was not yet known are held as
  NaN and backfilled later; if they were skipped instead, their slots stay zero-filled
  and show up as a clump at pixel (0, 0).
- **12 marker positions once it finishes,** the same ones every other file produces.
  The file cycles through the 12 on-image sources, so about 95 rows land on each.
- **The count keeps up.** The source count must not fall behind the rows loaded; a
  chunk dropped mid-stream leaves every later chunk written at the wrong offset.
- Let it finish. Judging this file from the first page is the one thing that will
  mislead you: the first 60 rows are *meant* to be empty until the format settles.
- `Max rows` opens at 1200, the whole file, which is what this needs. It is per catalog
  and always starts at the file's own size, so there is nothing to set beforehand. But
  if you lower it below about 100, the format can never be settled and nothing will
  plot.

---

## Manual UI procedure

Roughly ten minutes. Load `mosaic_SCI.fits` once and leave it up throughout.

### A. Formats round-trip

1. Load `mosaic_SCI.fits`.
2. Load `00_baseline_decimal_deg.vot`. Open the catalog widget, set the plot type to
   **Image overlay**, and plot. Expect **12 markers**.
3. Without touching the axis menus, load `01` through `11` in turn and plot each.
   **Not a single marker may move.** This is the whole test; you never need to read a
   number.
4. `12_unicode_minus` is the exception: 20° south, so it shows nothing. Check its
   decoded values in the catalog table instead.

### B. Failures are visible

5. `20_FAIL_compact_no_units`: **nothing plotted**. Markers here mean the compact
   form is being guessed from the values.
6. `21_PARTIAL_out_of_range_lat`: **9 markers**, not 12. A marker parked at the frame
   edge means a row was misplaced rather than dropped.
7. `22_PARTIAL_unparseable_rows`: **9 markers**, not 12.

### C. Column offering and auto-selection

8. `30` and `31`: the coordinate columns sit at positions 31 and 32, past any
   displayed column count, and must be **shown in the table on load** and auto-selected
   without you doing anything. Scroll the table right to confirm they are really there.
   `31` is the one that cannot recover if this fails. Check **Preferences > Catalog >
   Displayed columns** is below 30 first, or this pair proves nothing.
9. `32_decoy_error_columns`: auto-select must take `RAJ2000` / `DEJ2000`; open each
   axis menu and confirm the decoys are still **listed**, below the real ones.
10. `33_swapped_names`: auto-select gets it wrong on purpose. Pick the other column on
    each axis by hand and confirm the sources land correctly.
11. `34_no_coordinate_names`: nothing auto-selected; both columns must appear on both
    axis menus.
12. `35` / `36`: the system-matching pair must win. A wrong pick is 0.65° off, so the
    overlay empties.

### D. Coordinate frames

13. `40` / `41` (galactic), `42` / `43` (ecliptic J2000), `44` (ecliptic B1950),
    `45` (FK4 B1900). **Each must land on the same 12 sources**, exactly as in step 2.
14. A failure here is an **empty overlay**, not markers in the wrong place: two-thirds
    of a degree is seven image widths. Which file is empty says what broke. `44` means
    the `ecl_FK4` B1950 default was lost, `45` means the declared equinox was ignored,
    `42` / `43` mean ecliptic was read as equatorial.

### E. Streaming

15. Load `60_stream_late_string_format.vot` and plot. `Max rows` opens at 1200 by
    itself; leave it alone. Let the rows finish arriving, then follow the checks in
    section 6.

### F. Pixel axes

16. `50` through `53` as described in section 5. These are computed from the mosaic's
    own WCS and mean nothing on another image.

---

## Not covered here

- **Scatter and histogram plots.** String coordinate columns are deliberately not
  offered there yet.
- **A combined `RA, Dec` single column.** Out of scope: CARTA takes longitude and
  latitude as two separate columns.
