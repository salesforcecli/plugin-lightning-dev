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
- Create a [main branch pull request](https://github.com/salesforcecli/plugin-lightning-dev/commit/76493c627818e070283a157f3ffc4dd598e6ecec). NOTE: [PR details](https://github.com/salesforcecli/plugin-lightning-dev/pull/299) must have "BREAKING CHANGE" in the description. Once merged and CI is complete, ensure a new major version (i.e. 3.x.x -> 4.0.0) of the plugin has been published to NPM with the "next" tag.
- If the release to NPM doesn't happen, you can manually [run a release](https://github.com/salesforcecli/plugin-lightning-dev/actions/workflows/create-github-release.yml) via Github actions or by submitting a [release PR](https://github.com/salesforcecli/plugin-lightning-dev/pull/299).
- Create a [patch branch pull request](https://github.com/salesforcecli/plugin-lightning-dev/commit/ef98bd9c407a7d9817850559e5b82a4fec92fb90) on the \*-patch branch to release the pre-release version of the plugin. Ensure this step completes successfully and has released a newly tagged "prerelease" version of the plugin to NPM.

R2b Release

- Create a [patch branch pull request](https://github.com/salesforcecli/plugin-lightning-dev/commit/150bcfa3036018ea49ab73da10d1b470cab0ad43).
- Ensure this step completes successfully and has released a newly tagged "latest" version of the plugin to NPM.

### Branch / Release / API Version Reference

| Core Branch | Release Name | API Version | Plugin Version |
| ----------- | ------------ | ----------- | -------------- |
| 252-patch   | winter25     | 62          | 1              |
| 254-patch   | spring25     | 63          | 2              |
| 256-patch   | summer25     | 64          | 3              |
| 258-patch   | winter26     | 65          | 4              |
| 260-patch   | spring26     | 66          | 5              |
| 262-patch   | summer26     | 67          | 6              |
| 264-patch   | winter27     | 68          | 7              |
| 266-patch   | spring27     | 69          | 8              |
| 268-patch   | summer27     | 70          | 9              |
| 270-patch   | winter28     | 71          | 10             |
| 272-patch   | spring28     | 72          | 11             |
| 274-patch   | summer28     | 73          | 12             |
| 276-patch   | winter29     | 74          | 13             |
| 278-patch   | spring29     | 75          | 14             |
| 280-patch   | summer29     | 76          | 15             |
| 282-patch   | winter30     | 77          | 16             |
| 284-patch   | spring30     | 78          | 17             |
| 286-patch   | summer30     | 79          | 18             |
| 288-patch   | winter31     | 80          | 19             |
| 290-patch   | spring31     | 81          | 20             |
| 292-patch   | summer31     | 82          | 21             |
| 294-patch   | winter32     | 83          | 22             |
| 296-patch   | spring32     | 84          | 23             |
| 298-patch   | summer32     | 85          | 24             |
| 300-patch   | winter33     | 86          | 25             |

## API version support

Each supported API version ships its own `@lwc/sfdx-local-dev-dist-<version>` bundle (aliased in `package.json`, listed in `apiVersionMetadata`). Bundles can't be shared across versions because each one includes that release's LWC compiler. Every bundle adds significant install size, so plan version removals as well as additions.

### How users select a version

The bundle is picked from the org connection's API version, not the org's release:

- `lightning dev app|component|site --api-version <version>`, otherwise
- the `org-api-version` config value, otherwise
- the Dev Hub's API version.

So an R2b rollout shifts the default but never drops a version's usage to zero. Users and projects can pin an older version, and orgs don't all upgrade at the same moment. Expect usage to taper off after rollout.

### Removing a version

Removing a version is a breaking change, so it follows the [Salesforce CLI deprecation policy](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_deprecation.html): 4 months' notice, which is roughly one release.

1. Deprecate the version at release N R2b.
2. Check usage telemetry before removing it (see below).
3. Remove it at release N+1 R2b.

The new version is added at the start of the N+1 rollout, but the old one can't be removed until R2b. So the plugin briefly ships one extra bundle.

### Usage telemetry

Command executions by API version are in the CLI's Azure Application Insights. To get access, follow [DX Telemetry - Azure Application Insights Access](https://docs.google.com/document/d/1mHWon34OUj67CnKUdGGB7nrpTtDBx_9OcUhl79tVF-A/edit?tab=t.0).

The telemetry doesn't show whether a version was picked by default or set explicitly. Judge removal on the trend over a set window after release, not a single snapshot.

### Decision log

| Date       | Decision                                                                                                                                                                              | Source                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-09 | Keep API 66.0 through the 264 rollout. Deprecate it at 264 R2b and remove it at 266 R2b. 180-day usage: 66.0: 8,514 executions / 1,503 orgs; 67.0: 17,273 / 1,974; 68.0: 2,688 / 362. | [#platform-cli](https://salesforce-internal.slack.com/archives/C01LKDT1P6J/p1791556792551479), [original request](https://salesforce-internal.slack.com/archives/C05P1MZ2DN2/p1790887576398399) |
