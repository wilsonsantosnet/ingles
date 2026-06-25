# Contract: Validation Schema

**Module**: `src/schemas/schemaValidator.js`  
**Purpose**: Validate enriched lesson structure per category type  
**Date**: 2026-03-20

## Interface

### Function: `validateContent(lesson: Lesson, validator: Function): ValidationResult`

**Description**: Generic validation function that applies category-specific structure validators. Checks for required fields, correct data types, and forbidden field contamination.

**Parameters**:
```typescript
lesson: Lesson {
  enriched: LanguageEnrichment | TechnologyEnrichment | null;
  // ... other fields
}

validator: Function  // validateLanguageStructure or validateTechnologyStructure
```

**Returns**:
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];        // Critical issues (block processing)
  warnings: string[];      // Non-critical issues (log/review)
}
```

---

## Language Validation Schema

### Function: `validateLanguageStructure(lesson: Lesson): ValidationResult`

**Module**: `src/schemas/languageSchema.js`

**Required Fields**:
```javascript
{
  enriched: {
    summary: string,                          // Non-empty
    mainTopics: string[],                     // Non-empty array
    vocabulary: VocabularyItem[],             // Non-empty array
    grammar: GrammarTopic[],                  // Non-empty array
    expressions: Expression[],                // Non-empty array
    practiceQuestions: PracticeQuestion[],    // Optional but recommended
    culturalNotes: string[],                  // Optional
    studyTips: string[],                      // Optional
    originalExamples: string[]                // Optional
  }
}
```

**Vocabulary Item Schema**:
```javascript
{
  word: string,                    // Required, non-empty
  translation: string,             // Required, NEVER null/empty
  definition: string,              // Required
  examples: string[],              // Required, non-empty array
  pronunciation: string,           // Optional
  partOfSpeech: string,           // Required
  synonyms: string[],             // Optional (can be empty)
  difficulty: 'basic' | 'intermediate' | 'advanced'  // Required, enum
}
```

**Grammar Topic Schema**:
```javascript
{
  topic: string,                   // Required, non-empty
  explanation: string,             // Required
  rules: string[],                // Required, non-empty array
  examples: string[],             // Required, non-empty array
  commonMistakes: string[]        // Optional
}
```

**Expression Schema**:
```javascript
{
  expression: string,              // Required
  meaning: string,                 // Required
  usage: string,                   // Required
  examples: string[]              // Required, non-empty array
}
```

**Forbidden Fields** (must be absent or empty):
- `commands`
- `topics`
- `concepts`
- `scenarios`
- `examTips`

---

## Technology Validation Schema

### Function: `validateTechnologyStructure(lesson: Lesson): ValidationResult`

**Module**: `src/schemas/technologySchema.js`

**Required Fields**:
```javascript
{
  enriched: {
    topics: TechnicalTopic[],             // Non-empty array
    concepts: TechnicalConcept[],         // Non-empty array
    commands: Command[],                  // Can be empty (no commands in content)
    scenarios: Scenario[],                // Optional but recommended
    exercises: TechnicalExercise[],       // Recommended (≥5 items)
    examTips: ExamTip[]                   // Optional
  }
}
```

**Technical Topic Schema**:
```javascript
{
  name: string,                    // Required, non-empty
  description: string,             // Required
  category: string,               // Required (Compute, Storage, etc.)
  importance: 'high' | 'medium' | 'low'  // Required, enum
}
```

**Technical Concept Schema**:
```javascript
{
  concept: string,                 // Required, non-empty
  definition: string,              // Required
  examples: string[],             // Required, non-empty array
  relatedConcepts: string[],      // Optional
  difficulty: 'beginner' | 'intermediate' | 'advanced'  // Required, enum
}
```

**Command Schema**:
```javascript
{
  command: string,                 // Required, non-empty (literal command)
  description: string,             // Required
  syntax: string,                  // Required (full syntax)
  examples: string[],             // Required, non-empty array
  platform: string                // Required (Azure CLI, PowerShell, etc.)
}
```

**Scenario Schema**:
```javascript
{
  scenario: string,                // Required
  problem: string,                 // Required
  solution: string,                // Required
  explanation: string             // Required
}
```

**Forbidden Fields** (must be absent or empty):
- `vocabulary`
- `grammar`
- `expressions`
- `culturalNotes`

---

## Validation Behavior

### Success Case: Valid Language Structure

**Given**: A lesson with complete language enrichment structure  
**When**: `validateLanguageStructure(lesson)` is called  
**Then**:
```javascript
{
  isValid: true,
  errors: [],
  warnings: []
}
```

---

### Error Case: Missing Required Field

**Given**: A language lesson missing `vocabulary` field  
**When**: Validation runs  
**Then**:
```javascript
{
  isValid: false,
  errors: [
    "Missing required field: enriched.vocabulary",
    "Required array 'vocabulary' is empty or missing"
  ],
  warnings: []
}
```

---

### Error Case: Empty Translation (Language-Specific)

**Given**: A vocabulary item with `translation: null` or `translation: ""`  
**When**: Validation runs  
**Then**:
```javascript
{
  isValid: false,
  errors: [
    "Vocabulary item 'drink' has null or empty translation (index 0)"
  ],
  warnings: []
}
```

---

### Warning Case: Few Exercises (Technology-Specific)

**Given**: A technology lesson with only 2 exercises (recommended ≥5)  
**When**: Validation runs  
**Then**:
```javascript
{
  isValid: true,  // Not a critical error
  errors: [],
  warnings: [
    "Technology lesson has only 2 exercises (recommended: ≥5)"
  ]
}
```

---

### Error Case: Forbidden Field Contamination

**Given**: A language lesson with `commands` field (technology-specific)  
**When**: Validation runs  
**Then**:
```javascript
{
  isValid: false,
  errors: [
    "Language lesson MUST NOT have 'commands' field (category type mismatch)"
  ],
  warnings: []
}
```

---

## Implementation Example

### Generic Validator

```javascript
// src/schemas/schemaValidator.js
export function validateContent(lesson, validator) {
  if (!lesson.enriched) {
    return {
      isValid: false,
      errors: ['No enriched content found'],
      warnings: []
    };
  }
  
  // Apply category-specific validator
  return validator(lesson);
}
```

### Language Validator

```javascript
// src/schemas/languageSchema.js
export default function validateLanguageStructure(lesson) {
  const errors = [];
  const warnings = [];
  const enriched = lesson.enriched;
  
  // Check required fields
  const requiredFields = ['summary', 'mainTopics', 'vocabulary', 'grammar', 'expressions'];
  requiredFields.forEach(field => {
    if (!enriched[field]) {
      errors.push(`Missing required field: enriched.${field}`);
    } else if (Array.isArray(enriched[field]) && enriched[field].length === 0) {
      errors.push(`Required array '${field}' is empty`);
    }
  });
  
  // Validate vocabulary items
  if (enriched.vocabulary) {
    enriched.vocabulary.forEach((item, idx) => {
      if (!item.word || item.word.trim() === '') {
        errors.push(`Vocabulary item missing 'word' field (index ${idx})`);
      }
      if (!item.translation || item.translation.trim() === '') {
        errors.push(`Vocabulary item '${item.word}' has null or empty translation (index ${idx})`);
      }
      if (!item.examples || item.examples.length === 0) {
        warnings.push(`Vocabulary item '${item.word}' has no examples (index ${idx})`);
      }
      if (item.difficulty && !['basic', 'intermediate', 'advanced'].includes(item.difficulty)) {
        errors.push(`Invalid difficulty level '${item.difficulty}' for '${item.word}'`);
      }
    });
  }
  
  // Check forbidden fields (technology-specific)
  const forbiddenFields = ['commands', 'topics', 'concepts', 'scenarios', 'examTips'];
  forbiddenFields.forEach(field => {
    if (enriched[field] && enriched[field].length > 0) {
      errors.push(`Language lesson MUST NOT have '${field}' field (category type mismatch)`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

### Technology Validator

```javascript
// src/schemas/technologySchema.js
export default function validateTechnologyStructure(lesson) {
  const errors = [];
  const warnings = [];
  const enriched = lesson.enriched;
  
  // Check required fields
  const requiredFields = ['topics', 'concepts'];  // commands optional (may not exist in content)
  requiredFields.forEach(field => {
    if (!enriched[field] || enriched[field].length === 0) {
      errors.push(`Required array '${field}' is empty or missing`);
    }
  });
  
  // Validate concepts
  if (enriched.concepts) {
    enriched.concepts.forEach((item, idx) => {
      if (!item.concept || !item.definition) {
        errors.push(`Concept missing required fields (index ${idx})`);
      }
      if (item.difficulty && !['beginner', 'intermediate', 'advanced'].includes(item.difficulty)) {
        errors.push(`Invalid difficulty level '${item.difficulty}' (index ${idx})`);
      }
    });
  }
  
  // Validate commands
  if (enriched.commands) {
    enriched.commands.forEach((cmd, idx) => {
      if (!cmd.command || !cmd.syntax) {
        errors.push(`Command missing required fields (index ${idx})`);
      }
    });
  }
  
  // Check exercise count (warning only)
  if (enriched.exercises && enriched.exercises.length < 5) {
    warnings.push(`Technology lesson has only ${enriched.exercises.length} exercises (recommended: ≥5)`);
  }
  
  // Check forbidden fields (language-specific)
  const forbiddenFields = ['vocabulary', 'grammar', 'expressions', 'culturalNotes'];
  forbiddenFields.forEach(field => {
    if (enriched[field] && enriched[field].length > 0) {
      errors.push(`Technology lesson MUST NOT have '${field}' field (category type mismatch)`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Testing Contract

### Unit Tests

```javascript
describe('validateLanguageStructure', () => {
  test('passes valid language enrichment', () => {
    const lesson = {
      enriched: {
        summary: "Test summary",
        mainTopics: ["topic1"],
        vocabulary: [{ word: "test", translation: "teste", definition: "...", examples: ["..."], partOfSpeech: "noun", difficulty: "basic" }],
        grammar: [{ topic: "test", explanation: "...", rules: ["..."], examples: ["..."] }],
        expressions: [{ expression: "test", meaning: "...", usage: "...", examples: ["..."] }]
      }
    };
    
    const result = validateLanguageStructure(lesson);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  test('fails when vocabulary missing translation', () => {
    const lesson = {
      enriched: {
        summary: "Test",
        mainTopics: ["topic"],
        vocabulary: [{ word: "test", translation: "", definition: "...", examples: ["..."], partOfSpeech: "noun", difficulty: "basic" }],
        grammar: [...],
        expressions: [...]
      }
    };
    
    const result = validateLanguageStructure(lesson);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(/translation/i);
  });
  
  test('fails when forbidden tech fields present', () => {
    const lesson = {
      enriched: {
        summary: "Test",
        vocabulary: [...],
        grammar: [...],
        expressions: [...],
        commands: [{ command: "az vm create", ... }]  // Forbidden!
      }
    };
    
    const result = validateLanguageStructure(lesson);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(/MUST NOT have 'commands'/);
  });
});

describe('validateTechnologyStructure', () => {
  test('passes valid technology enrichment', () => {
    const lesson = {
      enriched: {
        topics: [{ name: "VMs", description: "...", category: "Compute", importance: "high" }],
        concepts: [{ concept: "VM Size", definition: "...", examples: ["..."], difficulty: "beginner" }],
        commands: [{ command: "az vm create", description: "...", syntax: "...", examples: ["..."], platform: "Azure CLI" }],
        exercises: []
      }
    };
    
    const result = validateTechnologyStructure(lesson);
    expect(result.isValid).toBe(true);
  });
  
  test('warns when exercise count is low', () => {
    const lesson = {
      enriched: {
        topics: [...],
        concepts: [...],
        exercises: [{ type: "concept", question: "...", answer: "...", hint: "...", topic: "..." }]  // Only 1
      }
    };
    
    const result = validateTechnologyStructure(lesson);
    expect(result.warnings).toContain(/only 1 exercises/);
  });
  
  test('fails when forbidden language fields present', () => {
    const lesson = {
      enriched: {
        topics: [...],
        concepts: [...],
        vocabulary: [...]  // Forbidden!
      }
    };
    
    const result = validateTechnologyStructure(lesson);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(/MUST NOT have 'vocabulary'/);
  });
});
```

---

## Validation Reports

### Console Output (Development)

```javascript
// In llmEnricher.js
function logValidationResults(validation) {
  if (validation.isValid) {
    console.log('✅ Validation PASSED - structure correct');
  } else {
    console.warn('⚠️ Validation FAILED - structure incorrect');
  }
  
  if (validation.errors.length > 0) {
    console.error('🚨 Errors:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    validation.warnings.forEach(warn => console.warn(`   - ${warn}`));
  }
}
```

### Frontend Display

```javascript
// In public/app.js
function renderValidationBadge(lesson) {
  if (!lesson.validation) return '';
  
  if (lesson.validation.isValid) {
    return '<span class="badge valid">✅ Valid</span>';
  } else {
    const errorCount = lesson.validation.errors.length;
    const warnCount = lesson.validation.warnings.length;
    return `<span class="badge invalid">⚠️ ${errorCount} errors, ${warnCount} warnings</span>`;
  }
}
```

---

**Last Updated**: 2026-03-20  
**Status**: Contract Defined (Already Implemented in schemas/)  
**Implementation**: Extend for image-specific validations
