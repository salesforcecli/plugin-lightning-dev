# summary

Preview an Experience Cloud site locally and in real-time, without deploying it.

# description

In developer preview mode, see local changes to your site in a real-time preview that you don't have to deploy or manually refresh. To let you quickly iterate on your Lightning web components (LWCs) and pages, your site preview automatically refreshes when source code changes are detected.

When you edit local files in developer preview mode, your LWCs reflect these changes within your {org name} org:

- Basic HTML and CSS edits
- Importing new CSS-only LWCs
- JS edits in-service component library
- JS method changes that don't affect the LWC's public API

To see any other local changes in your site, you have to deploy to your org. If you make changes directly in your org, (like saving new component properties,) they're immediately live on your site. To update your local version of the site with those changes, you have to retrieve them from your org.

Use the appropriate topic to preview specific aspects of the development environment.

# flags.name.summary

Name of the Experience Cloud site to preview. It has to match the name of a site on the current org.

# flags.name.description

More information about a flag. Don't repeat the summary.

# flags.target-org.summary

Username or alias of the target org. Not required if the `target-org` configuration variable is already set.

# flags.debug.summary

Debug SSR.

# examples

- Preview the site "Partner Central" from the org "myOrg".
  <%= config.bin %> <%= command.id %> --name "Partner Central" --target-org myOrg
- Preview the site "Partner Central" from the org "myOrg" with Node Inspector enabled for debugging.
  <%= config.bin %> <%= command.id %> --name "Partner Central" --target-org myOrg --debug
