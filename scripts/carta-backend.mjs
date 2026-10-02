export const cartaPort = Number.parseInt(process.env.CARTA_PORT ?? '3102', 10);
if (!Number.isInteger(cartaPort) || cartaPort < 1 || cartaPort > 65535) {
    throw new Error(`Invalid CARTA_PORT: ${process.env.CARTA_PORT}`);
}

export const cartaUrl = `http://localhost:${cartaPort}`;
export const backendExecutable =
    '/Users/kchou/bz/carta_build/carta-backend-dev1/build/carta_backend';

export const backendArguments = [
    '/Users/kchou/bz/carta_build/e2e-lite/test_data',
    '--top_level_folder',
    '/Users/kchou/bz',
    '--frontend_folder',
    '/Users/kchou/bz/carta_build/carta-frontend-dev2/build',
    '--no_browser',
    '--port',
    String(cartaPort),
    '--debug_no_auth',
    '--omp_threads',
    '8',
];

const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export const cartaBackendServer = {
    command: [backendExecutable, ...backendArguments].map(quote).join(' '),
    url: `${cartaUrl}/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
};
