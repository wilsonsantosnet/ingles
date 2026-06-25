# Contract: Enrichment Dispatcher

**Module**: `src/llmEnricher.js`  
**Purpose**: Route lessons to category-type-specific enrichment strategies  
**Date**: 2026-03-20

## Interface

### Function: `enrichWithLLM(lesson: Lesson, category: Category): Promise<EnrichedLesson>`

**Description**: Enriches lesson content using Azure OpenAI with category-type-specific prompts. Detects category type (`language` vs `technology`) and dispatches to appropriate enrichment strategy. Validates output structure and detects field contamination.

**Parameters**:
```typescript
lesson: Lesson {
  id: string;
  rawContent: string;         // Extracted text from document or OCR
  title: string;
  date: string;
  // ... other fields
}

category: Category {
  id: string;
  type: 'language' | 'technology';  // Determines enrichment strategy
  name: string;
  // ... other fields
}
```

**Returns**:
```typescript
interface EnrichedLesson extends Lesson {
  enriched: LanguageEnrichment | TechnologyEnrichment;
  enrichedAt: string;              // ISO 8601 timestamp
  validation: ValidationResult;
  status: 'enriched' | 'requires-review' | 'error';
  error?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];                // Critical issues (missing required fields)
  warnings: string[];              // Non-critical issues (contamination, format)
}
```

---

## Behavior Specification

### Success Case: Language Category

**Given**: A lesson with English vocabulary content and category type `language`  
**When**: `enrichWithLLM(lesson, category)` is called  
**Then**:
- Returns enriched lesson with `LanguageEnrichment` structure
- Contains: vocabulary, grammar, expressions, practiceQuestions
- Does NOT contain: commands, topics, concepts, examTips
- `validation.isValid === true`
- `status === 'enriched'`

**Example**:
```javascript
const lesson = {
  id: 'lesson-2026-03-20',
  rawContent: 'Simple Past\n\ndrink - drank - drunk (beber)\ngo - went - gone (ir)',
  title: 'Simple Past',
  date: '2026-03-20'
};

const category = {
  id: 'ingles',
  type: 'language',
  name: 'Inglês'
};

const result = await enrichWithLLM(lesson, category);

// result.enriched:
{
  summary: "Study of Simple Past tense with irregular verbs",
  mainTopics: ["Simple Past", "Irregular Verbs"],
  vocabulary: [
    {
      word: "drink",
      translation: "beber",
      definition: "to consume liquid",
      examples: ["I drank water yesterday"],
      pronunciation: "/drɪŋk/",
      partOfSpeech: "verb",
      synonyms: ["consume"],
      difficulty: "basic"
    }
  ],
  grammar: [...],
  expressions: [...],
  practiceQuestions: [...]
}

// result.validation:
{
  isValid: true,
  errors: [],
  warnings: []
}
```

---

### Success Case: Technology Category

**Given**: A lesson with Azure VM content and category type `technology`  
**When**: `enrichWithLLM(lesson, category)` is called  
**Then**:
- Returns enriched lesson with `TechnologyEnrichment` structure
- Contains: topics, concepts, commands, scenarios, exercises, examTips
- Does NOT contain: vocabulary, grammar, expressions
- `validation.isValid === true`
- `status === 'enriched'`

**Example**:
```javascript
const lesson = {
  id: 'lesson-2026-03-20',
  rawContent: 'Azure Virtual Machines\n\nCreate VM: az vm create --resource-group myRG --name myVM',
  title: 'Azure Virtual Machines',
  date: '2026-03-20'
};

const category = {
  id: 'az104',
  type: 'technology',
  name: 'Azure AZ-104'
};

const result = await enrichWithLLM(lesson, category);

// result.enriched:
{
  topics: [
    {
      name: "Azure Virtual Machines",
      description: "IaaS compute service",
      category: "Compute",
      importance: "high"
    }
  ],
  concepts: [
    {
      concept: "VM Size",
      definition: "Defines CPU, memory, and disk capacity",
      examples: ["Standard_D2s_v3", "Standard_B1s"],
      relatedConcepts: ["VM Families"],
      difficulty: "beginner"
    }
  ],
  commands: [
    {
      command: "az vm create",
      description: "Create a new virtual machine",
      syntax: "az vm create --resource-group <rg> --name <name> --image <image>",
      examples: ["az vm create --resource-group myRG --name myVM --image Ubuntu2204"],
      platform: "Azure CLI"
    }
  ],
  scenarios: [...],
  exercises: [...],
  examTips: [...]
}
```

