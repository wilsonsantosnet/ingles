# Research Phase: Suporte a Múltiplas Categorias

**Feature**: 002-custom-category-schemas  
**Date**: 2026-03-20  
**Status**: Complete

## Overview

Esta fase de research resolve todos os "NEEDS CLARIFICATION" do Technical Context e estabelece decisões técnicas fundamentais para implementação da feature de múltiplas categorias com estruturas personalizadas.

---

## Research Tasks

### Task 1: Estratégia de Testing

**Question**: Como testar backward compatibility garantindo que lições de idioma existentes mantêm 100% da funcionalidade?

#### Findings

**Abordagem escolhida: Snapshot Testing + Manual Validation**

1. **Snapshot Testing**:
   - Capturar JSON atual de uma lição de idioma já processada (exemplo: lesson-2026-03-04.json)
   - Após modificações, reprocessar o mesmo documento fonte
   - Comparar estrutura gerada (deve ser idêntica)
   - Ferramenta: Node.js native `assert.deepStrictEqual()` + manual file diff

2. **Categoria de Tecnologia - Nova Estrutura**:
   - Criar categoria AZ-104 test (se ainda não existe)
   - Processar documento de teste sobre Azure
   - Validar presença de: topics, concepts, commands, scenarios, examTips
   - Validar ausência de: vocabulary, grammar, expressions (campos de idioma)

3. **Validação de Estrutura**:
   - Unit tests para schema validator
   - Input: JSON válido por tipo → expect: pass
   - Input: JSON com campos incorretos → expect: fail + lista de erros

**Rationale**: 
- Snapshot testing detecta mudanças não intencionais em output existente
- Teste manual de categorias tecnologia verifica corretude da nova estrutura
- Unit tests de validação são rápidos e cobrem edge cases

**Alternatives considered**:
- ❌ **Testes E2E automatizados**: Requerem setup de Azure OpenAI mock complexo (LLM não-determinístico), overhead alto para feature inicial
- ❌ **Testes apenas manuais**: Não previnem regressões, especialmente em backward compatibility crítica
- ❌ **Uso de framework de teste específico (Jest, Mocha)**: Projeto não tem framework configurado ainda, native Node.js suficiente para escopo atual

---

### Task 2: Prompt Engineering para Azure OpenAI

**Question**: Como estruturar prompts para garantir que o LLM retorne estrutura correta por tipo de categoria?

#### Findings

**Abordagem: System Prompt + JSON Schema Explícito + Few-Shot Examples**

1. **Prompt para Language**:
```text
System: You are an expert language educator creating structured learning content.

Task: Extract and structure vocabulary, grammar rules, idiomatic expressions, 
exercises, and cultural notes from the following text.

Output EXACTLY this JSON structure:
{
  "enriched": {
    "vocabulary": [{"word", "translation", "definition", "examples": [], "pronunciation", "partOfSpeech", "synonyms": [], "difficulty"}],
    "grammar": [{"topic", "explanation", "rules": [], "examples": [], "commonMistakes": []}],
    "expressions": [{"expression", "meaning", "usage", "examples": []}],
    "exercises": [{"type", "question", "answer", "hint"}],
    "culturalNotes": [{"topic", "content"}]
  }
}

Content: [DOCUMENT_TEXT]
```

2. **Prompt para Technology**:
```text
System: You are an expert technology instructor creating certification exam preparation content.

Task: Extract and structure technical topics, key concepts, command examples, 
practical scenarios, and exam preparation tips from the following text.

Output EXACTLY this JSON structure:
{
  "enriched": {
    "topics": [{"name", "description", "category", "importance"}],
    "concepts": [{"concept", "definition", "examples": [], "relatedConcepts": [], "difficulty"}],
    "commands": [{"command", "description", "syntax", "examples": [], "platform"}],
    "scenarios": [{"scenario", "problem", "solution", "explanation"}],
    "exercises": [{"type", "question", "answer", "hint", "topic"}],
    "examTips": [{"tip", "relevance", "topic"}]
  }
}

Content: [DOCUMENT_TEXT]
```

**Rationale**:
- System prompt define papel/personalidade do LLM apropriado ao domínio
- JSON schema explícito no prompt reduz ambiguidade e melhora conformidade
- Instruir "Output EXACTLY this structure" aumenta compliance
- Few-shot examples (se necessário) podem ser adicionados se conformidade for baixa

