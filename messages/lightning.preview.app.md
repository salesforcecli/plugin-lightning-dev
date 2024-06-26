# summary

Preview Lightning Experience Applications.

# description

Preview Lightning Experience Applications in real-time.

In dev preview mode, you can edit local files and see these changes to your Lightning Web Components (LWC) within your {org name} org:

- Basic HTML and CSS edits
- Importing new CSS-only LWC
- JS edits in-service component library
- JS method changes in the LWC component that don't alter its public API.

Other local changes require deployment to your org. However, changes made directly in your org (like modifying component properties and saving) are immediately live and won't show in your local files until you retrieve them from the org.

This feature enables developers to quickly iterate on their components and pages, seeing the impact of changes in real-time without needing to deploy or refresh manually. Live reload is enabled by default to automatically refresh the preview when source code changes are detected.

Use the appropriate topic to preview specific aspects of the development environment.

# flags.name.summary

Name of the Lightning Experience application to preview.

# flags.target-org.summary

Username or alias of the target org. Not required if the `target-org` configuration variable is already set.

# flags.device-type.summary

Type of device to emulate in preview.

# flags.device-id.summary

For mobile virtual devices, specify the device ID to preview. If omitted, the first available virtual device will be used.

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

A self-signed certificate needs to be installed on your device before you can use your device for previewing. This is a one-time setup only which you can skip if you have installed the certificate already.

# certificate.installation.skip.message

Do you want to skip this step

# certificate.installation.description

Please install the self-signed certificate on your device before proceeding. The certificate file is located at

`%s`

Follow the steps below to install the certificate:

%s

# certificate.installation.steps.ios

1. Drag and drop the file on to your booted simulator.
2. Tap `Allow` to proceed with downloading the configuration file.
3. Tap `Close` and navigate to `Settings > General > VPN & Device Management > localhost`.
4. Tap `Install` in the title bar, in the warning window, and on the install button.
5. In the `Profile Installed` view, confirm that the profile shows as `Verified` and Tap `Done`.
6. Now navigate to `Settings > General > About > Certificate Trust Settings`.
7. Toggle full trust for `localhost` to enable full trust.
8. In the warning dialog, tap `Continue`.

# certificate.installation.steps.android

1. Drag and drop the file on to your booted emulator.
2. %s
3. Browse to the certificate file that you transferred from step 1 (usually under `/sdcard/download`).
4. Follow the on-screen instructions to install it.
5. Tap on `User credentials` under `Credential storage` and verify that your certificate is listed there.
6. Tap on `Trusted credentials` under `Credential storage`. Then tap on `USER` and verify that your certificate is listed there.

# certificate.installation.steps.android.nav-target-api-24-25

Navigate to `Settings > Security` and tap on `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-26-27

Navigate to `Settings > Security & Location > Encryption & credentials` and tap on `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-28

Navigate to `Settings > Security & Location > Advanced > Encryption & credentials` and tap on `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-29

Navigate to `Settings > Security > Encryption & credentials` and tap on `Install from SD card` under `Credential storage`.

# certificate.installation.steps.android.nav-target-api-30-32

Navigate to `Settings > Security > Encryption & credentials` and tap on `Install a certificate` under `Credential storage`. Now tap on `CA certificate` and on `Install anyway`.

# certificate.installation.steps.android.nav-target-api-33

Navigate to `Settings > Security > More security settings > Encryption & credentials` and tap on `Install a certificate` under `Credential storage`. Now tap on `CA certificate` and on `Install anyway`.

# certificate.installation.steps.android.nav-target-api-34-up

Navigate to `Settings > Security & Privacy > More security & privacy > Encryption & credentials` and tap on `Install a certificate` under `Credential storage`. Now tap on `CA certificate` and on `Install anyway`.

# certificate.waiting

After installing the certificate, press any key to continue...

# mobileapp.notfound

%s is not installed on your device.

# mobileapp.download

%s is not installed on your device. Do you want to download and install it

# examples

- <%= config.bin %> <%= command.id %>
