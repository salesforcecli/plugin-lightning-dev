# summary

Preview Experience Cloud Sites.

# description

In dev preview mode, you can edit local files and see these changes to your Lightning Web Components (LWC) within your site:

- Basic HTML and CSS edits
- Importing new CSS
- Javascript edits in-service component library
- Javascript method changes in the LWC component that don't alter its public API.

Other local changes may require deployment to your org. However, changes made directly in your org (like modifying component properties) are immediately live and won't show in your local files until you retrieve them from the org.

# flags.name.summary

Specify the site name for preview.

# flags.name.description

The site name needs to match the name of a site on the current org. Example: "B2C CodeCept"

# examples

- <%= config.bin %> <%= command.id %> --name MySite

# flags.debug.summary

Debug SSR.

# flags.debug.description

Debug Description.

# flags.target-org.summary

undefined
