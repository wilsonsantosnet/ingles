# Data Model: Lesson Creation Process

**Feature**: 001-lesson-creation-process  
**Date**: 2026-03-20

## Overview

This document defines the data structures for lesson creation, storage, and retrieval. Key entities: Lesson (core), Document/Image Sources (inputs), Category-Specific Enrichment (language/technology), Spaced Repetition (SRS), and Processing Status (workflow state).

---

## Entity Relationship Diagram

```
┌──────────────┐
│   Category   │
│              │
│ • id         │
│ • type ──────┼──────┐
│ • name       │      │
└──────┬───────┘      │
       │              │
       │ has many     │ determines enrichment
       │              │
       ▼              ▼
┌──────────────┐  ┌─────────────────┐
│    Lesson    │  │ Enrichment      │
│              │  │ Strategy        │
│ • id         │  │                 │
│ • source ────┼──┤ • Language      │
│ • rawContent │  │   - vocabulary  │
│ • enriched   │◄─┤   - grammar     │
│ • status     │  │                 │
└──────┬───────┘  │ • Technology    │
       │          │   - topics      │
       │          │   - commands    │
       ├──────────┴─────────────────┘
       │
       ├─ has one ─► ┌───────────────┐
       │             │ OCR Metadata  │
       │             │ (if image)    │
       │             │               │
       │             │ • confidence  │
       │             │ • quality     │
       │             └───────────────┘
       │
       └─ has many ─► ┌───────────────┐
                      │ Items with    │
                      │ SRS Schedule  │
                      │               │
                      │ • nextReview  │
                      │ • easeFactor  │
                      └───────────────┘
```

---

## Core Entities

### 1. Lesson (Core Entity)

**Purpose**: Represents a single study session with content from a specific date.

**Schema**:
```typescript
interface Lesson {
  // Identity
  id: string;                    // Format: "lesson-YYYY-MM-DD"
  categoryId: string;            // FK to Category
  
  // Source tracking
  source: 'docx' | 'manual' | 'image';  // Source type
  sourceFile: string;                   // Original filename
  
  // Content
  date: string;                  // ISO date string: "YYYY-MM-DD"
  title: string;
  rawContent: string;            // Extracted text (from docx or OCR)
  
  // Enriched content (structure depends on category type)
  enriched: LanguageEnrichment | TechnologyEnrichment | null;
  
  // Validation
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  
  // Processing status
  status: ProcessingStatus;
  
  // OCR metadata (only if source === 'image')
  ocrMetadata?: OCRMetadata;
  
  // Error tracking
  enrichmentError?: {
    message: string;
    code: string;
    timestamp: string;            // ISO 8601
    retryCount: number;
    lastAttempt?: string;
  };
  
  // Timestamps
  createdAt: string;              // ISO 8601
  updatedAt: string;
  enrichedAt?: string;
}
```

**Example** (Language Lesson from Image):
```json
{
  "id": "lesson-2026-03-20",
  "categoryId": "ingles",
  "source": "image",
  "sourceFile": "whiteboard-2026-03-20.jpg",
  "date": "2026-03-20",
  "title": "Simple Past and Irregular Verbs",
  "rawContent": "Simple Past\nIrregular Verbs\n\ndrink - drank - drunk (beber)\ngo - went - gone (ir)\n...",
  "enriched": {
    "summary": "Study of Simple Past tense...",
    "vocabulary": [...],
    "grammar": [...]
  },
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  },
  "status": "enriched",
  "ocrMetadata": {
    "confidence": 0.87,
    "confidenceLevel": "good",
    "linesDetected": 42,
    "processingTime": 8.3,
    "processedAt": "2026-03-20T14:32:15Z"
  },
  "createdAt": "2026-03-20T14:30:00Z",
  "updatedAt": "2026-03-20T14:32:15Z",
  "enrichedAt": "2026-03-20T14:32:15Z"
}
```

**Storage**:
- File path: `data/categories/{categoryId}/lesson-{YYYY-MM-DD}.json`
- Index: `data/categories/{categoryId}/index.json`

**Constraints**:
- `id` MUST be unique per category
- `date` format MUST be `YYYY-MM-DD`
- `enriched` structure depends on category `type` (language vs technology)
- `ocrMetadata` MUST be present if `source === 'image'`

---

### 2. Category

**Purpose**: Organizational container for lessons with type-specific enrichment rules.

**Schema**:
```typescript
interface Category {
  id: string;                    // Unique identifier (slug)
  name: string;                  // Display name
  description: string;
  icon: string;                  // Emoji or icon code
  type: 'language' | 'technology';  // Determines enrichment strategy
  color: string;                 // Hex color code
  createdAt: string;             // ISO 8601
}
```

