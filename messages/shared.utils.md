# config-utils.port-desc

The port number of the local dev server

# config-utils.port-error-message

The port number must be a number between 1 and 65535

# config-utils.workspace-desc

The workspace name of the local lwc dev server

# config-utils.workspace-error-message

Valid workspace value is "SalesforceCLI" OR "mrt"

# config-utils.data-desc

The identity data is a data structure that links the local web server's identity token to the user's configured Salesforce orgs.

# config-utils.cert-desc

The SSL certificate data to be used by the local dev server for secure connections

# config-utils.cert-error-message

You must provide valid SSL certificate data

# localdev.enabled

Local dev has been enabled for this org.

# error.localdev.not.enabled

Local Dev is not enabled for your org. See https://developer.salesforce.com/docs/platform/lwc/guide/get-started-test-components.html for more information on enabling and using Local Dev.

# error.org.api-mismatch.message

Your org is on API version %s, but this version of the CLI plugin supports API version %s.

# error.org.api-mismatch.remediation

To use the plugin with this org, you can reinstall or update the plugin using the "%s" tag. For example: "sf plugins install %s".

# error.username

Org must have a valid user

# error.identitydata

Couldn't find identity data while generating preview arguments

# error.identitydata.entityid

Couldn't find entity ID while generating preview arguments

# error.no-project

This command is required to run from within a Salesforce project directory. %s
