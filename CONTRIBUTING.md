## Release process

### Branches

The primary working branch for this repo is the `main` branch. This branch tracks the in-development branch of core. The patch branches are named `252-patch` and such. The patch branches track the production branches of core. A new patch branch is created at Code Line Cut Over(CLCO).

Any bug fixes targeted for production should be first committed to the `main` branch and then backported to the appropriate patch branch.

### Versioning

This repo has been setup to release using githooks. Any PR merged to `main` branch will be immediately released and tagged as `next`. For the patch branches, the tag is either `latest` or `prerelease` based on the configuration in the [onRelease](.github/workflows/onRelease.yml) github hook. The `latest` tag is used for the patch branch tracking the production branches of core.

The Salesforce release is deployed in a staggered manner. There is a phase where the upcoming production release is available on Sandboxes as a preview to customers. Such customers can use the `prerelease` version of the plugin. At CLCO, the new patch branch will be set to release with `prerelease` tag. After R2b release, the `prerelease` version will be promoted to be the `latest` by modifying the [onRelease](.github/workflows/onRelease.yml) github hook.

### Example Flow

See release calendar in GUS for exact dates.

CLCO (Feature Freeze)

- Merge any outstanding PRs to main
- Create a new \*-patch branch based on main once CI has published to NPM.
- Create a [main branch pull request](https://github.com/salesforcecli/plugin-lightning-dev/commit/76493c627818e070283a157f3ffc4dd598e6ecec). Ensure this step completes successfully and has released a new major version of the plugin to NPM.
- If the release to NPM doesn't happen, you can manually [run a release](https://github.com/salesforcecli/plugin-lightning-dev/actions/workflows/create-github-release.yml) via Github actions or by submitting a [release PR](https://github.com/salesforcecli/plugin-lightning-dev/pull/299).
- Create a [patch branch pull request](https://github.com/salesforcecli/plugin-lightning-dev/commit/ef98bd9c407a7d9817850559e5b82a4fec92fb90) on the \*-patch branch to release the pre-release version of the plugin. Ensure this step completes successfully and has released a newly tagged "prerelease" version of the plugin to NPM.

R2b Release

- Create a [patch branch pull request](https://github.com/salesforcecli/plugin-lightning-dev/commit/150bcfa3036018ea49ab73da10d1b470cab0ad43).
- Ensure this step completes successfully and has released a newly tagged "latest" version of the plugin to NPM.
