import { readFileSync, writeFileSync } from 'node:fs';

// Reuse the tiny numeric fixtures; only FITS header cards vary between each pair.
for (const kind of ['cube', 'yx', 'swapped', 'pv']) {
    const source = readFileSync(
        new URL(
            kind === 'swapped' ? 'incompatible-spectral.fits' : 'cube.fits',
            import.meta.url,
        ),
    );
    const cards = [];
    let offset = 0;
    while (source.toString('ascii', offset, offset + 8).trim() !== 'END') {
        cards.push(source.toString('ascii', offset, offset + 80));
        offset += 80;
    }
    const replace = (key, value) => {
        const index = cards.findIndex(
            (card) => card.slice(0, 8).trim() === key,
        );
        cards[index] = (
            key.padEnd(8) +
            '= ' +
            (typeof value === 'string'
                ? `'${value}'`.padEnd(20)
                : String(value).padStart(20))
        ).padEnd(80);
    };
    if (kind === 'yx') {
        for (const key of ['CTYPE', 'CUNIT', 'CRPIX', 'CRVAL', 'CDELT']) {
            const x = cards.findIndex((card) =>
                card.startsWith(`${key}1`.padEnd(8)),
            );
            const y = cards.findIndex((card) =>
                card.startsWith(`${key}2`.padEnd(8)),
            );
            const value = cards[x].slice(8);
            cards[x] = `${key}1`.padEnd(8) + cards[y].slice(8);
            cards[y] = `${key}2`.padEnd(8) + value;
        }
    }
    if (kind === 'pv') {
        replace('NAXIS', 2);
        replace('CTYPE1', 'OFFSET');
        replace('CUNIT1', 'arcsec');
        replace('CRVAL1', 0);
        replace('CDELT1', 1);
        replace('CTYPE2', 'FREQ');
        replace('CUNIT2', 'Hz');
        replace('CRPIX2', 1);
        replace('CRVAL2', 1e9);
        replace('CDELT2', -1e6);
    }
    const filtered = cards.filter(
        (card) =>
            kind !== 'pv' ||
            !/^(NAXIS|CTYPE|CUNIT|CRPIX|CRVAL|CDELT)3\s/.test(card),
    );
    const start = Math.ceil((offset + 80) / 2880) * 2880;
    const data =
        kind === 'pv'
            ? source.subarray(start, start + 2880)
            : source.subarray(start);
    for (const blank of [false, true]) {
        const extra = blank
            ? [
                  '        =                   42 / PR3027 blank-keyword'.padEnd(
                      80,
                  ),
              ]
            : [];
        const header = [...filtered, ...extra, 'END'.padEnd(80)].join('');
        writeFileSync(
            new URL(
                `wcs-${kind}-${blank ? 'blank' : 'clean'}.fits`,
                import.meta.url,
            ),
            Buffer.concat([
                Buffer.from(
                    header.padEnd(Math.ceil(header.length / 2880) * 2880),
                ),
                data,
            ]),
        );
    }
}
