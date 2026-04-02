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

If you run the command without flags, it displays a list of components that it found in your local DX project for you to choose to preview. Use the --name flag to bypass the question. The command also asks if you want to enable Local Dev in your org if it isn't already.

See the LWC Developer Guide for more information about component development best practices and limitations (https://developer.salesforce.com/docs/platform/lwc/guide/get-started-best-practices.html).

# flags.name.summary

Name of a component to preview.

# flags.client-select.summary

Launch component preview without selecting a component.

# error.directory

Unable to find components.

# error.component

Unable to determine component name.

# error.component-metadata

Failed to parse component metadata at: %s.

# error.component-not-found

Unable to find component with name: %s.

# examples

- Select a component interactively and launch the component preview; use your default org:
  <%= config.bin %> <%= command.id %>

- Launch component preview for "myComponent"; use the org with alias "myscratch":
  <%= config.bin %> <%= command.id %> --name myComponent --target-org myscratch
