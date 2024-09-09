# plugin-lightning-dev

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-lightning-dev.svg?label=@salesforce/plugin-lightning-dev)](https://www.npmjs.com/package/@salesforce/plugin-lightning-dev) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-lightning-dev.svg)](https://npmjs.org/package/@salesforce/plugin-lightning-dev) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-lightning-dev/main/LICENSE.txt)

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information on the CLI, read the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm).

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific version or tag if needed.

## Install

```bash
sf plugins install @salesforce/plugin-lightning-dev@x.y.z
```

or

```bash
sf plugins install @salesforce/plugin-lightning-dev
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

## LWR Sites Development Environment

Follow these instructions if you want to setup a dev environment for the `sf lightning dev site` command.

## Setup

1. [Enable Local Development] (https://developer.salesforce.com/docs/platform/lwc/guide/get-started-test-components.html#enable-local-dev)

2. Deploy some source files to your org from your SFDX project

```bash
sf org login web --alias dev --instance-url ${orgfarmUrl}

```

3. Add those source files to an LWR site in the Experience Builder and Publish the site (basePath: '/')

4. Follow the [Build the plugin locally](#build) instructions

5. [optional] Linking / Debugging LWR Source

```bash
# build and link lwr source
cd lwr
yarn && yarn link-lwr

# build and link plugin-lightning-dev source
cd plugin-lightning-dev
yarn && yarn build
yarn link-lwr

# SFDX Project
cd sfdx-project

# Login to your org
sf org login web --alias dev --instance-url https://login.test1.pc-rnd.salesforce.com/ (orgfarm needs instance url)

# run/debug the sf cli command (attach to the CLI from the LWR repo in VS Code)
NODE_OPTIONS="--inspect-brk" sf lightning dev site --target-org dev
```

Now you can Remote Attach to the CLI from the vscode debugger:

- Use the "Attach" launch configuration
- Run launch config from LWR repo if you want to debug LWR source
- Run launch config from plugin-lightning-dev source if you want to debug the SFDX plugin source specifically

If this doesn't work for whatever reason, you can always alias the build output directly like so:

```bash
alias sfdev="/{pathToGitDir}/plugin-lightning-dev/bin/run.js"
# SFDX Project
NODE_OPTIONS="--inspect-brk" sfdev lightning dev site --target-org dev
```

6. Make changes to your c-namespace components and you should see the browser refresh with those changes!

## Fixing Snapshots

```bash
node --loader ts-node/esm --no-warnings=ExperimentalWarning ./bin/dev.js snapshot:compare
node --loader ts-node/esm --no-warnings=ExperimentalWarning ./bin/dev.js schema:compare
yarn && yarn build
yarn update-snapshots
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

_See code: [src/commands/lightning/dev/app.ts](src/commands/lightning/dev/app.ts)_

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

_See code: [src/commands/lightning/dev/site.ts](src/commands/lightning/dev/site.ts)_

<!-- commandsstop -->