---

### Error Case: Unknown Category Type

**Given**: A category with invalid type (not `language` or `technology`)  
**When**: `enrichWithLLM(lesson, category)` is called  
**Then**:
- Throws error: `Unknown category type: "{type}". Valid types: language, technology`
- Does not call Azure OpenAI
- No enriched content returned

```javascript
const category = { type: 'invalid', ... };

await expect(enrichWithLLM(lesson, category)).rejects.toThrow(
  'Unknown category type: "invalid"'
);
```

---

### Warning Case: Field Contamination (Type Mismatch)

**Given**: LLM returns language fields for a technology lesson (or vice versa)  
**When**: Validation detects forbidden fields  
**Then**:
- Returns enriched lesson (does not fail)
- `validation.isValid === false`
- `validation.warnings` includes contamination details
- `status === 'requires-review'`

**Example**:
```javascript
// LLM mistakenly returns vocabulary for technology lesson
const result = await enrichWithLLM(techLesson, techCategory);

// result.validation:
{
  isValid: false,
  errors: [],
  warnings: [
    "Category type mismatch: technology lesson has 'vocabulary' field (forbidden)",
    "Category type mismatch: technology lesson has 'grammar' field (forbidden)"
  ]
}

// result.status: 'requires-review'
```

---

## Enrichment Strategy Dispatch

### Type Detection

```javascript
// In enrichWithLLM()
const categoryType = category?.type || 'language';  // Default for backward compat

const ENRICHMENT_STRATEGIES = {
  language: {
    promptBuilder: createLanguagePrompt,
    validator: validateLanguageStructure,
    requiredFields: ['vocabulary', 'grammar', 'expressions'],
    forbiddenFields: ['commands', 'topics', 'concepts', 'scenarios', 'examTips']
  },
  technology: {
    promptBuilder: createTechnologyPrompt,
    validator: validateTechnologyStructure,
    requiredFields: ['topics', 'concepts', 'commands'],
    forbiddenFields: ['vocabulary', 'grammar', 'expressions', 'culturalNotes']
  }
};

const strategy = ENRICHMENT_STRATEGIES[categoryType];
if (!strategy) {
  throw new Error(`Unknown category type: "${categoryType}". Valid types: language, technology`);
}
```

### Enrichment Flow

```
1. Detect category type (from category.type)
   ↓
2. Select strategy (promptBuilder + validator)
   ↓
3. Build type-specific prompt (createLanguagePrompt or createTechnologyPrompt)
   ↓
4. Call Azure OpenAI (callAzureOpenAI)
   ↓
5. Parse JSON response
   ↓
6. Validate structure (validateLanguageStructure or validateTechnologyStructure)
   ↓
7. Check forbidden fields (cross-validation)
   ↓
8. Return enriched lesson + validation results
```

---

## Validation Rules

### Language Category

**Required Fields** (non-empty arrays):
- `vocabulary`
- `grammar`
- `expressions`

**Forbidden Fields** (must be absent or empty):
- `commands`
- `topics`
- `concepts`
- `scenarios`
- `examTips`

**Additional Checks**:
- `vocabulary[].translation` NEVER null/empty
- `vocabulary[].examples` contains original document sentences
- `practiceQuestions[]` includes tense identification

---

### Technology Category

**Required Fields** (non-empty arrays):
- `topics`
- `concepts`
- `commands`

**Forbidden Fields** (must be absent or empty):
- `vocabulary`
- `grammar`
- `expressions`
- `culturalNotes`

**Additional Checks**:
- `exercises[]` has ≥ 5 items (warning if fewer)
- `commands[]` includes syntax and platform
- `scenarios[]` includes explanation (technical reasoning)

---

## Prompt Engineering

### Language Prompt Structure

```
You are an expert language educator.

CRITICAL: This is a LANGUAGE LEARNING lesson.

CONTENT: {rawContent}

OUTPUT EXACTLY THIS JSON:
{
  "vocabulary": [...],
  "grammar": [...],
  "expressions": [...]
}

STRICT RULES:
- Extract ALL vocabulary (no limits)
- ALWAYS fill "translation" field
- Use ORIGINAL examples from document
- DO NOT include: technical commands, server configs
- ONLY language content: vocabulary, grammar, expressions

Return ONLY the JSON (no markdown markers).
```