**Example**:
```json
{
  "id": "ingles",
  "name": "Inglês",
  "description": "Estudo de inglês técnico e conversação",
  "icon": "🇺🇸",
  "type": "language",
  "color": "#4A90E2",
  "createdAt": "2025-06-01T00:00:00.000Z"
}
```

**Storage**: `data/categories.json` (array of categories)

**Constraints**:
- `id` MUST be unique globally
- `type` determines enrichment structure (immutable after lessons created)

---

### 3. OCR Metadata (Image Source)

**Purpose**: Track OCR extraction quality and image characteristics.

**Schema**:
```typescript
interface OCRMetadata {
  confidence: number;              // Average confidence (0.0 - 1.0)
  confidenceLevel: 'excellent' | 'good' | 'acceptable' | 'poor';
  linesDetected: number;
  hasNonTextElements: boolean;     // Detected diagrams/charts
  processingTime: number;          // Seconds
  preprocessed: boolean;           // Applied image enhancement
  
  imageQuality: {
    brightness: 'low' | 'good' | 'high';
    contrast: 'low' | 'good' | 'excellent';
    resolution: {
      width: number;
      height: number;
    };
    fileSize: number;              // MB
  };
  
  processedAt: string;             // ISO 8601
}
```

**Confidence Level Thresholds**:
- `excellent`: ≥ 0.90
- `good`: 0.80 - 0.89
- `acceptable`: 0.70 - 0.79
- `poor`: < 0.70

---

### 4. Processing Status

**Purpose**: Track lesson processing workflow state.

**Type**:
```typescript
type ProcessingStatus = 
  | 'pending'              // Initial state
  | 'extracting'           // Extracting content from source
  | 'extracted'            // Content extracted successfully
  | 'enriching'            // Enriching with LLM
  | 'enriched'             // Fully enriched and valid
  | 'requires-review'      // Enriched but validation warnings
  | 'enrichment-failed'    // Enrichment failed (retryable)
  | 'extraction-failed'    // Extraction failed (terminal)
  | 'pending-enrichment';  // Manual enrichment pending
```

**State Transitions**:
```
pending → extracting → extracted → enriching → enriched
              ↓                        ↓
    extraction-failed        enrichment-failed
                                       ↓
                            pending-enrichment (manual)
```

---

## Category-Specific Enrichment Schemas

### 5A. Language Enrichment (type: "language")

**Purpose**: Educational content for language learning lessons.

**Schema**:
```typescript
interface LanguageEnrichment {
  summary: string;                 // 2-3 sentence overview
  mainTopics: string[];
  
  vocabulary: VocabularyItem[];
  grammar: GrammarTopic[];
  expressions: Expression[];
  practiceQuestions: PracticeQuestion[];
  culturalNotes: string[];
  studyTips: string[];
  originalExamples: string[];      // Original sentences from document
}

interface VocabularyItem {
  id: string;                      // Generated: "vocab-{lessonId}-{word}"
  word: string;
  translation: string;             // NEVER null/empty
  definition: string;
  examples: string[];
  pronunciation?: string;          // IPA or phonetic
  partOfSpeech: string;           // noun, verb, adjective, etc.
  synonyms: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  
  spacedRepetition: SpacedRepetitionSchedule;
}

interface GrammarTopic {
  id: string;                      // Generated: "grammar-{lessonId}-{idx}"
  topic: string;
  explanation: string;
  rules: string[];
  examples: string[];
  commonMistakes: string[];
  
  spacedRepetition: SpacedRepetitionSchedule;
}

interface Expression {
  expression: string;
  meaning: string;
  usage: string;
  examples: string[];
}

interface PracticeQuestion {
  id: string;                      // Generated: "question-{lessonId}-{idx}"
  type: 'translation' | 'fill-in-blank' | 'multiple-choice' | 'grammar';
  question: string;
  answer: string;
  explanation: string;
  tense?: string;                  // Related verb tense
  
  spacedRepetition: SpacedRepetitionSchedule;
}
```

**Validation Rules**:
- ✅ MUST have: `vocabulary`, `grammar`, `expressions` (non-empty arrays)
- ❌ MUST NOT have: `commands`, `topics`, `concepts`, `examTips`
- ⚠️ WARN if `vocabulary.translation` is null/empty

