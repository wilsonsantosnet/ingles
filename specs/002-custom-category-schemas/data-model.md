# Data Model: Estruturas JSON para Múltiplas Categorias

**Feature**: 002-custom-category-schemas  
**Date**: 2026-03-20

## Overview

Este documento define as estruturas de dados detalhadas para cada tipo de categoria suportado pelo sistema. Cada tipo (language, technology) possui um schema de conteúdo enriquecido específico que o LLM deve gerar e o sistema deve validar.

---

## Category Configuration Schema

**File**: `data/categories.json`

```json
{
  "categories": [
    {
      "id": "string (required, unique)",
      "name": "string (required)",
      "description": "string (required)",
      "icon": "string (optional, emoji)",
      "type": "string (required: 'language' | 'technology')"
    }
  ]
}
```

### Fields

- **id**: Identificador único da categoria (slug, ex: "ingles", "az104")
- **name**: Nome display da categoria (ex: "English", "Azure AZ-104")
- **description**: Descrição breve da categoria
- **icon**: Emoji representativo (opcional)
- **type**: **[NOVO]** Tipo da categoria que determina a estrutura de enriquecimento
  - `"language"`: Estrutura para aprendizado de idiomas
  - `"technology"`: Estrutura para certificações/tecnologia
  - **Default**: Se ausente, assume "language" (backward compatibility)

### Example

```json
{
  "categories": [
    {
      "id": "ingles",
      "name": "English",
      "description": "Aprendizado de inglês com repetição espaçada",
      "icon": "🇬🇧",
      "type": "language"
    },
    {
      "id": "az104",
      "name": "Azure AZ-104",
      "description": "Microsoft Azure Administrator certification",
      "icon": "☁️",
      "type": "technology"
    }
  ]
}
```

---

## Lesson Base Schema (Common Structure)

**Files**: `data/categories/<categoryId>/lesson-YYYY-MM-DD.json`

Estrutura base comum a todos os tipos de categoria:

```json
{
  "id": "string (auto-generated UUID)",
  "categoryId": "string (foreign key to category.id)",
  "title": "string (extracted from document)",
  "createdAt": "ISO 8601 datetime",
  "processedAt": "ISO 8601 datetime",
  "sourceDocument": "string (filename)",
  "enriched": {
    /* Type-specific structure - see below */
  },
  "metadata": {
    "reviewCount": "number (default: 0)",
    "lastReviewedAt": "ISO 8601 datetime | null",
    "spacedRepetitionData": {
      "interval": "number (days)",
      "easeFactor": "number (2.5 default)",
      "nextReviewDate": "ISO 8601 datetime"
    }
  }
}
```

### Common Fields

- **id**: UUID único da lição
- **categoryId**: Referência à categoria (deve existir em categories.json)
- **title**: Título extraído do documento (geralmente primeira linha/heading)
- **createdAt**: Data/hora de criação do registro
- **processedAt**: Data/hora do último processamento LLM
- **sourceDocument**: Nome do arquivo Word original
- **enriched**: **Estrutura varia por category.type** (ver seções abaixo)
- **metadata**: Dados de repetição espaçada (comum a todos os tipos)

---

## Type: Language (Idiomas)

**Usado quando**: `category.type === "language"`

### Full Schema

```json
{
  "enriched": {
    "vocabulary": [
      {
        "word": "string (required)",
        "translation": "string (required)",
        "definition": "string (required)",
        "examples": ["string (array, min 1)"],
        "pronunciation": "string (IPA ou similar, optional)",
        "partOfSpeech": "string (noun/verb/adjective/etc, optional)",
        "synonyms": ["string (array, optional)"],
        "difficulty": "string (beginner/intermediate/advanced, optional)"
      }
    ],
    "grammar": [
      {
        "topic": "string (required, ex: 'Present Perfect')",
        "explanation": "string (required)",
        "rules": ["string (array, min 1)"],
        "examples": ["string (array, min 1)"],
        "commonMistakes": ["string (array, optional)"]
      }
    ],
    "expressions": [
      {
        "expression": "string (required, idiom/phrase)",
        "meaning": "string (required, literal translation)",
        "usage": "string (required, context/when to use)",
        "examples": ["string (array, min 1)"]
      }
    ],
    "exercises": [
      {
        "type": "string (fill-blank/translation/multiple-choice/etc)",
        "question": "string (required)",
        "answer": "string (required)",
        "hint": "string (optional)"
      }
    ],
    "culturalNotes": [
      {
        "topic": "string (required)",
        "content": "string (required, cultural context/background)"
      }
    ]
  }
}
```

### Field Definitions

#### vocabulary (array, required)

Lista de palavras/termos chave extraídos do conteúdo.

