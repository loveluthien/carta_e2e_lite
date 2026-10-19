# CARTA End-to-End Tests

Playwright end-to-end tests for CARTA widgets and dialogs. Test fixtures are in `test_data/`.

## Setup

Install dependencies and configure the local CARTA builds:

```sh
npm run setup
```

The setup command asks for the backend build directory (containing `carta_backend`), frontend build directory and Playwright worker count. It writes those settings to the ignored `setting.env`, installs npm dependencies, and installs the Chromium browser.

The CARTA file browser uses the directory two levels above this checkout as its top-level folder by default. Set `CARTA_TOP_LEVEL_FOLDER` to use a different data root.

## Run tests

Run all tests:

```sh
npm test
```

The runner starts or reuses one CARTA backend and runs five test groups in sequence. Set `workers=6` in `setting.env` to control concurrency per group (defaults to 6). A command-line `--workers` overrides this setting. To run one group, for example:

```sh
npm test -- --project=test-group5
```

Each group has a report under `playwright-report/`. The runner also merges the reports into `playwright-report/combined/`; open it with:

```sh
npm run report
```

See [`test-plans/README.md`](test-plans/README.md) for test coverage and detailed test plans.
