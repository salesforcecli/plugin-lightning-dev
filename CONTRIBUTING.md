## Release process

### Branches

The primary working branch for this repo is the `main` branch. This branch branch tracks the in-development branch of core. The patch branches are named `252-patch` and such. The patch branches track the production branches of core. A new patch branch is created at Code Line Cut Over(CLCO).

Any bug fixes targeted for production should be first committed to the `main` branch and then backported to the appropriate patch branch.

### Versioning

This repo has been setup to release using githooks. Any PR merged to `main` branch will be immediately released and tagged as `next`. For the patch branches, the tag is either `latest` or `prereelase` based on the configuration in the [onRelease](.github/workflows/onRelease.yml) github hook. The `latest` tag is used for the patch branch tracking the production branches of core.

The Salesforce release is deployed in a staggered manner. There is a phase where the upcoming production release is available on Sandboxes as a preview to customers. Such customers can use the `prerelease` version of the plugin. At CLCO, the new patch branch will be set to release with `prerelease` tag. After R2b release, the `prerelease` version will be promoted to be the `latest` by modifying the [onRelease](.github/workflows/onRelease.yml) github hook.
