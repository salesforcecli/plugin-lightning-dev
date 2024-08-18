# plugin-lightning-dev

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-lightning-dev.svg?label=@salesforce/plugin-lightning-dev)](https://www.npmjs.com/package/@salesforce/plugin-lightning-dev) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-lightning-dev.svg)](https://npmjs.org/package/@salesforce/plugin-lightning-dev) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-lightning-dev/main/LICENSE.txt)

## Setup

Prereqs:

1. Setup an Experience Site and publish it

2. Run the following:

```bash
yarn && yarn build
yarn link-lwr
sf org login web --instance-url ${orgfarmUrl}
```

## Run the command

Then run the following for your environment:

```bash
./bin/dev.js lightning dev site
```

or for debugging:

```bash
NODE_OPTIONS='--inspect-brk' ./bin/dev.js lightning dev site
```

No need to recompile or watch typescript files as this happens automagically.

## Fix Snapshots

```bash
node --loader ts-node/esm --no-warnings=ExperimentalWarning ./bin/dev.js snapshot:compare
node --loader ts-node/esm --no-warnings=ExperimentalWarning ./bin/dev.js schema:compare
yarn && yarn build
yarn update-snapshots
```

## TODO Update

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information on the CLI, read the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm).

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific version or tag if needed.

## Install

```bash
sf plugins install @salesforce/plugin-lightning-dev@x.y.z
```

## Issues

Please report any issues at https://github.com/forcedotcom/cli/issues

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-lightning-dev

# Install the dependencies and compile
yarn && yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev hello world
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins link .
# To verify
sf plugins
```

## Commands

<!-- commands -->

- [`sf lightning dev app`](#sf-lightning-dev-app)
- [`sf lightning dev site`](#sf-lightning-dev-site)

## `sf lightning dev app`

Preview a Lightning Experience app locally and in real-time, without deploying it.

```
USAGE
  $ sf lightning dev app -o <value> [--flags-dir <value>] [-n <value>] [-t desktop|ios|android] [-i <value>]

FLAGS
  -i, --device-id=<value>     ID of the mobile device to display the preview if device type is set to `ios` or
                              `android`. The default value is the ID of the first available mobile device.
  -n, --name=<value>          Name of the Lightning Experience app to preview.
  -o, --target-org=<value>    (required) Username or alias of the target org. Not required if the `target-org`
                              configuration variable is already set.
  -t, --device-type=<option>  [default: desktop] Type of device to display the app preview.
                              <options: desktop|ios|android>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Preview a Lightning Experience app locally and in real-time, without deploying it.

  Use Local Dev (Beta) to see local changes to your app in a real-time preview that you don't have to deploy or manually
  refresh. To let you quickly iterate on your Lightning web components (LWCs) and pages, your app preview automatically
  refreshes when Local Dev detects source code changes.

  When you edit these local files with Local Dev enabled, your org automatically reflects these changes.

  - Basic HTML and CSS edits to LWCs
  - JavaScript changes to LWCs that don't affect the component's public API
  - Importing new custom LWCs
  - Importing another instance of an existing LWC

  To apply any other local changes not listed above, you must deploy them to your org using the `sf project deploy
  start` command.

  When you make changes directly in your org (like saving new component properties), they're automatically deployed to
  your live app. To update your local version of the app with those changes, you must retrieve them from your org using
  the `sf project retrieve start` command.

  To learn more about Local Dev enablement, considerations, and limitations, see the Lightning Web Components Developer
  Guide.

EXAMPLES
  Preview the default app for the target org "myOrg" in a desktop environment:

    $ sf lightning dev app --target-org myOrg

  Preview the app "myApp" for the target org "myOrg" in a desktop environment:

    $ sf lightning dev app --name MyApp --target-org myOrg --device-type desktop

  Preview the default app for target org "myOrg" on an iOS device:

    $ sf lightning dev app --target-org myOrg --device-type ios --device-id "iPhone 15 Pro Max"
```

_See code: [src/commands/lightning/dev/app.ts](https://github.com/salesforcecli/plugin-lightning-dev/blob/1.0.26-alpha.1/src/commands/lightning/dev/app.ts)_

## `sf lightning dev site`

Preview an Experience Builder site locally and in real-time, without deploying it.

```
USAGE
  $ sf lightning dev site -o <value> [--flags-dir <value>] [-n <value>]

FLAGS
  -n, --name=<value>        Name of the Experience Builder site to preview. It has to match a site name from the current
                            org.
  -o, --target-org=<value>  (required) Username or alias of the target org. Not required if the `target-org`
                            configuration variable is already set.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.

DESCRIPTION
  Preview an Experience Builder site locally and in real-time, without deploying it.

  Enable Local Dev to see local changes to your site in a real-time preview that you don't have to deploy or manually
  refresh. To let you quickly iterate on your Lightning web components (LWCs) and pages, your site preview automatically
  refreshes when Local Dev detects source code changes.

  When you edit these local files with Local Dev enabled, your org automatically reflects these changes.

  - Basic HTML and CSS edits to LWCs
  - JavaScript changes to LWCs that don't affect the component's public API
  - Importing new custom LWCs
  - Importing another instance of an existing LWC

  To apply any other local changes not listed above, you must deploy them to your org using the `sf project deploy
  start` command. Then republish your site and restart the server for the Local Dev experience.

  For more considerations and limitations, see the Lightning Web Components Developer Guide.

EXAMPLES
  Preview the site "Partner Central" from the org "myOrg":

    $ sf lightning dev site --name "Partner Central" --target-org myOrg
```

_See code: [src/commands/lightning/dev/site.ts](https://github.com/salesforcecli/plugin-lightning-dev/blob/1.0.26-alpha.1/src/commands/lightning/dev/site.ts)_

<!-- commandsstop -->
