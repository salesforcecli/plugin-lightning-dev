# summary

Preview a Lightning Experience app locally and in real-time, without deploying it.

# description

Use Local Dev (Beta) to see local changes to your app in a real-time preview that you don't have to deploy or manually refresh. To let you quickly iterate on your Lightning web components (LWCs) and pages, your app preview automatically refreshes when Local Dev detects source code changes.

When you edit these local files with Local Dev enabled, your org automatically reflects these changes.

- Basic HTML and CSS edits to LWCs
- JavaScript changes to LWCs that don't affect the component's public API
- Importing new custom LWCs
- Importing another instance of an existing LWC

To apply any other local changes not listed above, you must deploy them to your org using the `sf project deploy start` command.

When you make changes directly in your org (like saving new component properties), they're automatically deployed to your live app. To update your local version of the app with those changes, you must retrieve them from your org using the `sf project retrieve start` command.

To learn more about Local Dev enablement, considerations, and limitations, see the Lightning Web Components Developer Guide.

# flags.name.summary

Name of the Lightning Experience app to preview.

# flags.device-type.summary

Type of device to display the app preview.

# flags.device-id.summary

ID of the mobile device to display the preview if device type is set to `ios` or `android`. The default value is the ID of the first available mobile device.

# error.fetching.app-id

Unable to determine App Id for %s

# error.device.notfound

Unable to find device %s

# error.device.google.play

Google Play devices are not supported. %s is a Google Play device. Please use a Google APIs device instead.

# spinner.device.boot

Booting device %s

# spinner.cert.gen

Generating self-signed certificate

# spinner.cert.install

Installing self-signed certificate

# spinner.app.install

Installing app %s

# spinner.extract.archive

Extracting archive

# spinner.download.preparing

Preparing to download

# spinner.downloading

Downloading

# trust.local.dev.server

Note: Your desktop browser requires additional configuration to trust the local development server. See the documentation for more details.

# mobileapp.notfound

%s isn't installed on your device.

# mobileapp.download

%s isn't installed on your device. Do you want to download and install it?

# examples

- Preview the default app for the target org "myOrg" in a desktop environment:
  <%= config.bin %> <%= command.id %> --target-org myOrg
- Preview the app "myApp" for the target org "myOrg" in a desktop environment:
  <%= config.bin %> <%= command.id %> --name MyApp --target-org myOrg --device-type desktop
- Preview the default app for target org "myOrg" on an iOS device:
  <%= config.bin %> <%= command.id %> --target-org myOrg --device-type ios --device-id "iPhone 15 Pro Max"