- **word**: Palavra no idioma-alvo (ex: "ephemeral")
- **translation**: Tradução para português
- **definition**: Definição/explicação no contexto
- **examples**: Frases de exemplo usando a palavra
- **pronunciation**: Pronúncia (IPA, fonética simplificada, ou áudio reference)
- **partOfSpeech**: Classe gramatical (substantivo, verbo, adjetivo, etc)
- **synonyms**: Sinônimos no idioma-alvo
- **difficulty**: Nível de dificuldade estimado

**Validation**: Mínimo 1 entrada, campos "word", "translation", "definition" obrigatórios

#### grammar (array, required)

Tópicos gramaticais do conteúdo.

- **topic**: Nome do tópico (ex: "Present Perfect", "Passive Voice")
- **explanation**: Explicação do conceito gramatical
- **rules**: Lista de regras/padrões
- **examples**: Exemplos práticos de uso
- **commonMistakes**: Erros frequentes (útil para exercícios)

**Validation**: Mínimo 1 entrada, campos "topic", "explanation", "rules", "examples" obrigatórios

#### expressions (array, required)

Expressões idiomáticas, phrasal verbs, collocations.

- **expression**: Expressão completa (ex: "break the ice")
- **meaning**: Significado literal/tradução
- **usage**: Quando/como usar
- **examples**: Situações de uso real

**Validation**: Pode estar vazio se conteúdo não tem idioms, mas array deve existir

#### exercises (array, required)

Exercícios gerados automaticamente para prática.

- **type**: Tipo de exercício (fill-blank, translation, multiple-choice, etc)
- **question**: Enunciado da questão
- **answer**: Resposta correta
- **hint**: Dica opcional

**Validation**: Mínimo 3 exercícios recomendado, campos "type", "question", "answer" obrigatórios

#### culturalNotes (array, optional)

Notas sobre contexto cultural relevante.

- **topic**: Assunto da nota
- **content**: Explicação do contexto cultural

**Validation**: Array pode estar vazio se conteúdo não tem aspectos culturais relevantes

### Example (Language)

```json
{
  "enriched": {
    "vocabulary": [
      {
        "word": "serendipity",
        "translation": "serendipidade, descoberta feliz",
        "definition": "The occurrence of events by chance in a happy or beneficial way",
        "examples": [
          "Finding that book was pure serendipity",
          "Their meeting was a serendipity that changed both lives"
        ],
        "pronunciation": "/ˌserənˈdɪpɪti/",
        "partOfSpeech": "noun",
        "synonyms": ["fortune", "luck", "coincidence"],
        "difficulty": "advanced"
      }
    ],
    "grammar": [
      {
        "topic": "Present Perfect vs Simple Past",
        "explanation": "Present Perfect connects past to present; Simple Past is completed action",
        "rules": [
          "Use Present Perfect for experience without specific time",
          "Use Simple Past for specific time in the past"
        ],
        "examples": [
          "I have visited Paris (experience, no time)",
          "I visited Paris in 2020 (specific time)"
        ],
        "commonMistakes": [
          "Saying 'I have visited Paris yesterday' (incorrect - use Simple Past with 'yesterday')"
        ]
      }
    ],
    "expressions": [
      {
        "expression": "break the ice",
        "meaning": "quebrar o gelo",
        "usage": "To make people feel more comfortable in social situation",
        "examples": [
          "He told a joke to break the ice at the meeting",
          "A fun activity can help break the ice with new colleagues"
        ]
      }
    ],
    "exercises": [
      {
        "type": "fill-blank",
        "question": "I ____ (visit) London three times.",
        "answer": "have visited",
        "hint": "Use present perfect for experience"
      }
    ],
    "culturalNotes": [
      {
        "topic": "British vs American English",
        "content": "In British English, 'flat' means apartment; in American English, 'apartment' is standard. Both are understood globally."
      }
    ]
  }
}
```

---

## Type: Technology (Certificações/Tecnologia)

**Usado quando**: `category.type === "technology"`

### Full Schema

```json
{
  "enriched": {
    "topics": [
      {
        "name": "string (required)",
        "description": "string (required)",
        "category": "string (optional, ex: 'Compute/Storage/Network')",
        "importance": "string (high/medium/low, optional)"
      }
    ],
    "concepts": [
      {
        "concept": "string (required, termo técnico)",
        "definition": "string (required)",
        "examples": ["string (array, min 1)"],
        "relatedConcepts": ["string (array, optional)"],
        "difficulty": "string (beginner/intermediate/advanced, optional)"
      }
    ],
    "commands": [
      {
        "command": "string (required, comando/código)",
        "description": "string (required)",
        "syntax": "string (required, formato/parâmetros)",
        "examples": ["string (array, min 1)"],
        "platform": "string (optional, ex: 'Azure CLI/PowerShell/Portal')"
      }
    ],
    "scenarios": [
      {
        "scenario": "string (required, título do cenário)",
        "problem": "string (required, descrição do problema)",
        "solution": "string (required, solução passo-a-passo)",
        "explanation": "string (required, por que funciona)"
      }
    ],
    "exercises": [
      {
        "type": "string (scenario-based/command/concept/etc)",
        "question": "string (required)",
        "answer": "string (required)",
        "hint": "string (optional)",
        "topic": "string (optional, qual tópico relacionado)"
      }
    ],
    "examTips": [
      {
        "tip": "string (required, dica para prova)",
        "relevance": "string (required, por que importante)",
        "topic": "string (optional, tópico relacionado)"
      }
    ]
  }
}
```

