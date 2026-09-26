#!/usr/bin/env python
# /// script
# requires-python = ">=3.10"
# dependencies = ["astropy", "numpy"]
# ///
"""Generate catalog variants for manually testing the coordinate-column changes in #2954.

Run it from this directory:
    uv run generate.py

The source catalog and image default to their siblings one directory up; pass
different ones as arguments if they live somewhere else.

Every variant holds the same 20 sources as mosaic_SCI_votable.vot, so each file
that is expected to work must plot markers in exactly the same places. Flipping
between two such files in the catalog overlay should not move a single dot.
The files that are expected to fail say so in their name and in the README.
"""

import os
import sys
import xml.sax.saxutils as saxutils

import numpy as np
from astropy import units as u
from astropy.coordinates import FK4, Angle, BarycentricMeanEcliptic, SkyCoord
from astropy.io import fits
from astropy.table import Table
from astropy.wcs import WCS

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT_DIR, os.pardir, "mosaic_SCI_votable.vot")
IMAGE = sys.argv[2] if len(sys.argv) > 2 else os.path.join(OUT_DIR, os.pardir, "mosaic_SCI.fits")

COOSYS = {
    "icrs": '<COOSYS ID="system" system="ICRS"/>',
    "fk5": '<COOSYS ID="system" system="eq_FK5" equinox="J2000"/>',
    "fk4": '<COOSYS ID="system" system="eq_FK4" equinox="B1950"/>',
    "galactic": '<COOSYS ID="system" system="galactic"/>',
    "ecliptic": '<COOSYS ID="system" system="ecl_FK5" equinox="J2000"/>',
    "ecliptic_fk4": '<COOSYS ID="system" system="ecl_FK4" equinox="B1950"/>',
    "fk4_b1900": '<COOSYS ID="system" system="eq_FK4" equinox="B1900"/>',
    "pixel0": '<COOSYS ID="system" system="PIX0"/>',
    "pixel1": '<COOSYS ID="system" system="PIX1"/>',
}


def column(name, values, datatype="char", unit=None, ucd=None, description=None):
    return {"name": name, "values": values, "datatype": datatype, "unit": unit, "ucd": ucd, "description": description}


def write_votable(filename, description, coosys, columns):
    n_rows = len(columns[0]["values"])
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">',
        f" <DESCRIPTION>{saxutils.escape(description)}</DESCRIPTION>",
        ' <RESOURCE type="results">',
        f"  {COOSYS[coosys]}",
        '  <TABLE name="variant">',
    ]

    for col in columns:
        attrs = [f'name="{col["name"]}"']
        if col["ucd"]:
            attrs.append(f'ucd="{col["ucd"]}"')
        attrs.append('ref="system"')
        attrs.append(f'datatype="{col["datatype"]}"')
        if col["datatype"] == "char":
            attrs.append('arraysize="*"')
        if col["unit"]:
            attrs.append(f'unit="{saxutils.quoteattr(col["unit"])[1:-1]}"')
        field = f'   <FIELD {" ".join(attrs)}>'
        if col["description"]:
            field += f'<DESCRIPTION>{saxutils.escape(col["description"])}</DESCRIPTION>'
        lines.append(field + "</FIELD>")

    lines.append("   <DATA><TABLEDATA>")
    for row in range(n_rows):
        cells = "".join(f"<TD>{saxutils.escape(str(col['values'][row]))}</TD>" for col in columns)
        lines.append(f"    <TR>{cells}</TR>")
    lines += ["   </TABLEDATA></DATA>", "  </TABLE>", " </RESOURCE>", "</VOTABLE>", ""]

    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    return path


# ---------------------------------------------------------------- source data

table = Table.read(SOURCE)
ra_deg = np.asarray(table["RAJ2000"], dtype=float)
dec_deg = np.asarray(table["DEJ2000"], dtype=float)
name = [str(v) for v in table["_2MASS"]]
jmag = [f"{float(v):.3f}" for v in table["Jmag"]]
hmag = [f"{float(v):.3f}" for v in table["Hmag"]]
kmag = [f"{float(v):.3f}" for v in table["Kmag"]]

