---
description: "Instruções gerais para o projeto English Spaced Repetition. Use quando: trabalhar com Node.js, Express, Azure OpenAI, fazer deploy no Azure, ou modificar código do projeto."
applyTo: '**/*.{js,json,md,bicep}'
---

# English Spaced Repetition - Instruções do Projeto

## 📋 Stack Técnica

- **Runtime**: Node.js 20+ com ES Modules (`type: "module"`)
- **Backend**: Express.js com API REST
- **Frontend**: SPA vanilla (HTML/CSS/JavaScript)
- **IA**: Azure OpenAI (GPT-4o) via Azure Identity SDK
- **Autenticação Azure**: DefaultAzureCredential (Azure CLI)
- **Processamento**: mammoth.js para extração de Word
- **Deploy**: Azure Developer CLI (azd) + Bicep
- **Hospedagem**: Azure App Service (Linux, Node.js 20 LTS)
- **Persistência**: JSON files (não usa banco de dados relacional)

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (SPA)                    │
│  public/index.html + app.js + styles.css            │
│  - Dashboard de estudo                              │
│  - Interface de revisão                             │
│  - Estatísticas e progresso                         │
└──────────────────┬──────────────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────────────┐
│            BACKEND (Express.js)                     │
│  src/server.js                                      │
│  - GET /api/lessons (lista aulas)                   │
│  - GET /api/study/today (itens para revisar)        │
│  - POST /api/study/review (registra resposta)       │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
┌────────▼────────┐  ┌───────▼──────────┐
│  Spaced         │  │  LLM Enricher    │
│  Repetition     │  │  (Azure OpenAI)  │
│  System (SM-2)  │  │                  │
└─────────────────┘  └──────────────────┘
```

## 📁 Estrutura de Pastas

- `src/` - Código-fonte backend (ES Modules)
- `public/` - Frontend estático (SPA)
- `docs/` - Documentos Word originais (.docx)
- `data/processed/` - Aulas processadas em JSON
- `infra/` - Templates Bicep para Azure
- `.github/` - Customizações do Copilot

## 🔐 Segurança e Boas Práticas

### NUNCA faça:
- ❌ Commitar chaves de API hardcoded no código
- ❌ Expor segredos em arquivos de configuração versionados
- ❌ Usar `require()` ou `module.exports` (projeto usa ES Modules)

### SEMPRE faça:
- ✅ Use variáveis de ambiente para credenciais (`process.env.AZURE_OPENAI_KEY`)
- ✅ Configure secrets via `azd env set` para deploy no Azure
- ✅ Use `import/export` (ES Modules) em todos os arquivos `.js`
- ✅ Documente mudanças significativas no código com comentários

## ☁️ Deploy no Azure

### Comandos principais:
```bash
# Deploy completo (provisiona + deploy)
azd up

# Apenas deploy do código (infra já existe)
azd deploy

# Configurar variável de ambiente
azd env set AZURE_OPENAI_KEY "sua-chave"
```

### Estruture de infraestrutura:
- Bicep templates em `infra/`
- App Service Plan: F1 (Free tier)
- Runtime: Node.js 20 LTS Linux

## 🗃️ Armazenamento de Dados

Este projeto **NÃO usa banco de dados relacional**. Todo o armazenamento é baseado em arquivos JSON:

- `data/processed/index.json` - Índice de todas as aulas
- `data/processed/lesson-*.json` - Conteúdo enriquecido de cada aula + metadados SRS
- `data/user-data.json` - Progresso e estatísticas do usuário

Ao adicionar funcionalidades que requerem persistência, **use JSON files** seguindo o padrão existente.

## 🗣️ Idioma

- **Comunicação**: Sempre responda em **português brasileiro**
- **Código**: Comentários em português, nomes de variáveis/funções podem ser em inglês
- **Documentação**: README e docs em português

## 🤖 Azure OpenAI

### Autenticação:
- Usa `DefaultAzureCredential` (não requer chave no código)
- Requer login via `az login` localmente
- Requer role: "Cognitive Services OpenAI User"

### Configuração:
```javascript
import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const client = new AzureOpenAI({ 
  azureADTokenProvider: credential,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT
});
```

## 📦 Scripts npm

- `npm start` - Inicia servidor (produção)
- `npm run dev` - Modo desenvolvimento com watch
- `npm run process` - Processa documentos Word (incremental)
- `npm run process:force` - Reprocessa todos os documentos

## 🎯 Sistema de Repetição Espaçada

Implementa algoritmo **SuperMemo SM-2**:
- Primeira revisão: 1 dia
- Segunda revisão: 6 dias
- Próximas: intervalo anterior × EF (ease factor)
- EF ajustado pela performance do usuário (0-5)