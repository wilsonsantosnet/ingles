# Quickstart: Usando Múltiplas Categorias com Estruturas Personalizadas

**Feature**: 002-custom-category-schemas  
**Date**: 2026-03-20  
**Audience**: Professores e administradores do sistema

## Visão Geral

Este guia mostra como criar categorias de diferentes tipos (idioma ou tecnologia) e processar documentos usando as estruturas de dados apropriadas.

---

## Pré-requisitos

- Sistema instalado e configurado
- Acesso ao arquivo `data/categories.json`
- Acesso à interface de gerenciamento (manage.html)
- Documentos Word (.docx) preparados para processamento

---

## Passo 1: Criar uma Categoria de Idioma

### 1.1. Editar categories.json

Abra `data/categories.json` e adicione uma nova categoria:

```json
{
  "categories": [
    {
      "id": "frances",
      "name": "Francês",
      "description": "Aprendizado de francês com repetição espaçada",
      "icon": "🇫🇷",
      "type": "language"
    }
  ]
}
```

### 1.2. O que esperar

Quando processar documentos para esta categoria, o sistema gerará:

- ✅ **vocabulary**: Palavras com tradução, pronúncia, exemplos
- ✅ **grammar**: Tópicos gramaticais com regras e exemplos
- ✅ **expressions**: Expressões idiomáticas
- ✅ **exercises**: Exercícios de preenchimento, tradução, etc.
- ✅ **culturalNotes**: Notas sobre contexto cultural

