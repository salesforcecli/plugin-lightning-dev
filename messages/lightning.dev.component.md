# summary

[Beta] Preview LWC components in isolation.

# description

Component preview launches an isolated development environment for Lightning Web Components, enabling rapid iteration without needing to deploy changes. The server provides real-time previews of your components through hot module replacement (HMR), automatically refreshing the view when source files are modified.

When running the development server, these changes are immediately reflected:

- Component template (HTML) modifications
- Styling updates in component CSS files
- JavaScript logic changes that don't modify the component's API
- Adding or updating internal component dependencies
- Modifying static resources used by the component

See the LWC Development Guide for more information about component development best practices and limitations.

# flags.name.summary

Name of a component to preview.

# flags.client-select.summary

Launch component preview without selecting a component

# flags.lightning-type-path.summary

Path to a Lightning Type JSON file (renderer.json or editor.json) to preview.

# flags.lightning-type-override.summary

Override key to use when a Lightning Type JSON file contains multiple overrides.

# error.directory

Unable to find components

# error.component

Unable to determine component name

# error.component-metadata

Failed to parse component metadata at: %s

# error.component-not-found

Unable to find component with name: %s

# error.lightning-type-override

Unable to find Lightning Type override "%s". Available overrides: %s

# error.lightning-type-path-invalid

Lightning Type path "%s" must point to a renderer.json or editor.json file under lightningTypes.

# error.lightning-type-no-override

No Lightning Type overrides found for "%s".

# error.lightning-type-multiple

Multiple Lightning Type JSON files found for "%s": %s. Provide --lightning-type-path to pick one.

# error.lightning-type-conflict

Provide only one of --name or --lightning-type-path.

# error.lightning-type-invalid

Unable to resolve a valid Lightning Type JSON file for preview.

# examples

- Select a component and launch the component preview:
  <%= config.bin %> <%= command.id %>
- Launch component preview for "myComponent":
  <%= config.bin %> <%= command.id %> --name myComponent
- Preview a Lightning Type override explicitly:
  <%= config.bin %> <%= command.id %> --lightning-type-path path/to/renderer.json --lightning-type-override collection.renderer