**Example**:
```json
{
  "summary": "Study of Simple Past tense with irregular verbs and conversational practice.",
  "mainTopics": ["Simple Past", "Irregular Verbs", "Time expressions"],
  "vocabulary": [
    {
      "id": "vocab-lesson-2026-03-20-drink",
      "word": "drink",
      "translation": "beber",
      "definition": "to consume liquid",
      "examples": ["I drank coffee this morning", "He drinks water every day"],
      "pronunciation": "/drɪŋk/",
      "partOfSpeech": "verb",
      "synonyms": ["consume", "gulp"],
      "difficulty": "basic",
      "spacedRepetition": { /* SRS data */ }
    }
  ],
  "grammar": [
    {
      "id": "grammar-lesson-2026-03-20-0",
      "topic": "Simple Past - Regular vs Irregular",
      "explanation": "Simple Past is used for completed actions...",
      "rules": [
        "Regular verbs: add -ed (walk → walked)",
        "Irregular verbs: unique forms (go → went)"
      ],
      "examples": ["I walked to school yesterday", "She went home early"],
      "commonMistakes": ["Using 'goed' instead of 'went'"],
      "spacedRepetition": { /* SRS data */ }
    }
  ]
}
```

---

### 5B. Technology Enrichment (type: "technology")

**Purpose**: Technical content for certification/technology lessons.

**Schema**:
```typescript
interface TechnologyEnrichment {
  topics: TechnicalTopic[];
  concepts: TechnicalConcept[];
  commands: Command[];
  scenarios: Scenario[];
  exercises: TechnicalExercise[];
  examTips: ExamTip[];
}

interface TechnicalTopic {
  name: string;
  description: string;
  category: string;               // Compute, Storage, Network, Security, etc.
  importance: 'high' | 'medium' | 'low';
}

interface TechnicalConcept {
  id: string;                     // Generated: "concept-{lessonId}-{idx}"
  concept: string;
  definition: string;
  examples: string[];
  relatedConcepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  
  spacedRepetition: SpacedRepetitionSchedule;
}

interface Command {
  command: string;                // Literal command text
  description: string;
  syntax: string;                 // Full syntax with parameters
  examples: string[];
  platform: 'Azure CLI' | 'PowerShell' | 'Portal' | 'ARM' | 'Bicep' | 'Terraform';
}

interface Scenario {
  scenario: string;
  problem: string;
  solution: string;
  explanation: string;            // Technical reasoning
}

interface TechnicalExercise {
  id: string;                     // Generated: "exercise-{lessonId}-{idx}"
  type: 'scenario-based' | 'command' | 'concept' | 'troubleshooting';
  question: string;
  answer: string;
  hint: string;
  topic: string;
  
  spacedRepetition: SpacedRepetitionSchedule;
}

interface ExamTip {
  tip: string;
  relevance: string;
  topic?: string;
}
```

**Validation Rules**:
- ✅ MUST have: `topics`, `concepts`, `commands` (non-empty arrays)
- ❌ MUST NOT have: `vocabulary`, `grammar`, `expressions`, `culturalNotes`
- ⚠️ WARN if `exercises` array is empty (should have ≥ 5)

**Example**:
```json
{
  "topics": [
    {
      "name": "Azure Virtual Machines",
      "description": "Compute service for running Windows/Linux VMs",
      "category": "Compute",
      "importance": "high"
    }
  ],
  "concepts": [
    {
      "id": "concept-lesson-2026-03-20-0",
      "concept": "VM Size",
      "definition": "Defines the CPU, memory, and disk capacity of a virtual machine",
      "examples": ["Standard_D2s_v3: 2 vCPUs, 8 GB RAM", "Standard_B1s: 1 vCPU, 1 GB RAM (burstable)"],
      "relatedConcepts": ["VM Families", "Azure Compute Units"],
      "difficulty": "beginner",
      "spacedRepetition": { /* SRS data */ }
    }
  ],
  "commands": [
    {
      "command": "az vm create",
      "description": "Create a new virtual machine",
      "syntax": "az vm create --resource-group <rg> --name <name> --image <image>",
      "examples": [
        "az vm create --resource-group myRG --name myVM --image Ubuntu2204"
      ],
      "platform": "Azure CLI"
    }
  ],
  "scenarios": [
    {
      "scenario": "VM won't start after update",
      "problem": "VM is stuck in 'Starting' state after OS update",
      "solution": "1. Stop VM from Portal\n2. Run boot diagnostics\n3. Check serial console for errors",
      "explanation": "OS update may have failed, requiring safe mode or restore"
    }
  ]
}
```

---

### 6. Spaced Repetition Schedule

**Purpose**: Track when items should be reviewed for optimal memorization.

**Schema**:
```typescript
interface SpacedRepetitionSchedule {
  interval: number;               // Days until next review
  repetitions: number;            // Number of successful reviews
  easeFactor: number;             // Difficulty multiplier (1.3 - 2.5)
  nextReview: string;             // ISO date string
  lastReviewed?: string;          // ISO 8601
}
```

**Initial Values**:
```json
{
  "interval": 1,
  "repetitions": 0,
  "easeFactor": 2.5,
  "nextReview": "2026-03-21",  // lesson.date + 1 day
  "lastReviewed": null
}
```

