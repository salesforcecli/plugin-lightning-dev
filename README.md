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

- [`sf hello world`](#sf-hello-world)

## `sf hello world`

Say hello.

```
USAGE
  $ sf hello world [--json] [--flags-dir <value>] [-n <value>]

FLAGS
  -n, --name=<value>  [default: World] The name of the person you'd like to say hello to.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as JSON.

DESCRIPTION
  Say hello.

  Say hello either to the world or someone you know.

EXAMPLES
  Say hello to the world:

    $ sf hello world

  Say hello to someone you know:

    $ sf hello world --name Astro

FLAG DESCRIPTIONS
  -n, --name=<value>  The name of the person you'd like to say hello to.

    This person can be anyone in the world!
```

<!-- commandsstop -->
