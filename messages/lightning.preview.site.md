# summary

Preview an Experience Cloud site locally and in real-time, without deploying it.

# description

Enable Lightning Preview to see local changes to your site in a real-time preview that you don't have to deploy or manually refresh. To let you quickly iterate on your Lightning web components (LWCs) and pages, your site preview automatically refreshes when Lightning Preview detects source code changes.

When you edit local files with Lightning Preview enabled, your LWCs reflect the following changes in your org. To apply any other local changes not listed here, you have to deploy them to your org using the `project deploy start` command.

- Basic HTML and CSS edits
- Importing new CSS-only LWCs
- JS edits in-service component library
- JS method changes that don't affect the LWC's public API

When you make changes directly in your org, (like saving new component properties,) they're automatically deployed to your live site. To update your local version of the site with those changes, you have to retrieve them from your org using the `project retrieve start` command.

# flags.name.summary

Name of the Experience Cloud site to preview. It has to match a site name from the current org.

# flags.target-org.summary

Username or alias of the target org. Not required if the `target-org` configuration variable is already set.

# flags.debug.summary

Enable Node Inspector to debug server-side rendering.

# examples

- Preview the site "Partner Central" from the org "myOrg":
  <%= config.bin %> <%= command.id %> --name "Partner Central" --target-org myOrg
- Preview the site "Partner Central" from the org "myOrg" with Node Inspector enabled:
  <%= config.bin %> <%= command.id %> --name "Partner Central" --target-org myOrg --debug
