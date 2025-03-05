# summary

Preview LWC components in isolation.

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

# error.directory

Unable to find components

# error.component

Unable to determine component name

# error.component-metadata

Failed to parse component metadata at: %s

# error.component-not-found

Unable to find component with name: %s

# examples

- Select a component and launch the component preview:
  <%= config.bin %> <%= command.id %>
- Launch component preview for "myComponent":
  <%= config.bin %> <%= command.id %> --name myComponent
