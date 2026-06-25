# 🎯 Sistema Multi-Categoria - Guia Rápido

## ✅ Implementação Concluída

O sistema foi atualizado para suportar múltiplas categorias de estudo!

### 📋 O que mudou?

#### 1. **Nova Estrutura de Pastas**
```
data/
├── categories.json              # Lista de categorias
└── categories/
    ├── ingles/                 # Categoria de inglês (migrado)
    │   ├── index.json
    │   └── lesson-*.json
    └── <outras>/               # Novas categorias aqui
        ├── index.json
        └── lesson-*.json

docs/
├── ingles/                     # Docs de inglês (migrados)
│   └── *.docx
└── <outras>/                   # Docs de outras categorias
    └── *.docx
```

#### 2. **Novos Comandos**

##### Gerenciar Categorias
```bash
# Listar todas as categorias
npm run categories:list

# Criar nova categoria
npm run categories:create -- --id az104 --name "Azure AZ-104" --description "Microsoft Azure Administrator" --icon ☁️

# Ver detalhes de uma categoria
node src/manageCategories.js info az104

# Remover categoria
node src/manageCategories.js delete az104
```

##### Processar Documentos
```bash
# Processar categoria específica (padrão: ingles)
npm run process -- --category=ingles

# Processar categoria AZ-104
npm run process -- --category=az104

# Forçar reprocessamento
npm run process -- --category=az104 --force
```

#### 3. **Frontend Atualizado**
- Tela de seleção de categorias ao iniciar
- Dashboard isolado por categoria
- Botão para trocar de categoria
- Estatísticas independentes por categoria

### 🚀 Como Criar uma Nova Categoria (Exemplo: AZ-104)

#### Passo 1: Criar a Categoria
```bash
npm run categories:create -- --id az104 --name "Azure AZ-104" --description "Microsoft Azure Administrator" --icon ☁️
```

Isso cria:
- ✅ Entrada em `data/categories.json`
- ✅ Pasta `data/categories/az104/`
- ✅ Pasta `docs/az104/`
- ✅ Arquivo `index.json` vazio

#### Passo 2: Adicionar Documentos
Coloque arquivos `.docx` na pasta `docs/az104/`

#### Passo 3: Processar
```bash
npm run process -- --category=az104
```

#### Passo 4: Estudar!
```bash
npm start
```
Acesse http://localhost:3000 e selecione a categoria AZ-104

### 📊 APIs Disponíveis

#### Categorias
- `GET /api/categories` - Lista categorias
- `POST /api/categories` - Cria categoria
- `GET /api/categories/:id` - Detalhes da categoria

#### Aulas (por categoria)
- `GET /api/categories/:id/lessons` - Lista aulas
- `GET /api/categories/:id/lessons/:lessonId` - Detalhes da aula

#### Estudo (por categoria)
- `GET /api/categories/:id/study/today` - Itens para revisar
- `POST /api/categories/:id/study/review` - Registra revisão
- `GET /api/categories/:id/stats` - Estatísticas

#### Legado (compatível com inglês)
- `GET /api/lessons` → redireciona para `/api/categories/ingles/lessons`
- `GET /api/study/today` → redireciona para `/api/categories/ingles/study/today`
- etc.

### 🎓 Exemplos de Categorias

```bash
# Certificações Azure
npm run categories:create -- --id az104 --name "Azure AZ-104" --icon ☁️

# Certificações AWS
npm run categories:create -- --id aws-saa --name "AWS Solutions Architect" --icon 🚀

# Programação
npm run categories:create -- --id nodejs --name "Node.js Avançado" --icon 💻

# Idiomas
npm run categories:create -- --id espanhol --name "Espanhol" --icon 🇪🇸
```

### ✨ Recursos Mantidos

- ✅ Sistema de repetição espaçada (SuperMemo SM-2)
- ✅ Enriquecimento com Azure OpenAI
- ✅ Processamento de documentos Word
- ✅ Estatísticas e progresso
- ✅ Interface intuitiva

### 🔄 Compatibilidade

Os dados existentes de inglês foram **migrados automaticamente** para:
- `data/categories/ingles/`
- `docs/ingles/`

Tudo continua funcionando como antes!

### 🛠️ Arquivos Modificados

- `src/config.js` - Adicionado suporte a categorias
- `src/categoryManager.js` - **NOVO** - Gerenciador de categorias
- `src/manageCategories.js` - **NOVO** - CLI para categorias
- `src/processDocuments.js` - Aceita parâmetro `--category`
- `src/server.js` - Novos endpoints de API
- `public/index.html` - Seletor de categorias
- `public/app.js` - Lógica multi-categoria
- `public/styles.css` - Estilos para categorias
- `package.json` - Novos scripts

### 📝 Próximos Passos Sugeridos

1. Adicionar pesquisa/filtro de categorias
2. Importar/exportar categorias
3. Compartilhar categorias entre usuários
4. Backup automático por categoria
5. Temas customizados por categoria

---

## 🎉 Pronto para usar!

Execute `npm start` e comece a estudar qualquer assunto com repetição espaçada! 🚀