icrs = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, frame="fk5", equinox="J2000").icrs
# An explicit equinox matters: transform_to("fk4") keeps the source obstime and returns a
# position barely distinguishable from J2000, which would make the B1950 decoy columns useless.
fk4 = icrs.transform_to(FK4(equinox="B1950"))
galactic = icrs.galactic
# AST's System=ECLIPTIC is the MEAN ecliptic of the equinox, so barycentrictrueecliptic (which
# carries nutation) is the wrong frame here: it puts every source 13.8 arcsec away, which is 229
# pixels on the 0.06 arcsec/pixel mosaic. Checked against the AST wasm itself.
ecliptic = icrs.transform_to(BarycentricMeanEcliptic(equinox="J2000"))
ecliptic_b1950 = icrs.transform_to(BarycentricMeanEcliptic(equinox="B1950"))
fk4_b1900 = icrs.transform_to(FK4(equinox="B1900"))

# Pixel coordinates come from the image the overlay is loaded onto, so the markers land on the
# same sources as every other variant. world_to_pixel is zero-based; the SExtractor-style
# X_IMAGE / Y_IMAGE columns are one-based, which is the difference between the PIX0 and PIX1
# coordinate systems.
with fits.open(IMAGE) as hdul:
    image_wcs = WCS(next(hdu for hdu in hdul if hdu.data is not None and hdu.data.ndim >= 2).header).celestial
pixel_x0, pixel_y0 = image_wcs.world_to_pixel(icrs)

# The image is 5.9 by 2.3 arcmin and the catalog has a 3 arcmin radius, so only some of the
# sources fall on it. Rows corrupted on purpose are chosen from the ones that do, otherwise
# removing them would change nothing you can see.
image_shape = (2310, 5928)
ON_IMAGE = [
    row
    for row in range(len(ra_deg))
    if 0 <= pixel_x0[row] < image_shape[1] and 0 <= pixel_y0[row] < image_shape[0]
]

DEC_STR = [f"{v:.6f}" for v in dec_deg]
RA_STR = [f"{v:.6f}" for v in ra_deg]


def hms(values, sep=":", precision=3):
    return list(Angle(values, unit=u.deg).to_string(unit=u.hour, sep=sep, precision=precision, pad=True))


def dms(values, sep=":", precision=2, sign=True):
    return list(Angle(values, unit=u.deg).to_string(unit=u.deg, sep=sep, precision=precision, pad=True, alwayssign=sign))


RA_HMS = hms(ra_deg)
DEC_DMS = dms(dec_deg)
COMMON = [
    column("Name", name, ucd="meta.id;meta.main"),
    column("Jmag", jmag, datatype="double", unit="mag"),
    column("Hmag", hmag, datatype="double", unit="mag"),
    column("Kmag", kmag, datatype="double", unit="mag"),
]

written = []


def emit(filename, description, coosys, coord_columns, extra=None, lead=None):
    columns = (lead or []) + coord_columns + COMMON + (extra or [])
    written.append((filename, description))
    write_votable(filename, description, coosys, columns)


# ------------------------------------------------- group 1: format round-trip
# Each of these must plot identically to the baseline.

emit(
    "00_baseline_decimal_deg.vot",
    "Control. Numeric decimal degrees, as the original VizieR file.",
    "fk5",
    [
        column("RAJ2000", RA_STR, datatype="double", unit="deg", ucd="pos.eq.ra;meta.main"),
        column("DEJ2000", DEC_STR, datatype="double", unit="deg", ucd="pos.eq.dec;meta.main"),
    ],
)

emit(
    "01_sexagesimal_colon_units.vot",
    "String sexagesimal with declared h:m:s / d:m:s units.",
    "fk5",
    [column("RAJ2000", RA_HMS, unit="h:m:s"), column("DEJ2000", DEC_DMS, unit="d:m:s")],
)

emit(
    "02_sexagesimal_colon_nounits.vot",
    "The same values with no units at all. The format has to be sniffed from the values, and hours versus degrees decided by which axis each column is bound to.",
    "fk5",
    [column("RAJ2000", RA_HMS), column("DEJ2000", DEC_DMS)],
)

emit(
    "03_sexagesimal_letters.vot",
    "Explicit h/m/s and d/m/s markers, no units. The markers alone settle the scaling.",
    "fk5",
    [column("RAJ2000", hms(ra_deg, sep=("h", "m", "s"))), column("DEJ2000", dms(dec_deg, sep=("d", "m", "s")))],
)

emit(
    "04_sexagesimal_space.vot",
    "Whitespace-separated fields, as VizieR renders RAhms / DEdms columns.",
    "fk5",
    [column("RAJ2000", hms(ra_deg, sep=" "), unit="h:m:s"), column("DEJ2000", dms(dec_deg, sep=" "), unit="d:m:s")],
)