### Technology Prompt Structure

```
You are an expert technology instructor.

CRITICAL: This is a TECHNOLOGY CERTIFICATION lesson.

CONTENT: {rawContent}

OUTPUT EXACTLY THIS JSON:
{
  "topics": [...],
  "concepts": [...],
  "commands": [...]
}

STRICT RULES:
- Focus on technical accuracy
- Include ALL commands mentioned
- Create scenario-based exercises
- DO NOT include: vocabulary translations, grammar rules
- ONLY technical content: configs, commands, architectures

Return ONLY the JSON (no markdown markers).
```

---

## Azure OpenAI Integration

**Function**: `callAzureOpenAI(prompt: string): Promise<Object>`

**Configuration**:
```javascript
// From config.js
const { endpoint, deployment, modelName, apiVersion } = config.azureOpenAI;

const client = new AzureOpenAI({
  endpoint,
  azureADTokenProvider: async () => {
    const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
    return token.token;
  },
  deployment,
  apiVersion
});
```

**Call Parameters**:
```javascript
const response = await client.chat.completions.create({
  messages: [{ role: "user", content: prompt }],
  max_tokens: 4096,
  temperature: 0.7,
  model: modelName
});
```

**Error Handling**:
- Rate limit (429): Exponential backoff (1s, 2s, 4s)
- Service unavailable (503): Retry with backoff
- Invalid response: Return error status (no enriched content)

---

## Testing Contract

### Unit Tests

```javascript
describe('enrichWithLLM', () => {
  test('enriches language lesson with correct structure', async () => {
    const lesson = { rawContent: 'drink - drank - drunk', ... };
    const category = { type: 'language', ... };
    
    const result = await enrichWithLLM(lesson, category);
    
    expect(result.enriched).toHaveProperty('vocabulary');
    expect(result.enriched).toHaveProperty('grammar');
    expect(result.enriched).not.toHaveProperty('commands');
    expect(result.validation.isValid).toBe(true);
  });
  
  test('enriches technology lesson with correct structure', async () => {
    const lesson = { rawContent: 'az vm create ...', ... };
    const category = { type: 'technology', ... };
    
    const result = await enrichWithLLM(lesson, category);
    
    expect(result.enriched).toHaveProperty('commands');
    expect(result.enriched).toHaveProperty('topics');
    expect(result.enriched).not.toHaveProperty('vocabulary');
    expect(result.validation.isValid).toBe(true);
  });
  
  test('detects field contamination (tech fields in language)', async () => {
    // Mock LLM to return incorrect structure
    const result = await enrichWithLLM(languageLesson, languageCategory);
    
    // Assume LLM returned commands (wrong)
    if (result.enriched.commands) {
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.warnings).toContain(/forbidden/i);
      expect(result.status).toBe('requires-review');
    }
  });
  
  test('throws error for unknown category type', async () => {
    const category = { type: 'unknown', ... };
    
    await expect(enrichWithLLM(lesson, category)).rejects.toThrow(
      'Unknown category type: "unknown"'
    );
  });
});
```

### Integration Tests

```javascript
describe('End-to-End Enrichment', () => {
  test('language lesson fully enriched and validated', async () => {
    const lesson = loadTestLesson('language-sample.json');
    const category = { id: 'ingles', type: 'language', ... };
    
    const result = await enrichWithLLM(lesson, category);
    
    expect(result.status).toBe('enriched');
    expect(result.enriched.vocabulary.length).toBeGreaterThan(5);
    expect(result.enriched.vocabulary[0].translation).not.toBe(null);
  });
});
```

---

## Performance Expectations

| Metric | Target | Notes |
|--------|--------|-------|
| **Latency** | < 30s per lesson (p95) | Depends on content length |
| **Token Usage** | ~3000-5000 tokens/lesson | Input + output |
| **Success Rate** | > 98% (well-formed JSON) | LLM instruction following |
| **Validation Pass Rate** | > 90% first attempt | May have warnings |

---

**Last Updated**: 2026-03-20  
**Status**: Contract Defined (Already Partially Implemented in llmEnricher.js)  
**Implementation**: Extend for image sources
