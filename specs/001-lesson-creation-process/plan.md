# Implementation Plan: Lesson Creation Process with Image Support

**Branch**: `001-lesson-creation-process` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-lesson-creation-process/spec.md`

## Summary

This feature enables professors to create structured lessons from documents or images with automated enrichment via Azure OpenAI. The system processes inputs from designated folders, extracts content (using OCR for images via Azure Computer Vision), validates structure, enriches content with educational enhancements, and configures spaced repetition settings. Key innovation: specialized enrichment strategies by category type (language vs technology) with appropriate validation schemas.

**Primary Requirements**:
- Document and image processing pipeline with validation
- OCR text extraction for photos/scanned content (Azure Computer Vision)
- Category-type-aware enrichment (language: vocabulary/grammar/expressions; technology: topics/commands/scenarios)
- Batch processing with incremental updates
- Spaced repetition configuration
- Graceful error handling with retry support

## Technical Context

**Language/Version**: Node.js 20+ (ES Modules)  
**Primary Dependencies**: 
- `openai` (Azure OpenAI integration - already configured)
- `@azure/identity` (Azure AD authentication - already configured)
- `@azure/ai-vision` (Azure Computer Vision for OCR - **NEW DEPENDENCY**)
- `mammoth` (Word document extraction - already in use)
- `sharp` (Image preprocessing and validation - **NEW DEPENDENCY**)

**Storage**: JSON files in category-specific folders (`data/categories/{categoryId}/`)  
**Testing**: Node.js native assertions + snapshot testing (no framework yet)  
**Target Platform**: Local CLI + Azure Web App (Node.js runtime)  
**Project Type**: CLI utility with web service backend  
**Performance Goals**: 
- Document processing: <5 min for 3-5 page documents
- Image OCR: <2 min for typical classroom photos
- Batch processing: handle 5+ documents concurrently

**Constraints**: 
- Azure OpenAI rate limits (enforce retry logic)
- Azure Computer Vision API quotas (monitor usage)
- Preserve student progress data during lesson updates
- 100% backward compatibility with existing language lessons

**Scale/Scope**: 
- 2-3 categories initially (ingles, az104)
- ~20-30 lessons per category per year
- Single professor workflow (no multi-user concurrency initially)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Project Constitution Status**: Constitution template exists but not yet ratified (`.specify/memory/constitution.md` is blank template).

**Provisional Gates** (to be formalized):
1. ✅ **No Breaking Changes**: Feature maintains 100% backward compatibility with existing language lessons
2. ✅ **Clear Separation of Concerns**: Image processing, OCR, enrichment are separate, testable modules
3. ⚠️ **Azure Dependency**: Adding Azure Computer Vision introduces new external dependency (JUSTIFIED: required for core image OCR functionality)
4. ✅ **Incremental Processing**: Batch mode skips already-processed files (no redundant work)
5. ✅ **Error Isolation**: Individual document failures don't block batch processing

**Violations that require justification**: None. All design decisions align with good engineering practices.

## Project Structure

### Documentation (this feature)

```text
specs/001-lesson-creation-process/
├── spec.md              # Feature specification (existing)
├── plan.md              # This file (implementation roadmap)
├── research.md          # Phase 0: Technical research and decisions
├── data-model.md        # Phase 1: Data structures and schemas
├── quickstart.md        # Phase 1: Developer onboarding guide
├── contracts/           # Phase 1: API contracts and interfaces
│   ├── ocr-service.md       # Azure Computer Vision integration contract
│   ├── enrichment-dispatch.md  # Category type routing interface
│   └── validation-schema.md    # JSON schema validation contract
├── tasks.md             # Phase 2: NOT created by /speckit.plan
└── checklists/
    └── requirements.md  # FR checklist (existing)