emit(
    "05_compact_hhmmss.vot",
    "Separator-free HHMMSS.s / DDMMSS.s, as ESO target lists write them. Only readable because the units declare sexagesimal.",
    "fk5",
    [
        column("RAJ2000", [v.replace(":", "") for v in RA_HMS], unit="h:m:s"),
        column("DEJ2000", [v.replace(":", "") for v in DEC_DMS], unit="d:m:s"),
    ],
)

emit(
    "06_decimal_hours.vot",
    "RA as decimal hours, declared by the unit. HEASARC serves RA this way.",
    "fk5",
    [
        column("RAJ2000", [f"{v / 15.0:.8f}" for v in ra_deg], unit="h"),
        column("DEJ2000", DEC_STR, unit="deg"),
    ],
)

emit(
    "07_radians.vot",
    "Both axes in radians, declared by the unit. The CDS catalogue standard defines RArad.",
    "fk5",
    [
        column("RAJ2000", [f"{np.deg2rad(v):.10f}" for v in ra_deg], unit="rad"),
        column("DEJ2000", [f"{np.deg2rad(v):.10f}" for v in dec_deg], unit="rad"),
    ],
)

emit(
    "08_unicode_dms.vot",
    "Unicode degree/prime/double-prime marks, with the RA written as a degree DMS longitude rather than hours.",
    "fk5",
    [
        column("RAJ2000", dms(ra_deg, sep=("°", "′", "″"), sign=False)),
        column("DEJ2000", dms(dec_deg, sep=("°", "′", "″"))),
    ],
)

emit(
    "09_casa_dot_dec.vot",
    "Declination in the CASA dot-separated form, e.g. +02.31.27.45. AST reads this as a truncated decimal; the parser has to recognize it.",
    "fk5",
    [
        column("RAJ2000", RA_HMS, unit="h:m:s"),
        column("DEJ2000", [v.replace(":", ".", 2) for v in DEC_DMS], unit="d:m:s"),
    ],
)

emit(
    "10_numeric_hours.vot",
    "RA as a NUMERIC column in decimal hours. A Double column never reaches the string parser, so "
    "only the declared unit can scale it.",
    "fk5",
    [
        column("RAJ2000", [f"{v / 15.0:.8f}" for v in ra_deg], datatype="double", unit="h"),
        column("DEJ2000", DEC_STR, datatype="double", unit="deg"),
    ],
)

emit(
    "11_numeric_radians.vot",
    "Both axes as NUMERIC columns in radians. Same point as 10: the scale has to come from the unit.",
    "fk5",
    [
        column("RAJ2000", [f"{np.deg2rad(v):.10f}" for v in ra_deg], datatype="double", unit="rad"),
        column("DEJ2000", [f"{np.deg2rad(v):.10f}" for v in dec_deg], datatype="double", unit="rad"),
    ],
)

emit(
    "12_unicode_minus.vot",
    "Declinations written with U+2212 MINUS SIGN instead of ASCII hyphen, as a hand-edited catalog might be. Values are shifted south so every row is negative.",
    "fk5",
    [
        column("RAJ2000", RA_HMS, unit="h:m:s"),
        column("DEJ2000", [v.replace("+", "−") for v in dms(-np.abs(dec_deg) - 20.0)], unit="d:m:s"),
    ],
)

# ------------------------------------------- group 2: must fail, and visibly

emit(
    "20_FAIL_compact_no_units.vot",
    "EXPECTED TO PLOT NOTHING. The same compact values as 05 but with no units. Nothing in '100002.754' says it is sexagesimal, so it must be read as a decimal degree value, which puts the declination beyond a pole and drops every row.",
    "fk5",
    [
        column("RAJ2000", [v.replace(":", "") for v in RA_HMS]),
        column("DEJ2000", [v.replace(":", "") for v in DEC_DMS]),
    ],
)

OUT_OF_RANGE_ROWS = ON_IMAGE[1::4][:3]
bad_dec = list(DEC_DMS)
for index, value in zip(OUT_OF_RANGE_ROWS, ("+91:00:00", "-95:30:00", "+100:00:00")):
    bad_dec[index] = value

emit(
    "21_PARTIAL_out_of_range_lat.vot",
    f"Three rows ({', '.join(str(r + 1) for r in OUT_OF_RANGE_ROWS)}, one-based) carry a declination beyond a pole. Those must be dropped, not placed somewhere arbitrary, and the rest must be unaffected.",
    "fk5",
    [column("RAJ2000", RA_HMS, unit="h:m:s"), column("DEJ2000", bad_dec, unit="d:m:s")],
)

