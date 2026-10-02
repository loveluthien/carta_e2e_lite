import { spawnSync } from 'node:child_process';
import { access, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import dotenv from 'dotenv';

const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);
const settingsPath = path.join(projectRoot, 'setting.env');
let currentSettings = {};
try {
    currentSettings = dotenv.parse(await readFile(settingsPath));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

const prompt = createInterface({ input: stdin, output: stdout });
async function askDirectory(label, currentValue, fallback) {
    const defaultValue = currentValue || fallback;
    while (true) {
        const answer = await prompt.question(
            `${label}${defaultValue ? ` [${defaultValue}]` : ''}: `,
        );
        if (!answer.trim() && !defaultValue) {
            console.error('Please enter a directory.');
            continue;
        }
        const directory = path.resolve(
            projectRoot,
            answer.trim() || defaultValue,
        );
        try {
            if (!(await stat(directory)).isDirectory()) {
                throw new Error('not a directory');
            }
            return directory;
        } catch {
            console.error(`Directory not found: ${directory}`);
        }
    }
}

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed`);
    }
}

try {
    const backendDirectory = await askDirectory(
        'Backend build directory (contains carta_backend)',
        currentSettings.backend_dir,
        '',
    );
    try {
        await access(path.join(backendDirectory, 'carta_backend'));
    } catch {
        throw new Error(
            `Backend executable not found: ${path.join(backendDirectory, 'carta_backend')}`,
        );
    }
    const frontendDirectory = await askDirectory(
        'Frontend build directory',
        currentSettings.frontend_dir,
        '',
    );

    await writeFile(
        settingsPath,
        [
            `backend_dir=${JSON.stringify(backendDirectory)}`,
            `frontend_dir=${JSON.stringify(frontendDirectory)}`,
            '',
        ].join('\n'),
    );
    console.log(`Wrote CARTA paths to ${settingsPath}`);

    run('npm', ['ci']);
    run('npx', ['playwright', 'install', 'chromium']);
    console.log('Environment setup complete.');
} finally {
    prompt.close();
}
