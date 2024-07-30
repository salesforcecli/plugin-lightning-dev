# summary

Preview a Lightning Experience app locally and in real-time, without deploying it.

# description

Enable Local Dev to see local changes to your app in a real-time preview that you don't have to deploy or manually refresh. To let you quickly iterate on your Lightning web components (LWCs) and pages, your app preview automatically refreshes when Local Dev detects source code changes.

When you edit local files with Local Dev enabled, your org automatically reflects these changes.

- Basic HTML and CSS edits to LWCs
- JavaScript changes to LWCs that don't affect the component's public API
- Importing new custom LWCs
- Importing another instance of an existing LWC

To apply any other local changes not listed above, you must deploy them to your org using the `sf project deploy start` command.

When you make changes directly in your org, (like saving new component properties,) they're automatically deployed to your live app. To update your local version of the app with those changes, you have to retrieve them from your org using the `sf project retrieve start` command.

# flags.name.summary

Name of the Lightning Experience app to preview.

# flags.target-org.summary

Username or alias of the target org. Not required if the `target-org` configuration variable is already set.

# flags.device-type.summary

Type of device to display the app preview.

# flags.device-id.summary

ID of the mobile device to display the preview if device type is set to `ios` or `android`. The default value is the ID of the first available mobile device.

# error.no-project

This command is required to run from within a Salesforce project directory. %s

# error.fetching.app-id

Unable to determine App Id for %s

# error.device.notfound

Unable to find device %s

# spinner.device.boot

Booting device %s

# spinner.cert.gen

Generating self-signed certificate

# spinner.extract.archive

Extracting archive

# spinner.download.preparing

Preparing to download

# spinner.downloading

Downloading

# trust.local.dev.server

Note: Your desktop browser requires additional configuration to trust the local development server. See the documentation for more details.

# certificate.installation.notice

To use local preview on your device, you have to install a self-signed certificate on it. If you previously set up a certificate for your device, you can skip this step.

# certificate.installation.skip.message

Do you want to skip this step

# certificate.installation.description

Before proceeding, install the self-signed certificate on your device. The certificate file is located at

`%s`

To install the certificate, follow these steps:

%s

# certificate.installation.steps.ios

1. Drag and drop the file onto your booted simulator.
2. Click `Allow` to proceed with downloading the configuration file.
3. Click `Close` and navigate to `Settings > General > VPN & Device Management > localhost`.
4. Click `Install` in the title bar, in the warning window, and on the install button.
5. In the `Profile Installed` view, confirm that the profile displays `Verified` and then click `Done`.
6. Navigate to `Settings > General > About > Certificate Trust Settings`.
7. Enable full trust for `localhost`.
8. In the resulting warning pop-up, click `Continue`.

# certificate.installation.steps.android

1. Drag and drop the file onto your booted emulator.
2. %s
3. Navigate to the certificate file from step 1. (It's usually located in `/sdcard/download`).
4. Follow the on-screen instructions to install it.
5. Click `User credentials` under `Credential storage` and verify that your certificate is listed there.
6. Click `Trusted credentials` under `Credential storage`. Then click `USER` and verify that page lists your certificate.

# certificate.installation.steps.android.nav-target-api-24-25

Navigate to `Settings > Security` and click `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-26-27

Navigate to `Settings > Security & Location > Encryption & credentials` and click `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-28

Navigate to `Settings > Security & Location > Advanced > Encryption & credentials` and click `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-29

Navigate to `Settings > Security > Encryption & credentials` and click `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-30-32

Navigate to `Settings > Security > Encryption & credentials` and click `Install a certificate` under `Credential storage`. Click `CA certificate`, and then click `Install anyway`.

# certificate.installation.steps.android.nav-target-api-33

Navigate to `Settings > Security > More security settings > Encryption & credentials` and click `Install a certificate` under `Credential storage`. Click `CA certificate`, and then click `Install anyway`.

# certificate.installation.steps.android.nav-target-api-34-up

Navigate to `Settings > Security & Privacy > More security & privacy > Encryption & credentials` and click `Install a certificate` under `Credential storage`. Click `CA certificate`, and then click `Install anyway`.

# certificate.waiting

After you install the certificate, press any key to continue...

# mobileapp.notfound

%s isn't installed on your device.

# mobileapp.download

%s isn't installed on your device. Do you want to download and install it?

# examples

- Preview the target org "myOrg" in a desktop environment:
  <%= config.bin %> <%= command.id %> --target-org myOrg
- Preview the app "myApp" for the target org "myOrg" in a desktop environment:
  <%= config.bin %> <%= command.id %> --name MyApp --target-org myOrg --device-type desktop
- Preview the target org "myOrg" on an iOS device:
  <%= config.bin %> <%= command.id %> --target-org myOrg --device-type ios --device-id "iPhone 15 Pro Max"
