import { readFileSync, writeFileSync } from 'node:fs';

// Reuse the small five-channel cube's pixels; only unit/WCS/beam metadata differs.
const source = readFileSync(new URL('cube.fits', import.meta.url));
const cards = [];
for (let offset = 0; ; offset += 80) {
    const card = source.toString('ascii', offset, offset + 80);
    if (card.slice(0, 8).trim() === 'END') break;
    cards.push(card);
}
const dataOffset = Math.ceil(((cards.length + 1) * 80) / 2880) * 2880;
const card = (key, value) =>
    `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value.padEnd(8)}'`.padEnd(20) : value.toExponential(12).toUpperCase().padStart(20)}`.padEnd(
        80,
    );
for (const [name, unit, pixels] of [
    ['flux-k.fits', 'K', true],
    ['flux-pixel.fits', 'Jy/pixel', true],
    ['flux-beam.fits', 'Jy/beam', true],
    ['flux-no-pixels.fits', 'Jy/beam', false],
]) {
    const replaced = new Set([
        'BUNIT',
        'CDELT1',
        'CDELT2',
        'BMAJ',
        'BMIN',
        'BPA',
    ]);
    if (!pixels) for (const key of ['CRPIX1', 'CRPIX2']) replaced.add(key);
    const header = cards.filter(
        (value) => !replaced.has(value.slice(0, 8).trim()),
    );
    header.push(
        card('BUNIT', unit),
        card('BMAJ', 0.003),
        card('BMIN', 0.002),
        card('BPA', 0),
    );
    header.push(card('CDELT1', -0.001), card('CDELT2', 0.002));
    header.push('END'.padEnd(80));
    writeFileSync(
        new URL(name, import.meta.url),
        Buffer.concat([
            Buffer.from(
                header
                    .join('')
                    .padEnd(Math.ceil((header.length * 80) / 2880) * 2880),
            ),
            source.subarray(dataOffset),
        ]),
    );
}
