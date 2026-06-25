# 📚 Sistema de Estudo - Repetição Espaçada Multi-Categoria

Sistema inteligente de estudo que processa documentos Word, enriquece o conteúdo usando Azure OpenAI (GPT-4o), e aplica o método de repetição espaçada para otimizar a memorização de **qualquer assunto** - inglês, certificações técnicas, programação, e muito mais!

## 🌟 Funcionalidades

- 🗂️ **Multi-Categoria**: Organize seus estudos por categorias (inglês, AZ-104, AWS, etc.)
- ✅ **Extração Automática**: Processa documentos Word (.docx) automaticamente
- 🤖 **Enriquecimento com IA**: Usa Azure OpenAI (GPT-4o) para adicionar:
  - Exemplos práticos
  - Exercícios personalizados
  - Explicações detalhadas
  - Contextos de uso
  - Notas importantes
- 📊 **Repetição Espaçada**: Algoritmo SuperMemo SM-2 para otimizar revisões
- 🎯 **Interface Intuitiva**: Dashboard web para estudar e acompanhar progresso
- 📈 **Estatísticas por Categoria**: Acompanhe seu progresso em cada assunto
- 🔐 **Autenticação Azure AD**: Usa sua identidade Azure CLI para acesso seguro ao OpenAI

## 🎓 Casos de Uso

- 📖 **Idiomas**: Inglês, Espanhol, Francês, etc.
- ☁️ **Certificações**: Azure (AZ-104, AZ-204), AWS, GCP
- 💻 **Programação**: Node.js, Python, React, etc.
- 📚 **Qualquer Assunto**: Medicina, Direito, História, etc.

## 🚀 Como Usar

### 1. Pré-requisitos

- **Node.js** instalado
- **Azure CLI** instalado e logado: `az login`
- **Permissão** no Azure OpenAI resource (role: Cognitive Services OpenAI User)

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Permissões Azure

Execute este comando para adicionar a role necessária:

```bash
$userId = az ad signed-in-user show --query id -o tsv
az role assignment create --role "Cognitive Services OpenAI User" --assignee $userId --scope "/subscriptions/2f9243e7-bbf9-4f66-837f-632eba883a76/resourceGroups/TesteFoundryWs/providers/Microsoft.CognitiveServices/accounts/openaiws01"
```

**Aguarde 2-5 minutos** para a permissão propagar no Azure AD.

### 4. Criar Categoria de Estudo

Crie uma categoria para organizar seus estudos:

```bash
# Categoria de inglês (já existe)
npm run categories:list

# Criar nova categoria (exemplo: AZ-104)
npm run categories:create -- --id az104 --name "Azure AZ-104" --description "Microsoft Azure Administrator" --icon ☁️

# Criar categoria de programação
npm run categories:create -- --id nodejs --name "Node.js Avançado" --description "Programação Node.js" --icon 💻
```

### 5. Processar Documentos

Coloque seus documentos Word na pasta `docs/<categoria>/` e execute:

```bash
# Processar categoria específica
npm run process -- --category=ingles

# Processar categoria AZ-104
npm run process -- --category=az104

# Forçar reprocessamento
npm run process -- --category=az104 --force
```

Isso irá:
- Extrair o conteúdo de cada documento
- Enviar para Azure OpenAI (GPT-4o) para enriquecimento
- Salvar JSONs estruturados em `data/categories/<categoria>/`
- Configurar sistema de repetição espaçada

### 6. Iniciar Aplicação

```bash
npm start
```

Acesse: <http://localhost:3000>

Selecione a categoria que deseja estudar e comece!

## 🗂️ Sistema Multi-Categoria

O sistema agora suporta múltiplas categorias de estudo independentes, cada uma com **estrutura de conteúdo personalizada** baseada no tipo:

### 📋 Tipos de Categoria

**🌐 Language (Idiomas)**
- Estrutura otimizada para aprendizado de línguas
- Conteúdo: vocabulário, gramática, expressões, exercícios, notas culturais
- Exemplos: Inglês, Espanhol, Francês, Alemão, Mandarim

**💻 Technology (Tecnologia/Certificações)**
- Estrutura otimizada para conteúdo técnico e preparação para certificações
- Conteúdo: tópicos técnicos, conceitos, comandos, cenários práticos, dicas de prova
- Exemplos: Azure (AZ-104, AZ-204), AWS, Kubernetes, React, Node.js