UNPARSEABLE_ROWS = ON_IMAGE[0::5][:3]
mixed_ra = list(RA_HMS)
mixed_dec = list(DEC_DMS)
for index, ra_value, dec_value in zip(UNPARSEABLE_ROWS, ("NGC 1333", "", "12:70:00"), ("Perseus", "", "+02:31:27")):
    mixed_ra[index] = ra_value
    mixed_dec[index] = dec_value

emit(
    "22_PARTIAL_unparseable_rows.vot",
    f"Three rows ({', '.join(str(r + 1) for r in UNPARSEABLE_ROWS)}, one-based) hold an object name, an empty value and an out-of-range minutes field. Each must be dropped without disturbing its neighbours.",
    "fk5",
    [column("RAJ2000", mixed_ra, unit="h:m:s"), column("DEJ2000", mixed_dec, unit="d:m:s")],
)

# ------------------------------------ group 3: which columns the UI picks

# The "Displayed columns" preference defaults to 10 but has no upper bound, and a reader who has
# raised it would see these coordinates displayed for that reason alone -- the file would pass
# whether or not coordinate columns are nominated on load. 30 filler columns put them beyond any
# setting anyone is likely to be using, and beyond the point where scrolling to them is a chore.
DISPLAY_CUT_FILLER_COLUMNS = 30
filler = [
    column(f"aux_{i:02d}", [f"{i}.{row}" for row in range(len(ra_deg))], datatype="double")
    for i in range(DISPLAY_CUT_FILLER_COLUMNS)
]

emit(
    "30_coords_past_display_cut.vot",
    f"Coordinates sit at positions {DISPLAY_CUT_FILLER_COLUMNS + 1} and {DISPLAY_CUT_FILLER_COLUMNS + 2}, "
    "far past the displayed column count. They must still be displayed and auto-selected on load.",
    "fk5",
    [column("RAJ2000", RA_STR, datatype="double", unit="deg"), column("DEJ2000", DEC_STR, datatype="double", unit="deg")],
    lead=filler,
)

emit(
    "31_coords_past_display_cut_string_nounits.vot",
    "The same, but the coordinates are unitless strings. Their format can only be recognized from their values, and values only arrive for displayed columns, so this is the case that fails if they are not displayed on load.",
    "fk5",
    [column("RAJ2000", RA_HMS), column("DEJ2000", DEC_DMS)],
    lead=filler,
)

emit(
    "32_decoy_error_columns.vot",
    "Error and proper-motion columns are named like coordinates and come first. Auto-select must pick RAJ2000 / DEJ2000, and the decoys must still be selectable by hand, ranked below.",
    "fk5",
    [
        column("e_RAJ2000", [f"{v:.4f}" for v in np.linspace(0.01, 0.2, len(ra_deg))], datatype="double", unit="arcsec"),
        column("pmRA", [f"{v:.4f}" for v in np.linspace(-5, 5, len(ra_deg))], datatype="double", unit="mas/yr"),
        column("RA_err", [f"{v:.4f}" for v in np.linspace(0.01, 0.2, len(ra_deg))], datatype="double", unit="arcsec"),
        column("sigma_DE", [f"{v:.4f}" for v in np.linspace(0.01, 0.2, len(ra_deg))], datatype="double", unit="arcsec"),
        column("RAJ2000", RA_STR, datatype="double", unit="deg"),
        column("DEJ2000", DEC_STR, datatype="double", unit="deg"),
    ],
)

emit(
    "33_swapped_names.vot",
    "The column named DEJ2000 holds the right ascension and vice versa. Auto-select will get it wrong; the point is that both columns stay selectable on both axes so it can be corrected by hand.",
    "fk5",
    [column("RAJ2000", DEC_STR, datatype="double", unit="deg"), column("DEJ2000", RA_STR, datatype="double", unit="deg")],
)

emit(
    "34_no_coordinate_names.vot",
    "Nothing is named like a coordinate. Nothing should be auto-selected, and both columns must still be offered on both axes.",
    "fk5",
    [column("col_a", RA_STR, datatype="double", unit="deg"), column("col_b", DEC_STR, datatype="double", unit="deg")],
)

