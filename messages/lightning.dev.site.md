# summary

Preview an Experience Builder site locally and in real-time, without deploying it.

# description

Enable Local Dev to see local changes to your site in a real-time preview that you don't have to deploy or manually refresh. To let you quickly iterate on your Lightning web components (LWCs) and pages, your site preview automatically refreshes when Local Dev detects source code changes.

When you edit these local files with Local Dev enabled, your org automatically reflects these changes.

- Basic HTML and CSS edits to LWCs
- JavaScript changes to LWCs that don't affect the component's public API
- Importing new custom LWCs
- Importing another instance of an existing LWC

To apply any other local changes not listed above, you must deploy them to your org using the `sf project deploy start` command. Then republish your site and restart the server for the Local Dev experience.

If you run the command without flags, it displays a list of Experience Builder sites that it found in your local DX project for you to choose from. Use the --name flag to bypass the question. The command also asks if you want to enable Local Dev in your org if it isn't already.

For more considerations and limitations, see the Lightning Web Components Developer Guide.

# flags.name.summary

Name of the Experience Builder site to preview. It must match a site name from the current org.

# flags.get-latest.summary

Download the latest version of the specified site from your org, instead of using any local cache.

# flags.guest.summary

Preview the site as a guest user (rather than an authenticated user).

# flags.ssr.summary

Preview the server-side rendering (SSR) bundle.

# examples

- Select a site to preview from the org "myOrg":
  <%= config.bin %> <%= command.id %> --target-org myOrg

- Preview the site "Partner Central" from your default org:
  <%= config.bin %> <%= command.id %> --name "Partner Central"

- Get and preview the latest version of the "Partner Central" site from the org "myOrg"
  <%= config.bin %> <%= command.id %> --name "Partner Central" --target-org myOrg --get-latest
