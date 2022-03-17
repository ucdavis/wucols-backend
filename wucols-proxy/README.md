# wucols-proxy
Azure Function for proxying image requests to work around SiteFarm CORS issue

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
az functionapp create --resource-group wucols --consumption-plan-location westus2 --runtime dotnet --functions-version 4 --name wucols-proxy --storage-account wucols --os-type Linux
az functionapp cors add --resource-group wucols --name wucols-proxy --allowed-origins <SPACE_SEPARATED_ORIGINS>
```

## Run the function locally
```bash
func start
```

## Publish
```bash
func azure functionapp publish wucols-proxy
```




