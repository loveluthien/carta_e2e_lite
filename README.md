# CARTA End-to-End Tests

Playwright end-to-end tests for CARTA widgets and dialogs. Test fixtures are in `test_data/`.

## Setup

Install dependencies and configure the local CARTA builds:

```sh
npm run setup
```

The setup command asks for the backend build directory (containing `carta_backend`) and the frontend build directory. It writes those paths to the ignored `setting.env`, installs npm dependencies, and installs the Chromium browser.

## Run tests

Run all tests:

```sh
npm test
```

The runner starts or reuses one CARTA backend and runs five test groups in sequence, with up to six workers per group. To run one group, for example:

```sh
npm test -- --project=test-group5
```

Each group has a report under `playwright-report/`. The runner also merges the reports into `playwright-report/combined/`; open it with:

```sh
npm run report
```

See [`test-plans/README.md`](test-plans/README.md) for test coverage and detailed test plans.