### Field Definitions

#### topics (array, required)

Tópicos técnicos principais cobertos no conteúdo.

- **name**: Nome do tópico (ex: "Azure Virtual Machines", "ARM Templates")
- **description**: Descrição breve do que é o tópico
- **category**: Categoria superior (ex: "Compute", "Storage", "Networking")
- **importance**: Peso do tópico (high/medium/low) - útil para priorização de estudo

**Validation**: Mínimo 1 entrada, campos "name", "description" obrigatórios

#### concepts (array, required)

Conceitos técnicos chave que precisam ser compreendidos.

- **concept**: Termo técnico (ex: "Availability Set", "Load Balancer", "VNet Peering")
- **definition**: O que significa
- **examples**: Exemplos de uso real ou analogias
- **relatedConcepts**: Conceitos relacionados (cria mapa conceitual)
- **difficulty**: Nível de complexidade

**Validation**: Mínimo 1 entrada, campos "concept", "definition", "examples" obrigatórios

#### commands (array, required)

Comandos, código ou ações práticas.

- **command**: Comando literal (ex: "az vm create", "New-AzVM")
- **description**: O que o comando faz
- **syntax**: Sintaxe completa com parâmetros
- **examples**: Exemplos práticos de uso
- **platform**: Onde executar (Azure CLI, PowerShell, Portal, ARM template, etc)

**Validation**: Pode estar vazio se conteúdo é puramente conceitual, mas array deve existir

#### scenarios (array, required)

Cenários práticos de troubleshooting ou implementação.

- **scenario**: Título do cenário (ex: "VM cannot connect to internet")
- **problem**: Descrição completa do problema
- **solution**: Passo-a-passo da solução
- **explanation**: Por que a solução funciona (fundamento técnico)

**Validation**: Mínimo 1 entrada recomendado (cenários são importantes para certificações)

#### exercises (array, required)

Questões tipo exame de certificação.

- **type**: Tipo de questão (scenario-based, command-completion, concept-definition, etc)
- **question**: Enunciado da questão
- **answer**: Resposta correta (ou explicação)
- **hint**: Dica opcional
- **topic**: Qual tópico a questão testa

**Validation**: Mínimo 5 exercícios recomendado, campos "type", "question", "answer" obrigatórios

#### examTips (array, optional)

Dicas específicas para exames de certificação.

- **tip**: Dica prática (ex: "Always check NSG rules before connectivity troubleshooting")
- **relevance**: Por que é importante
- **topic**: Tópico relacionado

**Validation**: Array pode estar vazio, mas inclusion é valorizada para categorias de certificação

### Example (Technology)

```json
{
  "enriched": {
    "topics": [
      {
        "name": "Azure Virtual Networks (VNet)",
        "description": "Private network infrastructure in Azure for resource communication",
        "category": "Networking",
        "importance": "high"
      }
    ],
    "concepts": [
      {
        "concept": "VNet Peering",
        "definition": "Connection between two VNets allowing private communication using Azure backbone",
        "examples": [
          "Connect VNets in different regions (Global VNet Peering)",
          "Share resources across subscriptions without internet exposure"
        ],
        "relatedConcepts": ["VPN Gateway", "Private Endpoint", "Service Endpoint"],
        "difficulty": "intermediate"
      }
    ],
    "commands": [
      {
        "command": "az network vnet peering create",
        "description": "Creates a VNet peering connection",
        "syntax": "az network vnet peering create --name <peering-name> --resource-group <rg> --vnet-name <vnet1> --remote-vnet <vnet2-id> --allow-vnet-access",
        "examples": [
          "az network vnet peering create --name vnet1-to-vnet2 --resource-group myRG --vnet-name vnet1 --remote-vnet /subscriptions/.../vnet2 --allow-vnet-access"
        ],
        "platform": "Azure CLI"
      }
    ],
    "scenarios": [
      {
        "scenario": "VM in VNet cannot reach VM in peered VNet",
        "problem": "Two VNets are peered but resources cannot communicate",
        "solution": "1. Verify both directions of peering exist (peering is not transitive)\n2. Check NSG rules on both VMs\n3. Verify 'Allow forwarded traffic' is enabled if using NVA\n4. Check route tables for custom routes blocking traffic",
        "explanation": "VNet peering requires bidirectional setup. Even if VNet1->VNet2 exists, VNet2->VNet1 must also be configured. NSGs and custom routes can block peered traffic."
      }
    ],
    "exercises": [
      {
        "type": "scenario-based",
        "question": "You have VNet1 (10.0.0.0/16) peered to VNet2 (10.1.0.0/16), which is peered to VNet3 (10.2.0.0/16). Can VM in VNet1 reach VM in VNet3?",
        "answer": "No, VNet peering is not transitive. Direct peering between VNet1 and VNet3 is required.",
        "hint": "Think about peering transitivity",
        "topic": "VNet Peering"
      }
    ],
    "examTips": [
      {
        "tip": "VNet peering is NOT transitive - this is a common exam question",
        "relevance": "Frequently tested scenario to verify understanding of peering limitations",
        "topic": "VNet Peering"
      }
    ]
  }
}
```

