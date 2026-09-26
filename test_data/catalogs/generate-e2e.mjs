import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Run with: node test_data/catalogs/generate-e2e.mjs
const output = (name) => fileURLToPath(new URL(name, import.meta.url));
const card = (key, value) =>
    (
        key.padEnd(8) +
        '= ' +
        (typeof value === 'string'
            ? `'${value}'`.padEnd(20)
            : String(
                  value === true
                      ? 'T'
                      : Number.isInteger(value) && !/^(BITPIX|NAXIS)/.test(key)
                        ? `${value}.0`
                        : value,
              ).padStart(20))
    ).padEnd(80);

// Four planes keep the image useful for spectral and spatial profiler checks.
const header = {
    SIMPLE: true,
    BITPIX: -32,
    NAXIS: 3,
    NAXIS1: 16,
    NAXIS2: 16,
    NAXIS3: 4,
    CTYPE1: 'RA---SIN',
    CTYPE2: 'DEC--SIN',
    CRPIX1: 8,
    CRPIX2: 8,
    CRVAL1: 180,
    CRVAL2: -30,
    CDELT1: -0.001,
    CDELT2: 0.001,
    CUNIT1: 'deg',
    CUNIT2: 'deg',
    CTYPE3: 'FREQ',
    CUNIT3: 'Hz',
    CRPIX3: 1,
    CRVAL3: 1e9,
    CDELT3: 1e6,
    RESTFRQ: 1e9,
    BUNIT: 'K',
};
const pixels = Buffer.alloc(2 * 2880);
for (let z = 0; z < 4; z++)
    for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++)
            pixels.writeFloatBE(
                (x + y + 1) * (z + 1),
                4 * (z * 256 + y * 16 + x),
            );
for (const [name, ra] of [
    ['catalog-image.fits', 180],
    ['catalog-image-shifted.fits', 181],
]) {
    const cards = Object.entries({ ...header, CRVAL1: ra }).map(
        ([key, value]) => card(key, value),
    );
    cards.push('END'.padEnd(80));
    const fitsHeader = Buffer.from(
        cards.join('').padEnd(Math.ceil(cards.length / 36) * 2880),
    );
    writeFileSync(output(name), Buffer.concat([fitsHeader, pixels]));
}

const sources = [
    ['Alpha', 3, 4, 10, 4],
    ['Beta', 8, 7, 20, 6],
    ['Gamma', 12, 11, 30, 8],
    ['Delta', 5, 13, 40, 10],
    ['Outside', 30, 30, 50, 12],
];
const xml = (value) =>
    String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const vot = (system, fields, rows) => `<?xml version="1.0" encoding="UTF-8"?>
<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">
 <RESOURCE type="results"><COOSYS ID="coords" system="${system}"/>
  <TABLE name="e2e">
${fields.map(([name, datatype, unit]) => `   <FIELD name="${name}" datatype="${datatype}"${datatype === 'char' ? ' arraysize="*"' : ''}${unit ? ` unit="${unit}"` : ''} ref="coords"/>`).join('\n')}
   <DATA><TABLEDATA>
${rows.map((row) => `    <TR>${row.map((value) => `<TD>${xml(value)}</TD>`).join('')}</TR>`).join('\n')}
   </TABLEDATA></DATA>
  </TABLE>
 </RESOURCE>
</VOTABLE>
`;
const numeric = [
    ['Name', 'char'],
    ['RAJ2000', 'double', 'deg'],
    ['DEJ2000', 'double', 'deg'],
    ['Flux', 'double', 'Jy'],
    ['Size', 'double', 'pix'],
];
const skyRows = sources.map(([name, x, y, flux, size]) => [
    name,
    (180 - (x - 7) * 0.001).toFixed(6),
    (-30 + (y - 7) * 0.001).toFixed(6),
    flux,
    size,
]);
writeFileSync(output('catalog-sky.vot'), vot('eq_FK5', numeric, skyRows));
writeFileSync(
    output('catalog-pixel.vot'),
    vot(
        'PIX0',
        [
            ['Name', 'char'],
            ['xcentroid', 'double', 'pix'],
            ['ycentroid', 'double', 'pix'],
            ...numeric.slice(3),
        ],
        sources.map(([name, x, y, flux, size]) => [name, x, y, flux, size]),
    ),
);
writeFileSync(
    output('catalog-invalid.vot'),
    vot(
        'eq_FK5',
        numeric,
        skyRows.map((row, index) =>
            index === 2 ? [row[0], row[1], 95, row[3], row[4]] : row,
        ),
    ),
);