```
data/
├── categories.json              # Lista de categorias (com campo "type")
└── categories/
    ├── ingles/                 # type: "language"
    │   ├── index.json
    │   └── lesson-*.json       # vocabulary, grammar, expressions
    ├── az104/                  # type: "technology"
    │   ├── index.json
    │   └── lesson-*.json       # topics, concepts, commands
    └── <outras>/
        └── lesson-*.json

docs/
├── ingles/                     # Documentos de inglês
│   └── *.docx
├── az104/                      # Documentos AZ-104
│   └── *.docx
└── <outras>/
    └── *.docx
```

📖 **Ver [MULTI-CATEGORY.md](MULTI-CATEGORY.md) para guia completo**

## 📁 Estrutura do Projeto

```
english-spaced-repetition/
├── docs/                          # Documentos Word organizados por categoria
│   ├── ingles/
│   └── az104/
├── data/
│   ├── categories.json            # Lista de categorias
│   └── categories/                # Dados processados por categoria
│       ├── ingles/
│       └── az104/
├── src/
│   ├── config.js                  # Configurações
│   ├── wordExtractor.js           # Extração de Word
│   ├── llmEnricher.js             # Enriquecimento com LLM
│   ├── spacedRepetition.js        # Sistema SRS
│   ├── processDocuments.js        # Script de processamento
│   ├── server.js                  # Servidor API
│   └── schemas/                   # Validação de estruturas por tipo
│       ├── schemaValidator.js     # Validador base
│       ├── languageSchema.js      # Schema para idiomas
│       └── technologySchema.js    # Schema para tecnologia
├── public/
│   ├── index.html                 # Interface
│   ├── styles.css                 # Estilos
│   └── app.js                     # Lógica frontend
├── .env                           # Configurações (não versionar!)
└── package.json
```

## 🎮 Como Estudar

1. **Acesse o Dashboard**: Veja quantos itens você precisa revisar hoje
2. **Estude**: Leia a pergunta/palavra e tente lembrar
3. **Revele a Resposta**: Clique em "Mostrar Resposta"
4. **Avalie sua Performance**:
   - 😞 **Esqueci**: Completamente esquecido
   - 😐 **Difícil**: Lembrou com muita dificuldade
   - 😊 **Bom**: Lembrou corretamente
   - 😎 **Fácil**: Lembrou instantaneamente

O sistema ajusta automaticamente os intervalos de revisão baseado na sua performance!

## 📊 Como Funciona a Repetição Espaçada

O algoritmo **SuperMemo SM-2** ajusta os intervalos de revisão:

- **1ª revisão**: 1 dia depois
- **2ª revisão**: 6 dias depois
- **Próximas**: Intervalo anterior × Fator de Facilidade

Se você errar, o item volta para o início. Quanto melhor sua performance, mais tempo entre revisões!

## ⚙️ Configuração

Arquivo `.env`:

```env
AZURE_OPENAI_ENDPOINT=https://seu-endpoint.openai.azure.com/...
AZURE_OPENAI_KEY=sua-chave-aqui
PORT=3000
```

## 🔧 Scripts Disponíveis

- `npm start`: Inicia o servidor web
- `npm run dev`: Inicia com hot-reload
- `npm run process`: Processa todos os documentos Word

## 📝 Formato dos Documentos

Os documentos Word devem seguir o padrão:
- Nome: `Seu Nome - DDMonthYYYY.docx`
- Exemplo: `Wilson dos Santos - 01October2025.docx`

O sistema detecta automaticamente:
- Data da aula
- Seções (vocabulário, gramática, etc)
- Conteúdo relevante

## 🎨 Customização

### Modificar Prompt do LLM

Edite `src/llmEnricher.js` → função `createEnrichmentPrompt()`

### Ajustar Algoritmo SRS

Edite `src/spacedRepetition.js` → classe `SpacedRepetitionSystem`

### Personalizar Interface

Edite `public/styles.css` para mudar cores, layout, etc.

## 📈 Próximas Melhorias

- [ ] Suporte a imagens e áudio
- [ ] Modo offline com service worker
- [ ] Exportar/importar progresso
- [ ] Gamificação (streaks, conquistas)
- [ ] App mobile (React Native)
- [ ] Modo de prática oral com speech recognition

## 🤝 Contribuindo

Sugestões e melhorias são bem-vindas!

## 📄 Licença

MIT License - Use e modifique como quiser!

---

**Desenvolvido por Wilson dos Santos** 🚀
