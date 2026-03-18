targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Nome do ambiente da aplicação')
param environmentName string

@minLength(1)
@description('Localização primária para todos os recursos')
param location string

@description('Chave da API do Azure OpenAI')
@secure()
param azureOpenAIKey string = ''

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

// Grupo de recursos
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

// App Service Plan
module appServicePlan './core/host/appserviceplan.bicep' = {
  name: 'appserviceplan'
  scope: resourceGroup
  params: {
    name: '${abbrs.webServerFarms}${resourceToken}'
    location: location
    tags: tags
    sku: {
      name: 'F1'
      capacity: 1
    }
    kind: 'linux'
    reserved: true
  }
}

// App Service
module appService './core/host/appservice.bicep' = {
  name: 'appservice'
  scope: resourceGroup
  params: {
    name: '${abbrs.webSitesAppService}${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'web' })
    appServicePlanId: appServicePlan.outputs.id
    runtimeName: 'node'
    runtimeVersion: '20-lts'
    appSettings: {
      PORT: '3000'
      AZURE_OPENAI_KEY: azureOpenAIKey
      AZURE_OPENAI_ENDPOINT: 'https://openaiws01.openai.azure.com/'
      AZURE_OPENAI_DEPLOYMENT: 'gpt-4o'
      AZURE_OPENAI_API_VERSION: '2024-04-01-preview'
    }
  }
}

// Outputs
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output WEBAPP_NAME string = appService.outputs.name
output WEBAPP_URI string = appService.outputs.uri