```

### Source Code (repository root)

```text
src/
├── models/                    # [EXISTING]
├── services/                  # [NEW - organize business logic]
│   ├── documentProcessor.js      # Document extraction orchestration
│   ├── imageProcessor.js         # Image validation, preprocessing, OCR
│   └── enrichmentDispatcher.js   # Route by category type
├── processors/                # [RENAME from current flat structure]
│   ├── ocrExtractor.js          # Azure Computer Vision integration
│   ├── textExtractor.js         # Document text extraction (from wordExtractor.js)
│   └── contentParser.js         # Parse extracted text (from wordExtractor.js)
├── schemas/                   # [EXISTING - already has validators]
│   ├── languageSchema.js        # Language enrichment structure
│   ├── technologySchema.js      # Technology enrichment structure
│   └── schemaValidator.js       # Generic validator utility
├── llmEnricher.js             # [EXISTING - already has type dispatch]
├── categoryManager.js         # [EXISTING]
├── lessonManager.js           # [EXISTING]
├── spacedRepetition.js        # [EXISTING]
├── processDocuments.js        # [EXISTING - refactor to use services/]
├── config.js                  # [EXISTING - add Computer Vision config]
└── server.js                  # [EXISTING]

tests/
├── unit/                      # [NEW]
│   ├── imageProcessor.test.js
│   ├── ocrExtractor.test.js
│   └── enrichmentDispatcher.test.js
├── integration/               # [NEW]
│   ├── document-pipeline.test.js
│   └── image-pipeline.test.js
└── snapshots/                 # [NEW]
    └── language-lesson-baseline.json

data/
├── categories.json            # [EXISTING - already has type field]
└── categories/
    ├── ingles/                # [EXISTING - language type]
    │   ├── index.json
    │   └── lesson-*.json
    └── az104/                 # [EXISTING - technology type]
        ├── index.json
        └── lesson-*.json

docs/                          # [EXISTING - input folder]
├── ingles/                    # Document and image inputs
└── az104/                     # Document and image inputs

public/                        # [EXISTING - frontend]
├── app.js
├── manage.js
└── index.html
```

**Structure Decisions**:
1. **services/ folder**: Organize orchestration logic separate from low-level processing
2. **processors/ folder**: Rename and consolidate extraction logic (OCR, text, parsing)
3. **tests/ hierarchy**: Separate unit, integration, and snapshot tests for clarity
4. **Preserve existing structure**: Minimal disruption to working code (refactor incrementally)

## Complexity Tracking

> **No violations to justify** - all architectural decisions follow best practices.

---

## Phase 0: Research & Unresolved Questions

### Research Task 1: Azure Computer Vision OCR Integration

**Question**: What's the optimal Azure Computer Vision API approach for classroom image OCR (printed + handwritten text)?

#### Decision: Use Azure AI Vision v4.0 Read API

**Rationale**:
- **Read API** is optimized for document text extraction vs general OCR
- Supports both printed and handwritten text (required per FR-022)
- Returns confidence scores per line (enables quality validation per FR-024)
- Handles multi-language content (English + Portuguese for translations)
- Async operation model fits batch processing architecture

**API Configuration**:
```javascript
// Using @azure/ai-vision-image-analysis v1.0+
import { ImageAnalysisClient } from "@azure/ai-vision-image-analysis";
import { AzureKeyCredential } from "@azure/core-auth";

const client = new ImageAnalysisClient(
  process.env.VISION_ENDPOINT,
  new AzureKeyCredential(process.env.VISION_KEY)
);

// OR use Azure AD (preferred for production)
import { DefaultAzureCredential } from "@azure/identity";
const credential = new DefaultAzureCredential();
```

**Quality Thresholds** (FR-024):
- **Minimum confidence**: 0.7 average across all lines (70%)
- **Warning threshold**: 0.8 (suggest image improvement)
- **Excellent threshold**: 0.9+ (no warnings)

**Image Preprocessing** (use `sharp`):
1. Resize if >4MB (API limit is 4MB)
2. Convert to JPEG if PNG is >2MB (optimization)
3. Validate dimensions (min 50x50px, max 10000x10000px)
4. Basic contrast/brightness adjustment if confidence <0.7 on first attempt

**Alternatives Considered**:
- ❌ **Tesseract.js**: Open-source but lower accuracy on handwritten text, no confidence scores
- ❌ **Azure Form Recognizer**: Optimized for structured forms (invoices, receipts), overkill for free-form classroom notes
- ❌ **Google Cloud Vision**: Requires Google Cloud account, less integrated with existing Azure ecosystem

**Cost Considerations**:
- Read API: $1.50 per 1000 images (S1 tier)
- Expected usage: ~20-40 images/month/category = $0.03-$0.06/month
- Budget: Negligible for current scale

---

### Research Task 2: Image Validation Strategy

**Question**: How to detect and reject unusable images before expensive OCR calls?

#### Decision: Multi-Stage Pre-Flight Validation

**Stage 1: File Validation** (immediate, no external calls):
```javascript
// Using `sharp` library
const metadata = await sharp(imagePath).metadata();