**Alternatives considered**:
- ❌ **Function calling (Azure OpenAI)**: Mais complexo, requer definir functions JSON, overhead desnecessário quando prompt direto funciona
- ❌ **Prompt único com instruções condicionais**: "If language content, use X format, if technology, use Y" → confunde o modelo, pior performance
- ❌ **Post-processing com regex/parsing**: LLM pode retornar JSON malformado, parsing frágil; melhor garantir output correto no prompt

---

### Task 3: Schema Validation Library

**Question**: Usar biblioteca de validação JSON ou implementar validação customizada?

#### Findings

**Decision: Validação Customizada Simples**

Implementar funções de validação específicas por tipo:

```javascript
// src/schemas/schemaValidator.js

export function validateLanguageStructure(enrichedContent) {
  const requiredFields = ['vocabulary', 'grammar', 'expressions', 'exercises', 'culturalNotes'];
  const forbiddenFields = ['topics', 'concepts', 'commands', 'scenarios', 'examTips'];
  
  return {
    isValid: /* check logic */,
    missingFields: /* array */,
    unexpectedFields: /* array */,
    errors: /* array of error messages */
  };
}

export function validateTechnologyStructure(enrichedContent) {
  const requiredFields = ['topics', 'concepts', 'commands', 'scenarios', 'exercises', 'examTips'];
  const forbiddenFields = ['vocabulary', 'grammar', 'expressions', 'culturalNotes', 'pronunciation'];
  
  return {
    isValid: /* check logic */,
    missingFields: /* array */,
    unexpectedFields: /* array */,
    errors: /* array of error messages */
  };
}
```

**Rationale**:
- Validação simples: verificar presença de campos requeridos + ausência de campos proibidos
- Não há necessidade de validação profunda de tipos/valores (LLM gera conteúdo textual)
- JSON Schema library (ajv, joi) é overhead para validação estrutural superficial
- Código customizado: zero dependências adicionais, fácil debug, fácil evoluir

**Alternatives considered**:
- ❌ **JSON Schema + ajv**: Overhead de definir schemas formais, dependência adicional, overkill para validação simples de existência de campos
- ❌ **TypeScript com Zod**: Projeto é JavaScript puro, adicionar TypeScript/Zod é mudança arquitetural fora do escopo
- ❌ **Sem validação**: Spec exige 100% validação (FR-006, SC-003) - não é opcional

---

### Task 4: Backward Compatibility Strategy

**Question**: Como garantir que modificações em llmEnricher.js não quebram processamento de lições de idioma existentes?

#### Findings

**Strategy: Type-Based Dispatch + Default Fallback**

```javascript
// src/llmEnricher.js

export async function enrichWithLLM(lesson, category) {
  // FR-008: Default "language" se type não especificado
  const categoryType = category.type || 'language';
  
  switch(categoryType) {
    case 'language':
      return await enrichLanguageContent(lesson, category);
    
    case 'technology':
      return await enrichTechnologyContent(lesson, category);
    
    default:
      // FR-009: Reportar erro para tipo desconhecido
      throw new Error(`Unknown category type: ${categoryType}. Valid types: language, technology`);
  }
}

async function enrichLanguageContent(lesson, category) {
  // [ Código atual - mantido exatamente como está ]
  // Usa prompt de idioma, retorna estrutura vocabulary/grammar/etc
}

async function enrichTechnologyContent(lesson, category) {
  // [ Novo código ]
  // Usa prompt de tecnologia, retorna estrutura topics/concepts/etc
}
```

**Rationale**:
- Switch statement simples e explícito (fácil debugar, fácil adicionar novos tipos)
- Default "language" garante backward compatibility com categories.json existente que não tem campo "type"
- Separação em funções: enrichLanguageContent mantém toda lógica existente intacta → zero risco de quebra
- Error claro para tipo desconhecido (FR-009)

**Alternatives considered**:
- ❌ **Strategy pattern com classes**: Over-engineering para 2 tipos, adiciona complexidade desnecessária
- ❌ **Config-driven prompt loading**: Flexível mas adiciona I/O, parsing, error handling complexo - YAGNI para MVP
- ❌ **Modificar função existente com if/else**: Código atual tem ~50 linhas, misturar lógicas dificulta manutenção

---

### Task 5: Frontend Adaptation Strategy

**Question**: Como adaptar public/app.js para renderizar estruturas diferentes sem duplicar código?

#### Findings

**Strategy: Adapter Pattern com Render Factories**

