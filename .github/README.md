# CI Info

[Github Workflows Readme](https://github.com/salesforcecli/github-workflows)

## Releasing a new version

[Release Workflow](https://github.com/salesforcecli/plugin-lightning-dev/actions/workflows/create-github-release.yml)

## Node Version Configuration

This repository provides flexibility to manage Node.js versions in CI workflows using repository variables.
These variables can be configured at the repository level via the [Actions settings page](https://github.com/salesforcecli/plugin-lightning-dev/settings/variables/actions).
These can also be supplied as arguments to individual workflows directly.

### `UT_DISABLE_NODE_CURRENT`

- Disables the latest Node.js version in GitHub Actions workflows.

### `UT_DISABLE_NODE_PREVIOUS`

- Disables the previous Node.js version in GitHub Actions workflows.

### `NODE_VERSION_OVERRIDE`

- Overrides the full set of Node.js versions used for testing and publishing.
- **Default:** `'lts/*'` and `'lts/-1'`.
