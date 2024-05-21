# summary

Preview Lightning Experience Applications.

# description

Preview components, org, and sites. If no topic is specified, the default action is to preview the org.

In dev preview mode, you can edit local files and see these changes to your Lightning Web Components (LWC) within your {org name} org:

- Basic HTML and CSS edits
- Importing new CSS-only LWC
- JS edits in-service component library
- JS method changes in the LWC component that don't alter its public API.

Other local changes require deployment to your org. However, changes made directly in your org (like modifying component properties and saving) are immediately live and won't show in your local files until you retrieve them from the org.

This feature enables developers to quickly iterate on their components and pages, seeing the impact of changes in real-time without needing to deploy or refresh manually. Live reload is enabled by default to automatically refresh the preview when source code changes are detected.

Use the appropriate topic to preview specific aspects of the development environment.

# flags.name.summary

Description of a flag.

# flags.name.description

More information about a flag. Don't repeat the summary.

# examples

- <%= config.bin %> <%= command.id %>