emit(
    "35_system_priority_icrs.vot",
    "Three equatorial pairs at once. With an ICRS system the _ICRS pair must win, the J2000 pair is compatible, and the B1950 pair must never be auto-selected.",
    "icrs",
    [
        column("RAB1950", [f"{v:.6f}" for v in fk4.ra.deg], datatype="double", unit="deg"),
        column("DEB1950", [f"{v:.6f}" for v in fk4.dec.deg], datatype="double", unit="deg"),
        column("RAJ2000", RA_STR, datatype="double", unit="deg"),
        column("DEJ2000", DEC_STR, datatype="double", unit="deg"),
        column("RA_ICRS", [f"{v:.6f}" for v in icrs.ra.deg], datatype="double", unit="deg"),
        column("DE_ICRS", [f"{v:.6f}" for v in icrs.dec.deg], datatype="double", unit="deg"),
    ],
)

emit(
    "36_system_priority_fk4.vot",
    "The same three pairs declared as FK4/B1950. Now the B1950 pair must win and the others must not be auto-selected.",
    "fk4",
    [
        column("RAB1950", [f"{v:.6f}" for v in fk4.ra.deg], datatype="double", unit="deg"),
        column("DEB1950", [f"{v:.6f}" for v in fk4.dec.deg], datatype="double", unit="deg"),
        column("RAJ2000", RA_STR, datatype="double", unit="deg"),
        column("DEJ2000", DEC_STR, datatype="double", unit="deg"),
        column("RA_ICRS", [f"{v:.6f}" for v in icrs.ra.deg], datatype="double", unit="deg"),
        column("DE_ICRS", [f"{v:.6f}" for v in icrs.dec.deg], datatype="double", unit="deg"),
    ],
)

# --------------------------------------------- group 4: other sky systems

emit(
    "40_galactic_decimal.vot",
    "Galactic coordinates in decimal degrees. Must land on the same sources as the baseline.",
    "galactic",
    [
        column("GLON", [f"{v:.6f}" for v in galactic.l.deg], datatype="double", unit="deg"),
        column("GLAT", [f"{v:.6f}" for v in galactic.b.deg], datatype="double", unit="deg"),
    ],
)

emit(
    "41_galactic_sexagesimal.vot",
    "Galactic coordinates as unitless sexagesimal strings. The longitude must be read as DEGREES, not hours: reading it as hours would move every source by a factor of fifteen.",
    "galactic",
    [
        column("GLON", dms(galactic.l.deg, sign=False)),
        column("GLAT", dms(galactic.b.deg)),
    ],
)

emit(
    "42_ecliptic_decimal.vot",
    "Ecliptic coordinates in decimal degrees.",
    "ecliptic",
    [
        column("ELON", [f"{v:.6f}" for v in ecliptic.lon.deg], datatype="double", unit="deg"),
        column("ELAT", [f"{v:.6f}" for v in ecliptic.lat.deg], datatype="double", unit="deg"),
    ],
)

emit(
    "43_ecliptic_sexagesimal.vot",
    "Ecliptic coordinates as sexagesimal strings with declared d:m:s units on both axes.",
    "ecliptic",
    [
        column("ELON", dms(ecliptic.lon.deg, sign=False), unit="d:m:s"),
        column("ELAT", dms(ecliptic.lat.deg), unit="d:m:s"),
    ],
)

emit(
    "44_ecliptic_fk4.vot",
    "Ecliptic coordinates on the B1950 ecliptic, declared the VOTable way as ecl_FK4. The system "
    "name alone implies B1950; reading it on the J2000 ecliptic moves every source by 0.69 degrees.",
    "ecliptic_fk4",
    [
        column("ELON", [f"{v:.6f}" for v in ecliptic_b1950.lon.deg], datatype="double", unit="deg"),
        column("ELAT", [f"{v:.6f}" for v in ecliptic_b1950.lat.deg], datatype="double", unit="deg"),
    ],
)

emit(
    "45_fk4_b1900.vot",
    "FK4 with a declared equinox of B1900, which is not the standard value for the system. The "
    "declared equinox has to be used; falling back to B1950 moves every source by about 0.69 degrees.",
    "fk4_b1900",
    [
        column("RAB1900", [f"{v:.6f}" for v in fk4_b1900.ra.deg], datatype="double", unit="deg"),
        column("DEB1900", [f"{v:.6f}" for v in fk4_b1900.dec.deg], datatype="double", unit="deg"),
    ],
)

# ------------------------------------------------------- group 5: pixel axes

