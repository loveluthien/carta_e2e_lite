import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// FITS primary image: 16x16, five channels at radio velocities 0,1,2,3,4 km/s.
// No astronomy dependency is needed to encode this small, uncompressed fixture.
function write(
    name,
    channels = 5,
    stokes = 1,
    metadata = true,
    scale = 1,
    swappedAxes = false,
    spatialShift = 0,
    spectralShift = 0,
) {
    const values = {
        SIMPLE: true,
        BITPIX: -32,
        NAXIS: stokes > 1 ? 4 : 3,
        NAXIS1: 16,
        NAXIS2: 16,
        NAXIS3: channels,
        ...(stokes > 1
            ? {
                  NAXIS4: stokes,
                  CTYPE4: 'STOKES',
                  CRPIX4: 1,
                  CRVAL4: 1,
                  CDELT4: 1,
              }
            : {}),
        CTYPE1: 'RA---SIN',
        CTYPE2: 'DEC--SIN',
        CRPIX1: 8,
        CRPIX2: 8,
        CRVAL1: 180 + spatialShift * 0.001,
        CRVAL2: -30,
        CDELT1: -0.001,
        CDELT2: 0.001,
        CUNIT1: 'deg',
        CUNIT2: 'deg',
        CTYPE3: 'FREQ',
        CUNIT3: 'Hz',
        CRPIX3: 1,
        CRVAL3: 1e9 - (spectralShift * 1e9) / 299792.458,
        CDELT3: -1e9 / 299792.458,
        BUNIT: 'K',
        ...(metadata ? { RESTFRQ: 1e9, SPECSYS: 'LSRK' } : {}),
        ...(swappedAxes
            ? {
                  NAXIS1: channels,
                  NAXIS2: 16,
                  NAXIS3: 16,
                  CTYPE1: 'FREQ',
                  CUNIT1: 'Hz',
                  CRPIX1: 1,
                  CRVAL1: 1e9,
                  CDELT1: -1e9 / 299792.458,
                  CTYPE2: 'RA---SIN',
                  CUNIT2: 'deg',
                  CRPIX2: 8,
                  CRVAL2: 180,
                  CDELT2: -0.001,
                  CTYPE3: 'DEC--SIN',
                  CUNIT3: 'deg',
                  CRPIX3: 8,
                  CRVAL3: -30,
                  CDELT3: 0.001,
              }
            : {}),
    };
    const cards = Object.entries(values).map(([k, v]) =>
        (
            k.padEnd(8) +
            '= ' +
            (typeof v === 'string'
                ? `'${v.padEnd(8)}'`.padEnd(20)
                : (v === true
                      ? 'T'
                      : Number.isInteger(v) && !/^(BITPIX|NAXIS)/.test(k)
                        ? `${v}.0`
                        : String(v)
                  ).padStart(20))
        ).padEnd(80),
    );
    cards.push('END'.padEnd(80));
    const header = Buffer.from(
        cards.join('').padEnd(Math.ceil((cards.length * 80) / 2880) * 2880),
    );
    const data = Buffer.alloc(
        Math.ceil((16 * 16 * channels * stokes * 4) / 2880) * 2880,
    );
    for (let s = 0; s < stokes; s++)
        for (let z = 0; z < channels; z++)
            for (let y = 0; y < 16; y++)
                for (let x = 0; x < 16; x++) {
                    const spectrum =
                        x === 2 ? [-2, -1, 0, 1, 2] : [1, 2, 4, 8, 16];
                    const value =
                        x === 1 && y === 1
                            ? NaN
                            : scale * spectrum[z % 5] * (1 + y / 16) * (s + 1);
                    data.writeFloatBE(
                        value,
                        4 * (((s * channels + z) * 16 + y) * 16 + x),
                    );
                }
    writeFileSync(
        fileURLToPath(new URL(name, import.meta.url)),
        Buffer.concat([header, data]),
    );
}
write('cube.fits');
// Shift both WCS axes while retaining overlapping sky and velocity coverage.
write('matching-cube.fits', 5, 1, true, 2, false, 2, 2);
write('single.fits', 1);
write('no-rest.fits', 5, 1, false);
write('incompatible-spectral.fits', 5, 1, true, 1, true);
write('iquv.fits', 5, 4);
write('stokes.I.fits');
write('stokes.Q.fits', 5, 1, true, 2);
write('stokes.U.fits', 5, 1, true, 3);
write('stokes.V.fits', 5, 1, true, 4);
