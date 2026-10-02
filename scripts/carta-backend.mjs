import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);
dotenv.config({ path: path.join(projectRoot, 'setting.env') });

const cartaPort = Number.parseInt(process.env.CARTA_PORT ?? '3102', 10);
if (!Number.isInteger(cartaPort) || cartaPort < 1 || cartaPort > 65535) {
    throw new Error(`Invalid CARTA_PORT: ${process.env.CARTA_PORT}`);
}

const backendDirectory = process.env.backend_dir;
const frontendDirectory = process.env.frontend_dir;
const fixtureDirectory = path.join(projectRoot, 'test_data');
if (!backendDirectory || !frontendDirectory) {
    throw new Error(
        'Set backend_dir and frontend_dir in setting.env before starting CARTA',
    );
}

const cartaUrl = `http://localhost:${cartaPort}`;
const backendExecutable = path.join(backendDirectory, 'carta_backend');
const backendArguments = [
    fixtureDirectory,
    '--top_level_folder',
    process.env.CARTA_TOP_LEVEL_FOLDER ?? path.resolve(projectRoot, '../..'),
    '--frontend_folder',
    frontendDirectory,
    '--no_browser',
    '--port',
    String(cartaPort),
    '--debug_no_auth',
    '--omp_threads',
    '8',
];
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const cartaBackendServer = {
    command: [backendExecutable, ...backendArguments].map(quote).join(' '),
    url: `${cartaUrl}/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
};

export {
    backendArguments,
    backendExecutable,
    cartaBackendServer,
    cartaPort,
    cartaUrl,
};
