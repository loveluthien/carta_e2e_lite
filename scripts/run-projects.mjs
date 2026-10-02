import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    backendArguments,
    backendExecutable,
    cartaUrl,
} from './carta-backend.mjs';
import { defaultWorkers, projectNames } from './test-projects.mjs';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);
const playwrightCli = require.resolve('@playwright/test/cli');
const inputArgs = process.argv.slice(2);
const blobDirectory = path.join(projectRoot, 'blob-report');

function runOnce(args) {
    const result = spawnSync(
        process.execPath,
        [playwrightCli, 'test', ...args],
        {
            cwd: projectRoot,
            stdio: 'inherit',
        },
    );
    process.exit(result.status ?? 1);
}

if (
    inputArgs.some((arg) =>
        ['--list', '--help', '-h', '--version'].includes(arg),
    )
) {
    runOnce(inputArgs);
}

const selectedProjects = [];
const playwrightArgs = [];
let workers;
for (let index = 0; index < inputArgs.length; index += 1) {
    const arg = inputArgs[index];
    if (arg === '--project') {
        selectedProjects.push(inputArgs[++index] ?? '');
    } else if (arg.startsWith('--project=')) {
        selectedProjects.push(arg.slice('--project='.length));
    } else if (arg === '--workers') {
        workers = inputArgs[++index];
        if (!workers || workers.startsWith('-')) {
            throw new Error('--workers requires a worker count');
        }
    } else if (arg.startsWith('--workers=')) {
        workers = arg.slice('--workers='.length);
    } else {
        playwrightArgs.push(arg);
    }
}

const projects = selectedProjects.length
    ? [...new Set(selectedProjects)]
    : projectNames;
for (const project of projects) {
    if (!projectNames.includes(project)) {
        throw new Error(
            `Unknown project ${project}. Choose one of: ${projectNames.join(', ')}`,
        );
    }
}

function countSelectedTests(project) {
    const result = spawnSync(
        process.execPath,
        [
            playwrightCli,
            'test',
            ...playwrightArgs,
            '--list',
            '--project',
            project,
            '--pass-with-no-tests',
        ],
        { cwd: projectRoot, encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
        process.stderr.write(result.stderr);
        throw new Error(`Could not collect tests for ${project}`);
    }
    const total = `${result.stdout}\n${result.stderr}`.match(
        /^Total:\s+(\d+) tests?\b/m,
    );
    if (!total)
        throw new Error(`Could not read collected test count for ${project}`);
    return Number(total[1]);
}

const selectedTestCounts = new Map(
    projects.map((project) => [project, countSelectedTests(project)]),
);
const runnableProjects = projects.filter(
    (project) => selectedTestCounts.get(project) > 0,
);
if (!runnableProjects.length) {
    throw new Error('No tests matched the selected projects and filters');
}

const delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
async function backendIsReady() {
    try {
        const response = await fetch(cartaUrl, {
            signal: AbortSignal.timeout(1000),
        });
        return response.status < 500;
    } catch {
        return false;
    }
}

let backendProcess;
let activeTestProcess;
let ownsBackend = false;
let receivedSignal;

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        receivedSignal = signal;
        activeTestProcess?.kill(signal);
        backendProcess?.kill(signal);
    });
}

async function startBackendIfNeeded() {
    if (await backendIsReady()) {
        console.log(`[projects] Reusing CARTA backend at ${cartaUrl}`);
        return;
    }

    backendProcess = spawn(backendExecutable, backendArguments, {
        cwd: projectRoot,
        env: process.env,
        stdio: 'inherit',
    });
    ownsBackend = true;
    let spawnError;
    backendProcess.once('error', (error) => {
        spawnError = error;
    });

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        if (spawnError) {
            throw new Error('Failed to start CARTA backend', {
                cause: spawnError,
            });
        }
        if (backendProcess.exitCode !== null) {
            throw new Error(
                `CARTA backend exited with code ${backendProcess.exitCode}`,
            );
        }
        if (await backendIsReady()) return;
        await delay(500);
    }
    throw new Error(`CARTA backend did not start at ${cartaUrl} within 90s`);
}

