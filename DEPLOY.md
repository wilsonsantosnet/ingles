# Deploy no Azure App Service

## Pré-requisitos

1. [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli)
2. [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
3. Conta Azure ativa

## Passos para Deploy

### 1. Instalar Azure Developer CLI

```powershell
# Windows (PowerShell)
winget install microsoft.azd

# Ou usando Chocolatey
choco install azd
```

### 2. Login no Azure

```powershell
azd auth login
```

### 3. Inicializar o ambiente

```powershell
# Na pasta do projeto
azd init
```

Quando solicitado:
- **Environment name**: escolha um nome (ex: `ingles-prod`)
- **Location**: escolha uma região (ex: `brazilsouth` ou `eastus`)

### 4. Configurar variável de ambiente

```powershell
# Configure sua chave do Azure OpenAI
azd env set AZURE_OPENAI_KEY "sua-chave-aqui"
```

### 5. Deploy

```powershell
# Provisiona infraestrutura e faz deploy da aplicação
azd up
```

Este comando irá:
1. Criar um Resource Group
2. Criar um App Service Plan (B1)
3. Criar um App Service
4. Fazer deploy do código
5. Configurar variáveis de ambiente

### 6. Acessar a aplicação

Após o deploy, o comando mostrará a URL da aplicação. Exemplo:
```
https://app-xxxxx.azurewebsites.net
```

## Comandos Úteis

```powershell
# Apenas fazer deploy do código (sem reprovisionar)
azd deploy

# Ver logs da aplicação
azd monitor

# Ver configuração do ambiente
azd env list

# Remover todos os recursos
azd down
```

## Configuração Manual (Alternativa)

Se preferir não usar `azd`, pode fazer deploy manualmente:

### Via VS Code

1. Instale a extensão "Azure App Service"
2. Clique com botão direito em `src` → Deploy to Web App
3. Siga o assistente

### Via Azure CLI

```powershell
# 1. Build
npm install

# 2. Criar Resource Group
az group create --name rg-ingles --location brazilsouth

# 3. Criar App Service Plan
az appservice plan create --name plan-ingles --resource-group rg-ingles --sku B1 --is-linux

# 4. Criar Web App
az webapp create --name app-ingles-study --resource-group rg-ingles --plan plan-ingles --runtime "NODE:20-lts"

# 5. Configurar variáveis
az webapp config appsettings set --name app-ingles-study --resource-group rg-ingles --settings AZURE_OPENAI_KEY="sua-chave"

# 6. Deploy via ZIP
az webapp deploy --name app-ingles-study --resource-group rg-ingles --src-path deploy.zip --type zip
```

## Custos Estimados

- **App Service B1**: ~US$ 13/mês (~R$ 65/mês)
- **Azure OpenAI**: Pay-per-token (varia por uso)

## Troubleshooting

### Erro de módulos
```powershell
# Verificar logs
az webapp log tail --name app-ingles-study --resource-group rg-ingles
```

### Aplicação não inicia
1. Verifique se `PORT` está configurado corretamente
2. Verifique os logs no Azure Portal
3. Confirme que `npm start` funciona localmente

### Variáveis de ambiente
```powershell
# Ver todas as configurações
az webapp config appsettings list --name app-ingles-study --resource-group rg-ingles
```
