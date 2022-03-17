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

## Create Function App (assuming resource group and storage account already exist)
```bash
az functionapp create --resource-group wucols --consumption-plan-location westus2 --runtime node --runtime-version 14 --functions-version 4 --name wucols-export --storage-account wucols --os-type Linux
```

## Run the function locally
```bash
npm start
```

## Publish
```bash
npm run build:production
func azure functionapp publish wucols-export
```
Note: You will need to `npm install` after publishing, because it prunes node_modules prior to zipping/uploading the package

## Update local secrets with Azure settings
```bash
func azure functionapp fetch-app-settings wucols-export
```



