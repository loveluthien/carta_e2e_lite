import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Small synthetic stand-ins for the historical FITS images used by older tests.
// Keep spectral channel counts where possible, but use smaller spatial planes.
const images = [
    {
        name: 'Gaussian_array_wide.fits',
        width: 80,
        height: 80,
        channels: 128,
        ra: 150,
        dec: 0,
        frequency: 1.4204e9,
        frequencyStep: 1e5,
        restFrequency: 1.420405751786e9,
        pixelScale: 0.05,
        unit: 'Jy/pixel',
    },
    {
        name: 'HD163296_13CO_2-1_subimage.fits',
        width: 90,
        height: 90,
        channels: 110,
        ra: 269.0886722618,
        dec: -21.95621129269,
        frequency: 2.204008649187e11,
        frequencyStep: -2.441261094971e5,
        restFrequency: 2.2039868e11,
        pixelScale: 1.388888888889e-5,
        unit: 'Jy/beam',
        beamMajor: 1.99291192823e-4,
        beamMinor: 1.596954133775e-4,
    },
    {
        name: 'HD163296_C18O_2-1_subimage.fits',
        width: 90,
        height: 90,
        channels: 110,
        ra: 269.0886722618,
        dec: -21.95621129269,
        frequency: 2.195708361464e11,
        frequencyStep: -2.441261095581e5,
        restFrequency: 2.1956036e11,
        pixelScale: 1.388888888889e-5,
        unit: 'Jy/beam',
        beamMajor: 2.014802230729e-4,
        beamMinor: 1.602585448159e-4,
    },
    {
        name: 'M17_SWex.fits',
        width: 176,
        height: 176,
        channels: 25,
        ra: 275.0875,
        dec: -16.20277777779,
        frequency: 8.67513961884e10,
        frequencyStep: -2.442377011414e5,
        restFrequency: 8.675429e10,
        pixelScale: 1.111111111111e-4,
        unit: 'Jy/beam',
        beamMajor: 5.725136068132e-4,
        beamMinor: 4.142385721207e-4,
    },
    {
        name: 'IRCp10216_sci.spw0.cube.I.manual.pbcor.fits',
        width: 40,
        height: 40,
        channels: 480,
        ra: 146.9895377994,
        dec: 13.27891127641,
        frequency: 3.440912937187e11,
        frequencyStep: 3.906722973755e6,
        restFrequency: 3.45e11,
        pixelScale: 5e-5,
        unit: 'Jy/beam',
    },
    ...[
        ['m16_f0444w.fits', 0.8],
        ['m16_f0770w.fits', 1],
        ['m16_f1130w.fits', 1.2],
        ['m16_f1500w.fits', 1.4],
    ].map(([name, brightness]) => ({
        name,
        width: 256,
        height: 256,
        channels: 1,
        brightness,
        ra: 274.7262,
        dec: -13.8432,
        pixelScale: 3.080735e-5,
        unit: 'MJy/sr',
        projection: 'TAN',
    })),
];

function card(key, value) {
    const encoded =
        typeof value === 'string'
            ? `'${value.padEnd(8)}'`.padEnd(20)
            : typeof value === 'boolean'
              ? value
                  ? 'T'
                  : 'F'
              : Number.isInteger(value) && !/^(BITPIX|NAXIS)/.test(key)
                ? `${value}.0`
                : String(value);
    return `${key.padEnd(8)}= ${typeof value === 'string' ? encoded : encoded.padStart(20)}`.padEnd(
        80,
    );
}

function write(image) {
    const { width, height, channels } = image;
    const cube = channels > 1;
    const values = {
        SIMPLE: true,
        BITPIX: 16,
        NAXIS: cube ? 3 : 2,
        NAXIS1: width,
        NAXIS2: height,
        ...(cube ? { NAXIS3: channels } : {}),
        BSCALE: 0.0001,
        BUNIT: image.unit,
        CTYPE1: `RA---${image.projection ?? 'SIN'}`,
        CTYPE2: `DEC--${image.projection ?? 'SIN'}`,
        CRPIX1: (width + 1) / 2,
        CRPIX2: (height + 1) / 2,
        CRVAL1: image.ra,
        CRVAL2: image.dec,
        CDELT1: -image.pixelScale,
        CDELT2: image.pixelScale,
        CUNIT1: 'deg',
        CUNIT2: 'deg',
        ...(cube
            ? {
                  CTYPE3: 'FREQ',
                  CUNIT3: 'Hz',
                  CRPIX3: 1,
                  CRVAL3: image.frequency,
                  CDELT3: image.frequencyStep,
                  RESTFRQ: image.restFrequency,
                  SPECSYS: 'LSRK',
              }
            : {}),
        ...(image.beamMajor
            ? {
                  BMAJ: image.beamMajor,
                  BMIN: image.beamMinor,
                  BPA: 72,
              }
            : {}),
    };
    const cards = Object.entries(values).map(([key, value]) =>
        card(key, value),
    );
    cards.push('END'.padEnd(80));
    const header = Buffer.from(
        cards.join('').padEnd(Math.ceil((cards.length * 80) / 2880) * 2880),
    );
    const pixels = Buffer.alloc(
        Math.ceil((width * height * channels * 2) / 2880) * 2880,
    );
    for (let z = 0; z < channels; z++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = (x - width / 2) / (width / 5);
                const dy = (y - height / 2) / (height / 5);
                const source = Math.exp(-(dx * dx + dy * dy) / 2);
                const line = cube
                    ? Math.exp(-(((z - channels / 2) / (channels / 7)) ** 2))
                    : 1;
                const ripple = Math.sin(x / 7) * Math.cos(y / 9) * 0.03;
                const intensity =
                    (image.brightness ?? 1) * (source * (0.25 + line) + ripple);
                pixels.writeInt16BE(
                    Math.round(intensity * 10_000),
                    2 * ((z * height + y) * width + x),
                );
            }
        }
    }
    const output = Buffer.concat([header, pixels]);
    if (output.length > 2_000_000)
        throw new Error(`${image.name} exceeds 2 MB`);
    writeFileSync(fileURLToPath(new URL(image.name, import.meta.url)), output);
    console.log(`${image.name}: ${output.length} bytes`);
}

images.forEach(write);