Veja [data-model.md](./data-model.md#type-language-idiomas) para detalhes completos da estrutura.

---

## Passo 2: Criar uma Categoria de Tecnologia

### 2.1. Editar categories.json

Adicione uma categoria de certificação/tecnologia:

```json
{
  "categories": [
    {
      "id": "az204",
      "name": "Azure AZ-204",
      "description": "Microsoft Azure Developer Associate certification",
      "icon": "☁️",
      "type": "technology"
    }
  ]
}
```

### 2.2. O que esperar

Quando processar documentos para esta categoria, o sistema gerará:

- ✅ **topics**: Tópicos técnicos principais (ex: "Azure Functions", "Cosmos DB")
- ✅ **concepts**: Conceitos chave (ex: "Availability Set", "VNet Peering")
- ✅ **commands**: Comandos CLI, PowerShell, código (com sintaxe e exemplos)
- ✅ **scenarios**: Cenários de troubleshooting/implementação
- ✅ **exercises**: Questões tipo exame de certificação
- ✅ **examTips**: Dicas específicas para a prova

Veja [data-model.md](./data-model.md#type-technology-certificaçõestecnologia) para detalhes completos da estrutura.

---

## Passo 3: Processar um Documento

### 3.1. Via Interface Web (manage.html)

1. Acesse `http://localhost:3000/manage.html`
2. Selecione a categoria desejada no dropdown
3. Faça upload do documento Word (.docx)
4. Clique em "Processar Documento"
5. Aguarde processamento (pode levar alguns minutos)
6. Verifique o resultado na lista de lições

### 3.2. Verificar Estrutura Gerada

Após processamento, verifique o arquivo gerado em:

```
data/categories/<categoryId>/lesson-YYYY-MM-DD.json
```

**Para categorias de idioma**, você deve ver:

```json
{
  "enriched": {
    "vocabulary": [...],
    "grammar": [...],
    "expressions": [...],
    "exercises": [...],
    "culturalNotes": [...]
  }
}
```

**Para categorias de tecnologia**, você deve ver:

```json
{
  "enriched": {
    "topics": [...],
    "concepts": [...],
    "commands": [...],
    "scenarios": [...],
    "exercises": [...],
    "examTips": [...]
  }
}
```

---

## Passo 4: Visualizar Conteúdo

### 4.1. Acessar Lição

1. Acesse `http://localhost:3000`
2. Selecione a categoria
3. Clique na lição processada

### 4.2. Interface por Tipo

**Categorias de idioma mostram**:
- 📘 Vocabulário com traduções
- 📝 Tópicos gramaticais
- 💬 Expressões idiomáticas
- ✍️ Exercícios interativos
- 🌍 Notas culturais

**Categorias de tecnologia mostram**:
- 📌 Tópicos técnicos principais
- 💡 Conceitos chave
- 💻 Comandos com exemplos
- 🔧 Cenários práticos
- ✍️ Questões tipo exame
- 💡 Dicas para prova

---

## Casos Comuns

### Migrar Categoria Existente para Tecnologia

**Problema**: Você já tem categoria "AZ-104" sem campo `type` e quer usar estrutura de tecnologia.

**Solução**:

1. Edite `data/categories.json` e adicione `"type": "technology"` à categoria
2. Lições antigas continuam funcionando (podem ter estrutura de idioma)
3. Reprocesse documentos para gerar nova estrutura
4. (Opcional) Delete lições antigas se não forem mais necessárias

### Categoria Sem Campo Type

**Problema**: O que acontece se eu não especificar `type` em `categories.json`?

**Solução**:
- Sistema assume `"type": "language"` como padrão
- Garantia de backward compatibility com categorias antigas
- Comportamento idêntico ao sistema original

### Validação Reporta Estrutura Incorreta

**Problema**: Após processamento, sistema reporta que a estrutura não corresponde ao tipo.

**Solução**:

1. Verifique logs de processamento para detalhes do erro
2. Erros comuns:
   - LLM retornou campos de idioma para categoria de tecnologia → **Reprocessar documento**
   - JSON malformado → **Verificar se documento fonte está bem formatado**
   - Campos obrigatórios faltando → **Verificar se documento tem conteúdo suficiente**
3. Sistema salva conteúdo parcial com flag "requires-review" para inspeção manual

---

## Troubleshooting

### Problema: LLM retorna estrutura errada

**Sintomas**: Categoria de tecnologia recebe campos `vocabulary` e `grammar`

**Diagnóstico**:
```bash
# Verificar logs do servidor
node src/server.js
# Buscar por "Validation failed" ou "Structure mismatch"
```

**Solução**:
1. Verifique se campo `type` está correto em `categories.json`
2. Reprocesse o documento (sistema usa novo prompt baseado no tipo)
3. Se persistir, verifique se configuração do Azure OpenAI está correta

### Problema: Categoria antiga não funciona mais

**Sintomas**: Lições de inglês não carregam após implementação

**Diagnóstico**:
```bash
# Verificar estrutura do JSON
cat data/categories/ingles/lesson-2026-03-04.json | jq '.enriched | keys'
# Deve retornar: vocabulary, grammar, expressions, exercises, culturalNotes
```

**Solução**:
1. Verifique se `categories.json` tem categoria "ingles" com `"type": "language"` (ou sem campo type)
2. Lições antigas devem manter estrutura original
3. Se JSON está correto mas UI não renderiza, verificar `categoryAdapter.js`

### Problema: Validação sempre falha

**Sintomas**: Todas as lições processadas reportam erro de validação

**Diagnóstico**:
```javascript
// No código de validação, adicionar logs:
console.log('Category type:', categoryType);
console.log('Enriched keys:', Object.keys(enrichedContent));
```

**Solução**:
1. Verificar se schema validator está importado corretamente
2. Verificar se função de validação corresponde ao tipo correto
3. Se problema persistir, revisar lógica em `src/schemas/schemaValidator.js`

---

## Checklist de Verificação Pós-Implementação

Após implementar a feature, verificar:

- [ ] **Backward Compatibility**
  - [ ] Categoria de idioma existente ("inglês") processa documentos corretamente
  - [ ] Lições antigas de idioma continuam acessíveis e renderizam corretamente
  - [ ] Nenhuma funcionalidade de idioma foi perdida

- [ ] **Nova Funcionalidade**
  - [ ] Categoria de tecnologia ("AZ-104") processa documentos com nova estrutura
  - [ ] Estrutura gerada contém topics/concepts/commands/scenarios
  - [ ] Estrutura NÃO contém vocabulary/grammar/expressions

- [ ] **Validação**
  - [ ] Sistema valida estrutura de idioma corretamente
  - [ ] Sistema valida estrutura de tecnologia corretamente
  - [ ] Erros de validação são reportados claramente

- [ ] **Frontend**
  - [ ] UI renderiza vocabulário/gramática para categorias de idioma
  - [ ] UI renderiza tópicos/conceitos/comandos para categorias de tecnologia
  - [ ] Nenhum campo irrelevante aparece (ex: gramática em categoria de tecnologia)

---

## Exemplos Completos

### Example 1: Categoria de Alemão (Language)

**categories.json**:
```json
{
  "id": "alemao",
  "name": "Alemão",
  "description": "Aprendizado de alemão básico",
  "icon": "🇩🇪",
  "type": "language"
}
```

**Resultado esperado após processar documento**:
- Vocabulário com artigos (der/die/das)
- Gramática (casos nominativo/acusativo/dativo)
- Expressões com uso formal/informal
- Notas culturais sobre costumes alemães

### Example 2: Categoria AWS SAA (Technology)

**categories.json**:
```json
{
  "id": "aws-saa",
  "name": "AWS Solutions Architect",
  "description": "AWS SAA-C03 certification preparation",
  "icon": "☁️",
  "type": "technology"
}
```

**Resultado esperado após processar documento**:
- Tópicos: EC2, S3, VPC, IAM, CloudFormation
- Conceitos: Auto Scaling, Load Balancing, VPC Peering
- Comandos: AWS CLI examples
- Cenários: Architecture design questions
- Dicas: "S3 is eventually consistent for overwrites and deletes"

---

## Próximos Passos

Após familiarizar-se com a feature:

1. **Criar suas próprias categorias**: Experimente criar categorias mistas (ex: "Python" pode ser tecnologia)
2. **Ajustar prompts**: Se resultados não estiverem satisfatórios, ajuste prompts em `llmEnricher.js`
3. **Contribuir com schemas**: Sugira novos tipos de categoria (ex: "mathematics", "exam-prep")

---

## Suporte

**Documentação adicional**:
- [data-model.md](./data-model.md) - Estruturas JSON detalhadas por tipo
- [research.md](./research.md) - Decisões técnicas e alternativas consideradas
- [contracts/](./contracts/) - JSON schemas para validação

**Problemas comuns**: Ver seção Troubleshooting acima

**Reportar bugs**: Criar issue no repositório com:
- Tipo de categoria afetada
- Estrutura esperada vs recebida
- Logs de erro (se disponíveis)
