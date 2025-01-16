# summary

Preview a Lightning Web Component in isolation.

# description

Preview and develop a single Lightning Web Component in isolation using Local Dev.

# flags.name.summary

Name of the component to preview.

# flags.namespace.summary

Namespace of the component (defaults to 'c').

# flags.attributes.summary

JSON string of attributes to pass to the component.

# error.invalid.attributes

Invalid JSON format for attributes parameter.

# examples

- Preview a component named 'myComponent':
  <%= config.bin %> <%= command.id %> --name myComponent --target-org myOrg
- Preview a component with attributes:
  <%= config.bin %> <%= command.id %> --name myComponent --target-org myOrg --attributes '{"label":"Hello","variant":"brand"}'