// Checks:
✓ Format: JPEG or PNG only (FR-021)
✓ Size: 50KB - 20MB (practical limits)
✓ Dimensions: 800x600 min (readable), 10000x10000 max (API limit)
✓ Color space: RGB or Grayscale (reject CMYK, exotic formats)
```

**Stage 2: Content Validation** (fast, local):
```javascript
// Using `sharp` statistics
const stats = await sharp(imagePath).stats();

// Checks:
✓ Not blank: stdDev > 5 per channel (detects all-black/white images)
✓ Not excessively dark: mean luminance > 20
✓ Not overexposed: mean luminance < 235
✓ Sufficient contrast: (max - min) > 50
```

**Stage 3: OCR Quality Check** (after extraction):
```javascript
// From Azure Computer Vision response
const avgConfidence = lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;

if (avgConfidence < 0.7) {
  return {
    status: 'low-quality',
    confidence: avgConfidence,
    warning: 'Image quality too low for accurate extraction - please provide clearer image',
    textExtracted: text, // Still return text for manual review
  };
}
```

**Error Messages** (FR-014):
- Stage 1 fail: "Image format not supported - please use JPEG or PNG"
- Stage 2 fail: "Image too dark/bright/blurry - please retake photo with better lighting"
- Stage 3 fail: "Text extraction confidence {X}% - review extracted content for accuracy"

**Rationale**: Fail fast on format/quality issues before API calls (cost + latency optimization).

---

### Research Task 3: Category Type Enrichment Dispatch

**Question**: How to ensure 100% type-safe enrichment routing without duplicate code?

#### Decision: Strategy Pattern with Validator Pairing

**Architecture**:
```javascript
// Already implemented in llmEnricher.js (spec 002)
// Extending for image sources

const ENRICHMENT_STRATEGIES = {
  language: {
    promptBuilder: createLanguagePrompt,
    validator: validateLanguageStructure,
    requiredFields: ['vocabulary', 'grammar', 'expressions'],
    forbiddenFields: ['commands', 'topics', 'concepts'],
  },
  technology: {
    promptBuilder: createTechnologyPrompt,
    validator: validateTechnologyStructure,
    requiredFields: ['topics', 'concepts', 'commands'],
    forbiddenFields: ['vocabulary', 'grammar', 'expressions'],
  },
};

export async function enrichWithLLM(lesson, category) {
  const strategyKey = category?.type || 'language'; // Default for backward compat
  
  const strategy = ENRICHMENT_STRATEGIES[strategyKey];
  if (!strategy) {
    throw new Error(`Unknown category type: ${strategyKey}`);
  }
  
  const prompt = strategy.promptBuilder(lesson);
  const enriched = await callAzureOpenAI(prompt);
  
  // Validate structure
  const validation = validateContent({ enriched }, strategy.validator);
  
  // Cross-validate forbidden fields
  const hasForbidden = strategy.forbiddenFields.some(f => enriched[f]?.length > 0);
  if (hasForbidden) {
    validation.warnings.push(`Category type mismatch: ${strategyKey} lesson has fields from other type`);
  }
  
  return { ...lesson, enriched, validation };
}
```

**Type Detection** (from `data/categories.json`):
```javascript
// CategoryManager already supports this (spec 002)
{
  "id": "ingles",
  "type": "language", // ← Used for routing
  ...
}
```

**Validation** (FR-023, FR-026):
- ✅ Language categories: MUST have vocabulary, grammar, expressions
- ✅ Language categories: MUST NOT have commands, topics, concepts
- ✅ Technology categories: MUST have topics, concepts, commands
- ✅ Technology categories: MUST NOT have vocabulary, grammar, expressions
- ⚠️ Mixed content warning: Suggest category type review if mismatched

**Testing Strategy**:
```javascript
// Snapshot test per type
const languageLesson = processLesson('docs/ingles/sample.docx');
expect(languageLesson.enriched).toHaveProperty('vocabulary');
expect(languageLesson.enriched).not.toHaveProperty('commands');

