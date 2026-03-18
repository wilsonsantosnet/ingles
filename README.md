# 📚 English Study - Sistema de Repetição Espaçada

Sistema inteligente de estudo de inglês que processa documentos Word das suas aulas, enriquece o conteúdo usando Azure OpenAI (GPT-4o), e aplica o método de repetição espaçada para otimizar a memorização.

## 🌟 Funcionalidades

- ✅ **Extração Automática**: Processa documentos Word (.docx) automaticamente
- 🤖 **Enriquecimento com IA**: Usa Azure OpenAI (GPT-4o) para adicionar:
  - Exemplos práticos
  - Exercícios personalizados
  - Pronúncia e fonética
  - Sinônimos e antônimos
  - Contextos de uso
  - Notas culturais
- 📊 **Repetição Espaçada**: Algoritmo SuperMemo SM-2 para otimizar revisões
- 🎯 **Interface Intuitiva**: Dashboard web para estudar e acompanhar progresso
- 📈 **Estatísticas**: Acompanhe seu progresso e performance
- 🔐 **Autenticação Azure AD**: Usa sua identidade Azure CLI para acesso seguro ao OpenAI

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

### 4. Processar Documentos

Coloque seus documentos Word na pasta `docs/` e execute:

```bash
npm run process
```

Isso irá:
- Extrair o conteúdo de cada documento
- Enviar para Azure OpenAI (GPT-4o) para enriquecimento
- Salvar JSONs estruturados em `data/processed/`
- Configurar sistema de repetição espaçada

### 5. Iniciar Aplicação

```bash
npm start
```

Acesse: http://localhost:3000

## 📁 Estrutura do Projeto

```
english-spaced-repetition/
├── docs/                          # Documentos Word originais
├── data/
│   └── processed/                 # Aulas processadas (JSON)
├── src/
│   ├── config.js                  # Configurações
│   ├── wordExtractor.js           # Extração de Word
│   ├── llmEnricher.js             # Enriquecimento com LLM
│   ├── spacedRepetition.js        # Sistema SRS
│   ├── processDocuments.js        # Script de processamento
│   └── server.js                  # Servidor API
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
