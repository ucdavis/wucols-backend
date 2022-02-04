# wucols-export
Azure Function for extracting wucols data from SiteFarm and placing it in Blob Storage

# Required cli tools
- https://docs.microsoft.com/en-us/cli/azure/
- https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local

# Some useful commands

## Log in and set current subscription
```bash
az login
az account set --subscription <SUBSCRIPTION_ID>
```

## Publish
```bash
npm run build:production
func azure functionapp publish wucols-export
```

## Update local secrets with Azure settings
```bash
func azure functionapp fetch-app-settings wucols-export-data
```