async function stopBackend() {
    if (!ownsBackend || !backendProcess || backendProcess.exitCode !== null)
        return;
    const closed = new Promise((resolve) =>
        backendProcess.once('close', resolve),
    );
    backendProcess.kill('SIGTERM');
    await Promise.race([closed, delay(5000)]);
    if (backendProcess.exitCode === null) backendProcess.kill('SIGKILL');
}

async function runTests(name, selectionArgs, workerCount) {
    const reportDirectory = path.join('playwright-report', name);
    const blobFile = path.join(blobDirectory, `${name}.zip`);
    const commandArgs = [
        playwrightCli,
        'test',
        ...playwrightArgs,
        '--reporter=html,blob',
        ...selectionArgs,
        '--no-deps',
        '--workers',
        workerCount,
    ];
    console.log(`\n[projects] Running ${name}; report: ${reportDirectory}`);

    const child = spawn(process.execPath, commandArgs, {
        cwd: projectRoot,
        env: {
            ...process.env,
            CARTA_EXTERNAL_BACKEND: '1',
            PLAYWRIGHT_BLOB_OUTPUT_FILE: blobFile,
            PLAYWRIGHT_HTML_OPEN: 'never',
            PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(projectRoot, reportDirectory),
            PWTEST_BLOB_DO_NOT_REMOVE: '1',
        },
        stdio: 'inherit',
    });
    activeTestProcess = child;

    const code = await new Promise((resolve) => {
        child.once('error', (error) => {
            console.error(`[projects] Failed to launch ${name}:`, error);
            resolve(1);
        });
        child.once('close', (exitCode) => resolve(exitCode ?? 1));
    });
    activeTestProcess = undefined;
    return { name, code };
}

function mergeReports() {
    const reportDirectory = path.join(
        projectRoot,
        'playwright-report',
        'combined',
    );
    console.log(`\n[projects] Merging reports into playwright-report/combined`);
    rmSync(reportDirectory, { recursive: true, force: true });
    const result = spawnSync(
        process.execPath,
        [playwrightCli, 'merge-reports', '--reporter=html', blobDirectory],
        {
            cwd: projectRoot,
            env: {
                ...process.env,
                PLAYWRIGHT_HTML_OPEN: 'never',
                PLAYWRIGHT_HTML_OUTPUT_DIR: reportDirectory,
            },
            stdio: 'inherit',
        },
    );
    if (
        result.status === 0 &&
        existsSync(path.join(reportDirectory, 'index.html'))
    ) {
        console.log('[projects] Open the combined report: npm run report');
        return 0;
    }
    console.error('[projects] Failed to create the combined report');
    return 1;
}

let results = [];
try {
    await rm(blobDirectory, { recursive: true, force: true });
    await mkdir(blobDirectory, { recursive: true });
    await startBackendIfNeeded();
    for (const project of projects) {
        if (receivedSignal) break;
        if (selectedTestCounts.get(project) === 0) {
            console.log(`[projects] Skipping ${project}; no tests matched`);
            continue;
        }
        results.push(
            await runTests(
                project,
                ['--project', project],
                workers ?? String(defaultWorkers),
            ),
        );
    }
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    await stopBackend();
}

if (results.length === runnableProjects.length && !receivedSignal) {
    if (mergeReports() !== 0) process.exitCode = 1;
}

if (receivedSignal) {
    process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143;
} else if (results.some(({ code }) => code !== 0)) {
    process.exitCode = 1;
}

if (results.length) {
    console.log('\nProject test summary:');
    for (const { name, code } of results) {
        console.log(`${code === 0 ? 'PASS' : 'FAIL'} ${name}`);
    }
}