const techLesson = processLesson('docs/az104/sample.docx');
expect(techLesson.enriched).toHaveProperty('commands');
expect(techLesson.enriched).not.toHaveProperty('vocabulary');
```

---

### Research Task 4: Source Type Tracking and Metadata

**Question**: How to track lesson source (docx vs image) for filtering and quality indicators?

#### Decision: Extend Lesson Metadata Schema

**New Fields** (FR-025):
```json
{
  "id": "lesson-2026-03-20",
  "source": "image",              // NEW: "docx" | "manual" | "image"
  "sourceFile": "whiteboard-notes-2026-03-20.jpg",
  "ocrMetadata": {                // NEW: Only present if source=image
    "confidence": 0.87,
    "linesDetected": 42,
    "hasNonTextElements": true,   // Detected charts/diagrams
    "imageQuality": "good",       // low/medium/good/excellent
    "processedAt": "2026-03-20T14:32:15Z"
  },
  "rawContent": "...",           // EXISTING: Extracted text (OCR or docx)
  "enriched": { ... },           // EXISTING
  "validation": { ... }          // EXISTING
}
```

**UI Indicators** (in frontend):
```javascript
// In app.js lesson list
const sourceIcons = {
  docx: '📄',
  manual: '✍️',
  image: '📸',
};

// Display: "📸 Lesson 2026-03-20 (OCR confidence: 87%)"
```

**Filtering Support**:
```javascript
// In lessonManager.js
filterLessons(categoryId, { sourceType: 'image', minConfidence: 0.8 });
```

---

### Research Task 5: Retry Logic for Enrichment Failures

**Question**: How to handle Azure OpenAI downtime without losing extracted content?

#### Decision: Status-Based Retry with Content Preservation (FR-013, FR-020)

**Enhanced Status Flow**:
```
pending → extracting → extracted → enriching → enriched
                            ↓           ↓
                    extraction-failed  enrichment-failed (retryable)
                                       pending-enrichment (manual)
```

**Implementation**:
```javascript
// In processDocuments.js
async function processDocument(filePath, category) {
  try {
    // Step 1: Extract (always saves even if enrichment fails)
    const extracted = await extractContent(filePath);
    const lesson = { ...parsed, status: 'extracted', rawContent: extracted };
    
    // Save immediately with extracted content
    saveLessonToDisk(lesson);
    
    // Step 2: Enrich (can fail and retry later)
    try {
      const enriched = await enrichWithLLM(lesson, category);
      lesson.enriched = enriched;
      lesson.status = 'enriched';
    } catch (enrichError) {
      lesson.status = 'pending-enrichment';
      lesson.enrichmentError = {
        message: enrichError.message,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };
    }
    
    // Save with final status
    saveLessonToDisk(lesson);
    
  } catch (extractError) {
    // Fatal: can't recover, mark as failed
    console.error(`Failed to extract ${filePath}:`, extractError);
    return { status: 'extraction-failed', error: extractError.message };
  }
}

// Retry command (new)
async function retryEnrichment(lessonId, categoryId) {
  const lesson = loadLessonFromDisk(lessonId, categoryId);
  
  if (lesson.status !== 'pending-enrichment') {
    throw new Error(`Lesson ${lessonId} is not pending enrichment (status: ${lesson.status})`);
  }
  
  const category = categoryManager.getCategory(categoryId);
  const enriched = await enrichWithLLM(lesson, category);
  
  lesson.enriched = enriched;
  lesson.status = 'enriched';
  lesson.enrichmentError = null;
  
  saveLessonToDisk(lesson);
  console.log(`✅ Successfully enriched ${lessonId}`);
}
```

**CLI Commands**:
```bash
# Initial processing (saves extracted content even if enrichment fails)
node src/processDocuments.js --category=ingles

# Retry failed enrichments
node src/processDocuments.js --category=ingles --retry-failed