PIXEL_X0 = [f"{v:.3f}" for v in pixel_x0]
PIXEL_Y0 = [f"{v:.3f}" for v in pixel_y0]
PIXEL_X1 = [f"{v + 1.0:.3f}" for v in pixel_x0]
PIXEL_Y1 = [f"{v + 1.0:.3f}" for v in pixel_y0]

emit(
    "50_pixel0_numeric.vot",
    "Zero-based pixel coordinates measured from the image the overlay is loaded onto.",
    "pixel0",
    [
        column("xcentroid", PIXEL_X0, datatype="double", unit="pix"),
        column("ycentroid", PIXEL_Y0, datatype="double", unit="pix"),
    ],
)

emit(
    "51_pixel0_string_nounits.vot",
    "The same zero-based pixel coordinates as unitless strings. Their format has to be sniffed from the values, and a pixel axis must not scale them the way a longitude would.",
    "pixel0",
    [column("xcentroid", PIXEL_X0), column("ycentroid", PIXEL_Y0)],
)

emit(
    "52_pixel1_numeric.vot",
    "One-based pixel coordinates under the PIX1 system, as SExtractor writes X_IMAGE / Y_IMAGE. Must land on the same sources as 50 despite the one-pixel offset.",
    "pixel1",
    [
        column("X_IMAGE", PIXEL_X1, datatype="double", unit="pix"),
        column("Y_IMAGE", PIXEL_Y1, datatype="double", unit="pix"),
    ],
)

emit(
    "53_pixel0_angular_decoy.vot",
    "Pixel columns alongside angular ones. The angular columns must stay selectable on the pixel axes, ranked below the pixel columns rather than hidden.",
    "pixel0",
    [
        column("radius_arcsec", [f"{v:.3f}" for v in np.linspace(0.5, 12.0, len(ra_deg))], datatype="double", unit="arcsec"),
        column("radius_arcmin", [f"{v:.5f}" for v in np.linspace(0.5, 12.0, len(ra_deg)) / 60.0], datatype="double", unit="arcmin"),
        column("xcentroid", PIXEL_X0, datatype="double", unit="pix"),
        column("ycentroid", PIXEL_Y0, datatype="double", unit="pix"),
    ],
)

# ------------------------------------------------- group 6: streamed columns
# Every other variant holds 20 rows, so a file-backed catalog loads them in one response and the
# format is settled from the first chunk. This one is long enough to arrive in several, and its
# coordinates are blank until well past the first few, so the format can only be established by a
# later response -- which is what makes the store re-read the rows it had already buffered.

# 60 blank rows is one full response plus a little: the store asks for 50 rows first and then in
# chunks of 50, so the format cannot be settled from the first response but is settled by the
# second. A longer blank run only means more scrolling before anything happens.
STREAM_BLANK_ROWS = 60
STREAM_TOTAL_ROWS = 1200
stream_lon = []
stream_lat = []
stream_name = []
for row in range(STREAM_TOTAL_ROWS):
    if row < STREAM_BLANK_ROWS:
        stream_lon.append("")
        stream_lat.append("")
        stream_name.append(f"blank_{row:04d}")
        continue
    source = ON_IMAGE[(row - STREAM_BLANK_ROWS) % len(ON_IMAGE)]
    stream_lon.append(RA_HMS[source])
    stream_lat.append(DEC_DMS[source])
    stream_name.append(f"src_{source + 1:02d}_row_{row:04d}")

written.append(("60_stream_late_string_format.vot", "Streamed unitless string coordinates"))
write_votable(
    "60_stream_late_string_format.vot",
    "Unitless sexagesimal strings whose first 60 rows are blank, so the column's format can only "
    "be settled by a later streamed response. Cycles through the sources that fall on the image.",
    "fk5",
    [
        column("RAJ2000", stream_lon),
        column("DEJ2000", stream_lat),
        column("Name", stream_name, ucd="meta.id;meta.main"),
        column("row_index", [str(row) for row in range(STREAM_TOTAL_ROWS)], datatype="double"),
    ],
)

print(f"wrote {len(written)} variants to {OUT_DIR}")
print(f"{len(ON_IMAGE)} of {len(ra_deg)} sources fall on the image; rows (one-based): {[r + 1 for r in ON_IMAGE]}")
print(f"out-of-range latitude rows: {[r + 1 for r in OUT_OF_RANGE_ROWS]}")
print(f"unparseable rows:           {[r + 1 for r in UNPARSEABLE_ROWS]}")