**Algorithm**: SuperMemo SM-2
- Correct answer: Increase interval, increment repetitions
- Wrong answer: Reset to interval=1, repetitions=0, decrease easeFactor

---

### 7. Category Index

**Purpose**: Quick lookup and filtering of lessons within a category.

**Schema**:
```typescript
interface CategoryIndex {
  categoryId: string;
  processedAt: string;            // ISO 8601 (last index update)
  totalLessons: number;
  
  lessons: LessonIndexEntry[];
}

interface LessonIndexEntry {
  id: string;
  date: string;
  title: string;
  source: 'docx' | 'manual' | 'image';
  status: ProcessingStatus;
  
  // Optional quality indicator (for images)
  ocrConfidence?: number;
  confidenceLevel?: string;
  
  // Timestamps
  createdAt: string;
  enrichedAt?: string;
}
```

**Storage**: `data/categories/{categoryId}/index.json`

**Example**:
```json
{
  "categoryId": "ingles",
  "processedAt": "2026-03-20T15:00:00Z",
  "totalLessons": 15,
  "lessons": [
    {
      "id": "lesson-2026-03-20",
      "date": "2026-03-20",
      "title": "Simple Past and Irregular Verbs",
      "source": "image",
      "status": "enriched",
      "ocrConfidence": 0.87,
      "confidenceLevel": "good",
      "createdAt": "2026-03-20T14:30:00Z",
      "enrichedAt": "2026-03-20T14:32:15Z"
    },
    {
      "id": "lesson-2026-03-11",
      "date": "2026-03-11",
      "title": "Present Perfect",
      "source": "docx",
      "status": "enriched",
      "createdAt": "2026-03-11T10:00:00Z",
      "enrichedAt": "2026-03-11T10:05:00Z"
    }
  ]
}
```

---

## Data Access Patterns

### Create Lesson
```javascript
// 1. Extract content (docx or image)
const extracted = await extractContent(filePath);

// 2. Parse and validate
const lesson = parseLesson(extracted.text, fileName);

// 3. Enrich
const enriched = await enrichWithLLM(lesson, category);

// 4. Save
saveLessonToDisk(lesson, category.id);

// 5. Update index
updateCategoryIndex(category.id, lesson);
```

### Read Lesson
```javascript
// By ID
const lesson = loadLesson(categoryId, lessonId);

// By date
const lesson = loadLesson(categoryId, `lesson-${date}`);

// All lessons in category
const lessons = loadAllLessons(categoryId);
```

### Filter Lessons
```javascript
// By source type
const imageLessons = filterLessons(categoryId, { source: 'image' });

// By OCR quality
const highQuality = filterLessons(categoryId, { 
  source: 'image', 
  minConfidence: 0.8 
});

// By status
const pending = filterLessons(categoryId, { status: 'enrichment-failed' });
```

### Update Lesson (Force Re-process)
```javascript
// 1. Load existing
const existing = loadLesson(categoryId, lessonId);

// 2. Preserve student progress (SRS data)
const srsData = extractSRSData(existing);

// 3. Re-extract and enrich
const updated = await processLesson(filePath, category, { force: true });

// 4. Restore SRS data
restoreSRSData(updated, srsData);

// 5. Save
saveLessonToDisk(updated, category.id);
```

---

## Migration & Backward Compatibility

### Existing Lessons (Pre-Image Support)

**Problem**: Existing lessons lack `source` and `ocrMetadata` fields.

**Solution**: Optional fields with defaults
```javascript
function normalizeLegacyLesson(lesson) {
  return {
    ...lesson,
    source: lesson.source || 'docx',        // Default to docx
    sourceFile: lesson.sourceFile || `${lesson.id}.docx`,
    // ocrMetadata omitted (only for images)
  };
}
```

### Schema Versioning

**Current Version**: 2.0 (adds image support)

**Future**: Add `schemaVersion` field for migrations
```json
{
  "schemaVersion": "2.0",
  "id": "lesson-2026-03-20",
  ...
}
```

---

## Validation Rules Summary

| Entity | Required Fields | Constraints | Validation |
|--------|----------------|-------------|------------|
| **Lesson** | id, categoryId, source, date, title, rawContent | `id` unique per category, `date` format YYYY-MM-DD | Schema validator |
| **LanguageEnrichment** | vocabulary, grammar, expressions | Arrays non-empty, no tech fields | `validateLanguageStructure()` |
| **TechnologyEnrichment** | topics, concepts, commands | Arrays non-empty, no language fields | `validateTechnologyStructure()` |
| **OCRMetadata** | confidence, linesDetected | Only if `source === 'image'` | Image processor |
| **Category** | id, name, type | `type` immutable after lessons exist | Category manager |

---

**Last Updated**: 2026-03-20  
**Status**: Complete  
**Next**: Create contracts/ and quickstart.md