---

## Validation Rules

### Language Type Validation

**Required sections**: `vocabulary`, `grammar`, `expressions`, `exercises`, `culturalNotes`  
**Forbidden sections**: `topics`, `concepts`, `commands`, `scenarios`, `examTips`

**Field-level validation**:
- `vocabulary`: At least 1 entry, each with `word`, `translation`, `definition`
- `grammar`: At least 1 entry, each with `topic`, `explanation`, `rules`, `examples`
- `exercises`: At least 3 entries recommended

### Technology Type Validation

**Required sections**: `topics`, `concepts`, `commands`, `scenarios`, `exercises`, `examTips`  
**Forbidden sections**: `vocabulary`, `grammar`, `expressions`, `culturalNotes`, `pronunciation`

**Field-level validation**:
- `topics`: At least 1 entry, each with `name`, `description`
- `concepts`: At least 1 entry, each with `concept`, `definition`, `examples`
- `scenarios`: At least 1 entry recommended
- `exercises`: At least 5 entries recommended

### Error Reporting Format

When validation fails, return structure:

```json
{
  "isValid": false,
  "categoryType": "technology",
  "errors": [
    {
      "type": "missing-required-field",
      "field": "topics",
      "message": "Required field 'topics' is missing for technology category"
    },
    {
      "type": "unexpected-field",
      "field": "vocabulary",
      "message": "Field 'vocabulary' should not exist in technology category"
    }
  ],
  "warnings": [
    {
      "type": "low-count",
      "field": "exercises",
      "message": "Only 2 exercises found, minimum 5 recommended for technology categories"
    }
  ]
}
```

---

## Migration Notes

### Existing Data (Backward Compatibility)

- **Categorias sem campo "type"**: Assume `"language"` por padrão (FR-008)
- **Lições antigas**: Mantêm estrutura atual, não requerem migração
- **Novo processamento**: Usa estrutura baseada em `category.type` atual

### Future Types (Extensibility)

Para adicionar novos tipos (ex: "exam-prep", "mathematics"):

1. Definir schema completo neste documento
2. Adicionar prompt específico em `llmEnricher.js`
3. Adicionar função de validação em `schemaValidator.js`
4. Adicionar renderização em `categoryAdapter.js`
5. Atualizar documentação de tipos válidos

**Design consideration**: Manter types simples e bem distintos. Evitar overlap de estruturas (ex: não criar tipo que mistura vocabulário + comandos).

---

## Schema Evolution

### Versioning Strategy

**Current version**: 1.0 (initial implementation)

Se estruturas precisarem mudar:
- Adicionar campo `enriched.schemaVersion` para tracking
- Manter backward compatibility com versões antigas
- Documentar breaking changes claramente

### Adding Fields

**Safe additions** (non-breaking):
- Novos campos opcionais em estruturas existentes
- Novas seções opcionais em types existentes

**Breaking changes** (require migration):
- Remover campos obrigatórios
- Renomear campos
- Mudar types de dados
- Alterar required → optional ou vice-versa

---

## Summary

| Category Type | Key Sections | Primary Use Case | Required Fields |
|---------------|--------------|------------------|-----------------|
| **language** | vocabulary, grammar, expressions | Aprendizado de idiomas | vocabulary, grammar, expressions, exercises |
| **technology** | topics, concepts, commands, scenarios | Certificações técnicas | topics, concepts, exercises |

**Validation approach**: Structural (field presence), não deep content validation

**Extensibility**: Adicionar novos tipos requer schema definition + implementation (multi-file changes)

**Backward compatibility**: Garantida por default type "language" + estrutura existente preservada