```javascript
// public/categoryAdapter.js (NOVO)

export class CategoryAdapter {
  constructor(category) {
    this.type = category.type || 'language';
  }
  
  renderEnrichedContent(enrichedData) {
    switch(this.type) {
      case 'language':
        return this.renderLanguageContent(enrichedData);
      case 'technology':
        return this.renderTechnologyContent(enrichedData);
      default:
        throw new Error(`Unknown category type: ${this.type}`);
    }
  }
  
  renderLanguageContent(data) {
    // Renderiza vocabulary, grammar, expressions, etc
    // [ Código atual extraído de app.js ]
  }
  
  renderTechnologyContent(data) {
    // Renderiza topics, concepts, commands, etc
    // [ Novo código ]
  }
}

// public/app.js (MODIFICAR)
import { CategoryAdapter } from './categoryAdapter.js';

// Quando carregar lição:
const adapter = new CategoryAdapter(currentCategory);
const html = adapter.renderEnrichedContent(lesson.enriched);
document.getElementById('content').innerHTML = html;
```

**Rationale**:
- Adapter encapsula lógica de renderização específica por tipo
- app.js permanece simples: apenas instancia adapter e chama render
- Código de renderização de idioma existente é movido (não reescrito) para adapter → mantém funcionalidade
- Fácil adicionar novos tipos: extends adapter, sem modificar app.js

**Alternatives considered**:
- ❌ **Renderizar tudo no backend (SSR)**: Projeto é SPA, adicionar SSR é mudança arquitetural grande fora do escopo
- ❌ **Manter tudo em app.js com if/else**: Arquivo vai crescer exponencialmente com novos tipos, dificulta manutenção
- ❌ **Usar framework frontend (React/Vue)**: Reescrever frontend completo fora do escopo, overhead desnecessário

---

## Decisions Summary

| Decision | Chosen Approach | Key Rationale |
|----------|----------------|---------------|
| **Testing** | Snapshot + Manual validation + Unit tests para validators | Balanceio entre coverage e simplicidade, detecta regressões críticas |
| **Prompts LLM** | System prompt específico por tipo + JSON schema explícito | Maximiza conformidade do output sem complexidade de function calling |
| **Validação** | Funções customizadas simples (required/forbidden fields) | Zero dependências, suficiente para validação estrutural |
| **Backend Dispatch** | Switch statement com default "language" | Backward compatible, explícito, fácil debugar e estender |
| **Frontend Adaptation** | Adapter pattern (categoryAdapter.js) | Separa concerns, mantém app.js simples, extensível |

---

## Technical Risks & Mitigations

### Risk 1: LLM retorna JSON malformado ou estrutura errada
**Probability**: Medium | **Impact**: High

**Mitigation**:
- Prompt engineering com instruções explícitas ("Output EXACTLY this JSON structure")
- Try-catch para parsing JSON + log de erro detalhado
- Validação pós-geração detecta campos faltantes/incorretos
- Se validação falha: salvar conteúdo parcial com flag "requires-review" (edge case da spec)
- Considerar: retry automático uma vez (spec permite tentar reprocessar)

### Risk 2: Backward compatibility quebrada por bug
**Probability**: Low | **Impact**: Critical

**Mitigation**:
- Snapshot testing antes/depois das mudanças
- Código de idioma existente movido (não reescrito) → preserva comportamento
- Default "language" garante categorias antigas sem "type" funcionam
- Testing manual obrigatório: reprocessar lição de idioma existente, comparar resultado

### Risk 3: Performance degradation por validação adicional
**Probability**: Low | **Impact**: Low

**Mitigation**:
- Validação é O(n) rápida (apenas verifica existência de campos)
- Não há deep validation de conteúdo (LLM já faz isso)
- Spec exige "tempo de processamento permanece similar (±20%)" - validar com timer em testes

### Risk 4: Frontend complexity cresce com novos tipos
**Probability**: Medium (long-term) | **Impact**: Medium

**Mitigation**:
- Adapter pattern isola lógica de renderização por tipo
- Cada tipo tem sua própria função render independente
- Se tipos crescerem muito (>5), considerar componentização mais granular

---

## Next Steps (Phase 1)

Com research completo, próximas ações:
1. ✅ Criar data-model.md: documentar estruturas JSON detalhadas para language e technology
2. ✅ Criar contracts/: JSON schemas de exemplo para validação (language-schema.json, technology-schema.json)
3. ✅ Criar quickstart.md: guia de como criar nova categoria, processar documento, verificar resultado
4. ✅ Atualizar agent context (executar update-agent-context.ps1)
5. ✅ Re-avaliar Constitution Check pós-design