# Force re-enrichment (keeps extraction, re-runs LLM)
node src/processDocuments.js --category=ingles --force-enrich
```

---

### Research Task 6: Batch Processing Concurrency

**Question**: How many documents/images to process concurrently to balance speed vs rate limits?

#### Decision: Adaptive Throttling with Priority Queue

**Configuration**:
```javascript
// In config.js
export const PROCESSING_CONFIG = {
  maxConcurrent: 3,           // Process 3 files at once (reduces P95 latency)
  ocrTimeout: 120000,         // 2 min timeout for OCR (per FR-016)
  enrichmentTimeout: 180000,  // 3 min timeout for LLM (complex content)
  
  rateLimits: {
    azureOpenAI: {
      requestsPerMin: 60,     // Azure OpenAI default (check actual quota)
      tokensPerMin: 150000,
    },
    computerVision: {
      requestsPerSec: 10,     // Computer Vision Read API
    },
  },
  
  priorities: {
    docx: 1,                  // Process documents first (faster)
    image: 2,                 // Then images (slower OCR)
    force: 0,                 // Force flag overrides (highest priority)
  },
};
```

**Implementation** (using `p-queue` or manual semaphore):
```javascript
import PQueue from 'p-queue';

async function processBatch(files, category, options) {
  // Sort by priority
  const sorted = files.sort((a, b) => {
    const prioA = options.force ? 0 : PROCESSING_CONFIG.priorities[getSourceType(a)];
    const prioB = options.force ? 0 : PROCESSING_CONFIG.priorities[getSourceType(b)];
    return prioA - prioB;
  });
  
  const queue = new PQueue({ concurrency: PROCESSING_CONFIG.maxConcurrent });
  
  const results = await queue.addAll(
    sorted.map(file => () => processFile(file, category))
  );
  
  return results;
}
```

**Rate Limit Handling** (exponential backoff):
```javascript
async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) { // Rate limit
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`⏳ Rate limited, retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

### Research Task 7: Image Input Detection and Routing

**Question**: How to automatically detect image files vs documents in the input folder?

#### Decision: File Extension-Based Routing with Explicit Processor Selection

**Detection Logic**:
```javascript
// In services/documentProcessor.js
const SUPPORTED_FORMATS = {
  documents: ['.docx', '.doc'],
  images: ['.jpg', '.jpeg', '.png'],
};

function detectSourceType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (SUPPORTED_FORMATS.documents.includes(ext)) {
    return 'document';
  } else if (SUPPORTED_FORMATS.images.includes(ext)) {
    return 'image';
  } else {
    throw new Error(`Unsupported file format: ${ext}. Expected: ${[...SUPPORTED_FORMATS.documents, ...SUPPORTED_FORMATS.images].join(', ')}`);
  }
}

async function processFile(filePath, category) {
  const sourceType = detectSourceType(filePath);
  
  let extracted;
  if (sourceType === 'document') {
    extracted = await extractWordContent(filePath);
  } else if (sourceType === 'image') {
    extracted = await extractImageContent(filePath);
  }
  
  // Continue with parsing and enrichment (unified flow)
  const lesson = parseLesson(extracted.text, filePath, sourceType);
  return await enrichLesson(lesson, category);
}
```

**Error Handling** (per FR-014):
```javascript
// Unsupported format
❌ File "lesson.pdf" format not supported
   Expected: .docx, .jpg, .jpeg, .png
   
// Empty document
❌ Document "lesson.docx" appears to be empty
   No text content found

// No text in image
❌ Image "photo.jpg" contains no readable text
   OCR detected 0 text lines (confidence N/A)
   
// Low OCR confidence
⚠️  Image "notes.jpg" has low text quality (confidence: 65%)
   Extracted text may contain errors - review carefully
```

---

## Phase 1: Design & Data Model

### Data Model

**See [data-model.md](./data-model.md)** for complete entity definitions and relationships.

**Key Entities**:
1. **Lesson** (core entity - extended with image support)
2. **Document Metadata** (source tracking)
3. **Image Source** (NEW - OCR metadata)
4. **Vocabulary Item** (language-specific enrichment)
5. **Technical Topic** (technology-specific enrichment)
6. **Command/Code Snippet** (technology-specific enrichment)
7. **Spaced Repetition Schedule** (SRS configuration)
8. **Processing Status** (workflow state machine)

**Critical Design Decisions**:
- ✅ Preserve 100% backward compatibility with existing lesson schema
- ✅ Source type tracked in metadata (no breaking change)
- ✅ OCR metadata optional (only present for image sources)
- ✅ Category type-specific enrichment fields (vocabulary XOR commands)

---

### Contracts & Interfaces

**See [contracts/](./contracts/)** for detailed API specifications.

**Key Contracts**:
1. **OCR Service** (`contracts/ocr-service.md`)
   - Input: Image file path + validation options
   - Output: Extracted text + confidence scores + metadata
   
2. **Enrichment Dispatcher** (`contracts/enrichment-dispatch.md`)
   - Input: Lesson + category type
   - Output: Type-safe enriched content + validation results
   
3. **Validation Schema** (`contracts/validation-schema.md`)
   - Language schema: vocabulary, grammar, expressions
   - Technology schema: topics, commands, scenarios

---

### Quickstart Guide

**See [quickstart.md](./quickstart.md)** for developer onboarding and setup instructions.

**Topics Covered**:
1. Prerequisites (Node.js 20+, Azure credentials)
2. Azure Computer Vision setup
3. Processing first document
4. Processing first image
5. Working with categories
6. Troubleshooting common issues

---

## Phase 2: Task Breakdown

**NOTE**: Task breakdown is generated by `/speckit.tasks` command, NOT by `/speckit.plan`.

This section deliberately left empty. After Phase 1 artifacts are reviewed and approved, run:

```bash
/speckit.tasks
```

To generate [tasks.md](./tasks.md) with detailed implementation steps.

---

## Risk Mitigation & Monitoring

### Critical Risks

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| **Azure Computer Vision quota exceeded** | HIGH - Blocks image processing | Add quota monitoring, implement local retry queue, warn at 80% usage | Backend |
| **Low OCR accuracy on handwritten content** | MEDIUM - Poor lesson quality | Pre-flight image validation, confidence thresholds, manual review option | OCR Service |
| **Breaking backward compatibility** | HIGH - Existing lessons fail | Snapshot testing, schema validation, gradual rollout | All |
| **Enrichment service downtime** | MEDIUM - Lessons stuck pending | Status-based retry, save extracted content immediately | Backend |
| **Rate limit on Azure OpenAI** | MEDIUM - Slow batch processing | Adaptive throttling, exponential backoff, queue prioritization | Backend |

### Monitoring Strategy

**Metrics to Track**:
1. **OCR Performance**:
   - Average confidence score per image
   - Processing time (p50, p95, p99)
   - Retry rate after low confidence

2. **Enrichment Success**:
   - Success rate by category type
   - Average tokens used per lesson
   - Validation failure rate (schema mismatches)

3. **Pipeline Health**:
   - Documents processed per day
   - Average end-to-end latency
   - Status distribution (enriched, pending, failed)

**Logging** (structured JSON logs):
```json
{
  "timestamp": "2026-03-20T14:32:15Z",
  "level": "info",
  "event": "lesson_processed",
  "lessonId": "lesson-2026-03-20",
  "categoryId": "ingles",
  "sourceType": "image",
  "ocrConfidence": 0.87,
  "enrichmentSuccess": true,
  "durationMs": 143200
}
```

---

## Success Criteria Mapping

| Success Criteria | Implementation | Validation |
|-----------------|----------------|------------|
| **SC-001**: <5 min processing | Concurrent batch processing, optimized OCR | Performance monitoring |
| **SC-013**: 95%+ OCR accuracy | Azure Vision Read API, quality validation | Confidence score tracking |
| **SC-014**: 0% tech fields in language | Schema validation, forbidden field checks | Automated tests |
| **SC-017**: 100% correct routing | Category type dispatch, strategy pattern | Unit tests |
| **SC-019**: Certification-relevant questions | Technology-specific LLM prompt | Manual review |

**Complete mapping** documented in [spec.md](./spec.md) Success Criteria section.

---

## Next Steps

1. ✅ **Phase 0 Complete**: Research decisions documented
2. ⏭️ **Generate Phase 1 Artifacts**:
   - Run research → Create `research.md`
   - Design data model → Create `data-model.md`
   - Define contracts → Create `contracts/*.md`
   - Write quickstart → Create `quickstart.md`
3. ⏭️ **Review & Approve**: Validate design with stakeholders
4. ⏭️ **Phase 2**: Run `/speckit.tasks` to generate implementation tasks

---

**Last Updated**: 2026-03-20  
**Status**: Phase 0 Research Complete, awaiting Phase 1 artifact generation  
**Next Command**: Generate individual Phase 1 files
