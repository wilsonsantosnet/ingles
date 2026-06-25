# Research Phase: Lesson Creation with Image Support

**Feature**: 001-lesson-creation-process  
**Date**: 2026-03-20  
**Status**: Complete

## Overview

This research phase resolves all technical unknowns for implementing automated lesson creation from documents and images with category-specific enrichment. Key focus areas: Azure Computer Vision OCR integration, image quality validation, enrichment routing by category type, and resilient batch processing.

---

## Research Tasks

### Task 1: Azure Computer Vision OCR Integration

**Question**: What's the optimal Azure Computer Vision API approach for classroom image OCR (printed + handwritten text)?

#### Findings

**Choice: Azure AI Vision v4.0 Read API with Image Analysis SDK**

**Technical Specification**:
```javascript
// Package: @azure/ai-vision-image-analysis v1.0+
import { ImageAnalysisClient } from "@azure/ai-vision-image-analysis";
import { AzureKeyCredential } from "@azure/core-auth";
import { DefaultAzureCredential } from "@azure/identity";

// Setup (preferred: Azure AD)
const credential = new DefaultAzureCredential();
const endpoint = process.env.VISION_ENDPOINT; // e.g., https://<resource>.cognitiveservices.azure.com/

const analysisClient = new ImageAnalysisClient(endpoint, credential);

// Extract text from image
async function extractTextFromImage(imageBuffer, sourceType = 'file') {
  const features = ["Read"]; // OCR feature
  
  const result = await analysisClient.analyzeImage(
    imageBuffer,
    features,
    {
      language: "en", // Primary language (also detects Portuguese)
      modelVersion: "latest"
    }
  );
  
  // Extract text blocks with confidence
  const readResult = result.readResult;
  const lines = readResult.blocks.flatMap(block => 
    block.lines.map(line => ({
      text: line.text,
      confidence: line.confidence || 0.0,
      boundingBox: line.boundingPolygon
    }))
  );
  
  const fullText = lines.map(l => l.text).join('\n');
  const avgConfidence = lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
  
  return {
    text: fullText,
    confidence: avgConfidence,
    linesDetected: lines.length,
    details: lines
  };
}
```

**Quality Thresholds**:
```javascript
const QUALITY_LEVELS = {
  excellent: { threshold: 0.90, message: "✅ Excellent text quality" },
  good: { threshold: 0.80, message: "✅ Good text quality" },
  acceptable: { threshold: 0.70, message: "⚠️  Acceptable - review recommended" },
  poor: { threshold: 0.0, message: "❌ Poor quality - consider retaking image" }
};

function assessQuality(confidence) {
  if (confidence >= QUALITY_LEVELS.excellent.threshold) return 'excellent';
  if (confidence >= QUALITY_LEVELS.good.threshold) return 'good';
  if (confidence >= QUALITY_LEVELS.acceptable.threshold) return 'acceptable';
  return 'poor';
}
```

**Image Preprocessing Pipeline** (using `sharp`):
```javascript
import sharp from 'sharp';

async function preprocessImage(imagePath) {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  let processed = image;
  
  // 1. Resize if too large (API limit: 4MB)
  const stats = await image.stats();
  const estimatedSize = metadata.width * metadata.height * (metadata.channels || 3);
  
  if (estimatedSize > 4 * 1024 * 1024) {
    console.log('📐 Resizing large image for OCR...');
    processed = processed.resize(3000, 3000, { fit: 'inside', withoutEnlargement: true });
  }
  
  // 2. Convert to JPEG if PNG is large
  if (metadata.format === 'png' && estimatedSize > 2 * 1024 * 1024) {
    console.log('🔄 Converting PNG to JPEG...');
    processed = processed.jpeg({ quality: 90 });
  }
  
  // 3. Enhance contrast for OCR (if needed)
  const isLowContrast = (stats.channels[0].max - stats.channels[0].min) < 100;
  if (isLowContrast) {
    console.log('🎨 Enhancing contrast for better OCR...');
    processed = processed.normalize();
  }
  
  return await processed.toBuffer();
}
```

**Rationale**:
- **Read API** specifically designed for document/text extraction (vs general OCR)
- Returns structured output with confidence per line (enables selective retry)
- Handles mixed printed/handwritten content (classroom use case)
- Async polling model fits batch processing architecture
- Azure AD integration consistent with existing OpenAI setup

**Alternatives Considered**:
- ❌ **Tesseract.js**: Open-source but significantly lower accuracy on handwritten text (~70% vs 85-90% for Azure), no per-line confidence scores, requires local installation
- ❌ **Azure Form Recognizer**: Optimized for structured forms (invoices, receipts), overkill for free-form classroom notes, more expensive ($10/1000 pages vs $1.50/1000 images)
- ❌ **Google Cloud Vision**: Requires separate GCP account, less integrated with existing Azure OpenAI + Azure AD infrastructure, similar pricing

**Cost Analysis**:
- **Azure Computer Vision Read API**: $1.50 per 1000 images (S1 tier)
- **Expected usage**: ~20-40 images/month per category × 2-3 categories = 40-120 images/month
- **Monthly cost**: $0.06 - $0.18/month
- **Annual cost**: ~$0.72 - $2.16/year (negligible)

**Decision**: Use Azure AI Vision Read API with Azure AD authentication.

---

### Task 2: Image Quality Pre-Validation Strategy

**Question**: How to detect unusable images before expensive OCR API calls?

#### Findings

**Choice: Multi-Stage Pre-Flight Validation with Progressive Checks**

**Stage 1: File System Validation** (instant, no processing):
```javascript
import fs from 'fs/promises';
import path from 'path';

async function validateImageFile(filePath) {
  const errors = [];
  
  // Check 1: File exists and readable
  try {
    await fs.access(filePath, fs.constants.R_OK);
  } catch {
    errors.push(`File not readable: ${filePath}`);
    return { valid: false, errors };
  }
  
  // Check 2: Extension
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    errors.push(`Unsupported format: ${ext}. Expected: .jpg, .jpeg, .png`);
  }
  
  // Check 3: File size (50KB min, 20MB max)
  const stats = await fs.stat(filePath);
  if (stats.size < 50 * 1024) {
    errors.push(`File too small: ${(stats.size / 1024).toFixed(1)}KB (min 50KB)`);
  }
  if (stats.size > 20 * 1024 * 1024) {
    errors.push(`File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max 20MB)`);
  }
  
  return { valid: errors.length === 0, errors };
}
```

**Stage 2: Image Content Validation** (fast, using `sharp`):
```javascript
async function validateImageContent(imagePath) {
  const errors = [];
  const warnings = [];
  
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const stats = await image.stats();
  
  // Check 1: Dimensions (800x600 min for readable text)
  if (metadata.width < 800 || metadata.height < 600) {
    warnings.push(`Low resolution: ${metadata.width}x${metadata.height} (recommend 1200x900+)`);
  }
  
  // Check 2: Not blank (stdDev indicates content variance)
  const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
  if (avgStdDev < 5) {
    errors.push('Image appears blank or has no content (uniform color)');
  }
  
  // Check 3: Brightness range (detect too dark/bright)
  const avgMean = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
  if (avgMean < 30) {
    errors.push('Image too dark - please retake with better lighting');
  }
  if (avgMean > 225) {
    errors.push('Image overexposed - reduce brightness or flash');
  }
  
  // Check 4: Contrast (important for OCR)
  const avgRange = stats.channels.reduce((sum, ch) => sum + (ch.max - ch.min), 0) / stats.channels.length;
  if (avgRange < 50) {
    warnings.push('Low contrast detected - OCR accuracy may be reduced');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}
```

**Stage 3: Post-OCR Confidence Check**:
```javascript
async function validateOCRResult(ocrResult) {
  const { confidence, linesDetected, text } = ocrResult;
  
  // No text detected
  if (linesDetected === 0 || !text || text.trim().length === 0) {
    return {
      status: 'no-text',
      message: '❌ No text detected in image. Verify image contains readable text.'
    };
  }
  
  // Low confidence
  if (confidence < 0.70) {
    return {
      status: 'low-confidence',
      confidence,
      message: `⚠️  Low OCR confidence: ${(confidence * 100).toFixed(0)}%. Extracted text may contain errors - review carefully.`,
      suggestion: 'Consider retaking photo with better focus and lighting.'
    };
  }
  
  // Good quality
  return { status: 'success', confidence };
}
```

**User-Facing Error Messages** (FR-014 compliance):
```javascript
const ERROR_MESSAGES = {
  'unsupported-format': {
    title: '❌ Image format not supported',
    message: (ext) => `File format "${ext}" is not supported.`,
    action: 'Please use JPEG (.jpg) or PNG (.png) format.',
    technical: 'Supported MIME types: image/jpeg, image/png'
  },
  
  'file-too-small': {
    title: '❌ Image file too small',
    message: (size) => `File size ${size}KB is below minimum.`,
    action: 'Image must be at least 50KB. Use higher resolution or quality setting.',
    technical: 'Minimum: 50KB for meaningful content'
  },
  
  'image-blank': {
    title: '❌ Image appears blank',
    message: 'No visual content detected in image.',
    action: 'Verify image file is not corrupted and contains visible content.',
    technical: 'Statistical variance below threshold (stdDev < 5)'
  },
  
  'image-too-dark': {
    title: '❌ Image too dark for OCR',
    message: 'Image brightness is insufficient for text recognition.',
    action: 'Retake photo with better lighting or increase brightness.',
    technical: 'Mean luminance < 30 (acceptable range: 30-225)'
  },
  
  'no-text-detected': {
    title: '❌ No text found in image',
    message: 'OCR could not detect any text content.',
    action: 'Verify image contains readable text. Try closer/clearer photo.',
    technical: 'Zero text lines detected by Azure Computer Vision'
  },
  
  'low-ocr-confidence': {
    title: '⚠️  Low text recognition confidence',
    message: (conf) => `Text confidence: ${conf}% (threshold: 70%)`,
    action: 'Extracted text may be inaccurate. Review carefully before using.',
    suggestion: 'For better results: improve focus, lighting, and contrast.',
    technical: 'Average per-line confidence below 0.70'
  }
};
```

**Rationale**: Early rejection of bad images saves API costs and reduces user wait time. Progressive validation allows specific, actionable feedback.

---

### Task 3: Category-Specific Enrichment Prompts

**Question**: How to ensure LLM outputs correct structure per category type without field contamination?

#### Findings

**Choice: Strict JSON Schema Prompts with Explicit Field Lists and Validation**

**Language Category Prompt** (already implemented in llmEnricher.js):
```javascript
function createLanguagePrompt(lesson) {
  return `You are an expert language educator creating structured learning content.

CRITICAL: This is a LANGUAGE LEARNING lesson. You MUST extract language-specific content.

CONTENT:
${lesson.rawContent}

OUTPUT EXACTLY THIS JSON (and ONLY this JSON, no markdown):
{
  "summary": "2-3 sentence lesson overview",
  "mainTopics": ["topic 1", "topic 2"],
  "vocabulary": [
    {
      "word": "English word or phrase",
      "translation": "Portuguese translation (NEVER leave null/empty)",
      "definition": "English definition",
      "examples": ["Use ORIGINAL sentences from document", "Add more if needed"],
      "pronunciation": "IPA or phonetic notation",
      "partOfSpeech": "noun/verb/adjective/adverb/preposition/etc",
      "synonyms": ["synonym1", "synonym2"],
      "difficulty": "basic/intermediate/advanced"
    }
  ],
  "grammar": [
    {
      "topic": "Grammar concept (e.g., Simple Past, Present Perfect)",
      "explanation": "Clear explanation in Portuguese",
      "rules": ["rule 1", "rule 2"],
      "examples": ["PRIORITIZE examples from document"],
      "commonMistakes": ["mistake 1", "mistake 2"]
    }
  ],
  "expressions": [
    {
      "expression": "Idiomatic expression or collocation",
      "meaning": "Portuguese meaning",
      "usage": "When/how to use",
      "examples": ["example 1", "example 2"]
    }
  ],
  "practiceQuestions": [
    {
      "question": "Exercise question",
      "answer": "Expected answer",
      "explanation": "Why this answer",
      "type": "translation/fill-in-blank/multiple-choice",
      "tense": "Related verb tense if applicable"
    }
  ],
  "culturalNotes": ["Cultural context note 1", "Cultural context note 2"],
  "studyTips": ["Study tip 1", "Study tip 2"],
  "originalExamples": [
    "ALL English sentences from document WITH translations",
    "Format: 'English sentence (Tradução em português)'"
  ]
}

STRICT RULES:
1. Extract ALL vocabulary from document (no arbitrary limits)
2. ALWAYS fill "translation" field (never null/empty)
3. Use ORIGINAL examples from document first
4. Include verb forms (present-past-past participle)
5. DO NOT include: technical commands, server configs, code syntax
6. ONLY language learning content: vocabulary, grammar, expressions

Return ONLY the JSON above (no ```json markers, no extra text).`;
}
```

**Technology Category Prompt** (already implemented in llmEnricher.js):
```javascript
function createTechnologyPrompt(lesson) {
  return `You are an expert technology instructor creating certification exam preparation content.

CRITICAL: This is a TECHNOLOGY CERTIFICATION lesson. You MUST extract technical content.

CONTENT:
${lesson.rawContent}

OUTPUT EXACTLY THIS JSON (and ONLY this JSON, no markdown):
{
  "topics": [
    {
      "name": "Technical topic (e.g., Azure Virtual Machines, Networking)",
      "description": "What this topic covers",
      "category": "Azure service category (Compute/Storage/Network/Security/etc)",
      "importance": "high/medium/low (for certification)"
    }
  ],
  "concepts": [
    {
      "concept": "Technical term or concept",
      "definition": "Technical definition",
      "examples": ["Practical example 1", "Use case 2"],
      "relatedConcepts": ["Related concept 1", "Related concept 2"],
      "difficulty": "beginner/intermediate/advanced"
    }
  ],
  "commands": [
    {
      "command": "Actual command (e.g., az vm create, New-AzVM)",
      "description": "What the command does",
      "syntax": "Full syntax with parameters",
      "examples": ["Concrete usage example 1", "Example with options 2"],
      "platform": "Azure CLI/PowerShell/Portal/ARM/Bicep/Terraform"
    }
  ],
  "scenarios": [
    {
      "scenario": "Practical scenario title",
      "problem": "Detailed problem description or use case",
      "solution": "Step-by-step solution",
      "explanation": "Why this solution works (technical reasoning)"
    }
  ],
  "exercises": [
    {
      "type": "scenario-based/command/concept/troubleshooting",
      "question": "Exercise question",
      "answer": "Correct answer",
      "hint": "Helpful hint",
      "topic": "Related topic"
    }
  ],
  "examTips": [
    {
      "tip": "Important certification exam tip",
      "relevance": "Why this matters for the exam",
      "topic": "Related topic (optional)"
    }
  ]
}

STRICT RULES:
1. Focus on technical accuracy and certification relevance
2. Include ALL commands mentioned in document
3. Create scenario-based exercises (real-world problems)
4. Highlight exam-relevant details in examTips
5. DO NOT include: vocabulary translations, grammar rules, language expressions
6. ONLY technical content: configs, commands, architectures, troubleshooting

Return ONLY the JSON above (no ```json markers, no extra text).`;
}
```

**Validation: Forbidden Field Detection**:
```javascript
// In llmEnricher.js (extend existing validation)
function validateCategoryTypeCompliance(enriched, categoryType) {
  const violations = [];
  
  const CATEGORY_RULES = {
    language: {
      required: ['vocabulary', 'grammar', 'expressions'],
      forbidden: ['commands', 'topics', 'concepts', 'scenarios', 'examTips']
    },
    technology: {
      required: ['topics', 'concepts', 'commands'],
      forbidden: ['vocabulary', 'grammar', 'expressions', 'culturalNotes']
    }
  };
  
  const rules = CATEGORY_RULES[categoryType];
  if (!rules) return violations;
  
  // Check required fields present
  rules.required.forEach(field => {
    if (!enriched[field] || enriched[field].length === 0) {
      violations.push({
        type: 'missing-required',
        field,
        severity: 'error',
        message: `${categoryType} category MUST have "${field}" field with content`
      });
    }
  });
  
  // Check forbidden fields absent
  rules.forbidden.forEach(field => {
    if (enriched[field] && enriched[field].length > 0) {
      violations.push({
        type: 'forbidden-field',
        field,
        severity: 'error',
        message: `${categoryType} category MUST NOT have "${field}" field (type mismatch)`
      });
    }
  });
  
  return violations;
}
```

**Rationale**: Explicit JSON schemas + strict field lists + validation catch type contamination. LLM is instructed what to include AND what to exclude per type.

---

### Task 4: Lesson Source Type Tracking

**Question**: How to track lesson source (document vs image) for filtering and quality indicators?

#### Findings

**Choice: Extend Lesson Schema with Source Metadata (Non-Breaking)**

**Schema Extension**:
```javascript
// Enhanced lesson structure (backward compatible)
const LessonSchema = {
  // EXISTING FIELDS (unchanged)
  id: 'lesson-2026-03-20',
  date: '2026-03-20',
  title: 'Lesson Title',
  rawContent: 'Extracted text...',
  enriched: { /* category-specific structure */ },
  status: 'enriched',
  
  // NEW FIELDS (optional, non-breaking)
  source: 'image',                    // 'docx' | 'manual' | 'image'
  sourceFile: 'whiteboard-2026-03-20.jpg',  // Original filename
  
  // NEW: OCR-specific metadata (only present if source === 'image')
  ocrMetadata: {
    confidence: 0.87,                 // Average confidence score
    confidenceLevel: 'good',          // 'excellent' | 'good' | 'acceptable' | 'poor'
    linesDetected: 42,
    hasNonTextElements: true,         // Detected non-text regions (charts/diagrams)
    processingTime: 8.3,              // Seconds
    preprocessed: true,               // Applied image enhancement
    imageQuality: {
      brightness: 'good',
      contrast: 'excellent',
      resolution: { width: 2400, height: 1800 },
      fileSize: 2.1                   // MB
    },
    processedAt: '2026-03-20T14:32:15Z'
  },
  
  // EXISTING FIELDS (unchanged)
  validation: { isValid: true, errors: [], warnings: [] },
  createdAt: '2026-03-20T14:30:00Z',
  updatedAt: '2026-03-20T14:32:15Z'
};
```

**Source Detection Logic**:
```javascript
// In processors/contentExtractor.js
function determineSourceType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (['.jpg', '.jpeg', '.png'].includes(ext)) {
    return 'image';
  } else if (['.docx', '.doc'].includes(ext)) {
    return 'docx';
  } else if (filePath.includes('manual')) {
    return 'manual';  // For manually created lessons
  }
  
  throw new Error(`Unknown source type for file: ${filePath}`);
}
```

**Frontend Display** (in public/app.js):
```javascript
// Source icons
const SOURCE_ICONS = {
  docx: '📄',
  manual: '✍️',
  image: '📸'
};

// Quality badges
const QUALITY_BADGES = {
  excellent: '🟢',
  good: '🟡',
  acceptable: '🟠',
  poor: '🔴'
};

function renderLessonCard(lesson) {
  const sourceIcon = SOURCE_ICONS[lesson.source] || '📝';
  let qualityBadge = '';
  
  if (lesson.source === 'image' && lesson.ocrMetadata) {
    const level = lesson.ocrMetadata.confidenceLevel;
    qualityBadge = QUALITY_BADGES[level] || '';
    const confidence = (lesson.ocrMetadata.confidence * 100).toFixed(0);
    
    return `
      <div class="lesson-card">
        <span class="source">${sourceIcon} ${lesson.title}</span>
        <span class="quality">${qualityBadge} OCR: ${confidence}%</span>
        <span class="date">${lesson.date}</span>
      </div>
    `;
  }
  
  return `<div class="lesson-card">${sourceIcon} ${lesson.title} (${lesson.date})</div>`;
}
```

**Filtering Support** (in lessonManager.js):
```javascript
// Filter lessons by source type and quality
filterLessons(categoryId, options = {}) {
  const { sourceType, minConfidence, qualityLevel } = options;
  
  let lessons = this.getAllLessons(categoryId);
  
  if (sourceType) {
    lessons = lessons.filter(l => l.source === sourceType);
  }
  
  if (minConfidence && sourceType === 'image') {
    lessons = lessons.filter(l => 
      l.ocrMetadata && l.ocrMetadata.confidence >= minConfidence
    );
  }
  
  if (qualityLevel) {
    lessons = lessons.filter(l => 
      l.ocrMetadata && l.ocrMetadata.confidenceLevel === qualityLevel
    );
  }
  
  return lessons;
}
```

**Migration Strategy** (backward compatibility):
```javascript
// Automatically backfill source type for existing lessons
function migrateExistingLessons(categoryId) {
  const lessons = loadAllLessons(categoryId);
  
  lessons.forEach(lesson => {
    // Add source field if missing (assume docx for old lessons)
    if (!lesson.source) {
      lesson.source = 'docx';
      lesson.sourceFile = lesson.sourceFile || `${lesson.id}.docx`;
      
      // No ocrMetadata for existing lessons (they were from documents)
      saveLessonToDisk(lesson);
    }
  });
}
```

**Rationale**: 
- Optional fields preserve backward compatibility (old lessons still valid)
- OCR metadata only present for image sources (no bloat for document lessons)
- Frontend can display quality indicators without breaking existing UI
- Filtering enables professor to review low-confidence lessons

---

### Task 5: Batch Processing Concurrency and Rate Limiting

**Question**: How to balance processing speed with Azure API rate limits?

#### Findings

**Choice: Adaptive Concurrency with Token Bucket Rate Limiting**

**Configuration** (in config.js):
```javascript
export const PROCESSING_CONFIG = {
  // Concurrency control
  maxConcurrent: 3,                 // Process 3 files simultaneously
  batchSize: 10,                    // Max files per batch
  
  // Timeouts
  ocrTimeout: 120000,               // 2 minutes per image
  enrichmentTimeout: 180000,        // 3 minutes per enrichment
  
  // Rate limits (based on Azure service quotas)
  rateLimits: {
    azureOpenAI: {
      requestsPerMinute: 60,        // Default for Standard tier
      tokensPerMinute: 150000,      // Monitor actual usage
      maxRetries: 3,
      backoffMultiplier: 2          // Exponential backoff: 1s, 2s, 4s
    },
    computerVision: {
      requestsPerSecond: 10,        // Read API limit (S1 tier)
      requestsPerMinute: 300,
      maxRetries: 3,
      backoffMultiplier: 2
    }
  },
  
  // Processing priorities
  priorities: {
    force: 0,                       // Highest priority
    docx: 1,                        // Process documents first (faster)
    image: 2                        // Then images (slower OCR)
  }
};
```

**Rate Limiter Implementation** (Token Bucket Algorithm):
```javascript
class RateLimiter {
  constructor(requestsPerSecond, requestsPerMinute) {
    this.rps = requestsPerSecond;
    this.rpm = requestsPerMinute;
    this.tokensSecond = requestsPerSecond;
    this.tokensMinute = requestsPerMinute;
    this.lastRefillSecond = Date.now();
    this.lastRefillMinute = Date.now();
  }
  
  async acquire() {
    // Wait until token available
    while (this.tokensSecond <= 0 || this.tokensMinute <= 0) {
      this.refill();
      await this.sleep(100); // Check every 100ms
    }
    
    this.tokensSecond--;
    this.tokensMinute--;
  }
  
  refill() {
    const now = Date.now();
    
    // Refill per-second bucket
    const secondsElapsed = (now - this.lastRefillSecond) / 1000;
    if (secondsElapsed >= 1) {
      this.tokensSecond = Math.min(this.rps, this.tokensSecond + this.rps * secondsElapsed);
      this.lastRefillSecond = now;
    }
    
    // Refill per-minute bucket
    const minutesElapsed = (now - this.lastRefillMinute) / 60000;
    if (minutesElapsed >= 1) {
      this.tokensMinute = Math.min(this.rpm, this.tokensMinute + this.rpm * minutesElapsed);
      this.lastRefillMinute = now;
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create rate limiters
const visionLimiter = new RateLimiter(10, 300);
const openAILimiter = new RateLimiter(1, 60);  // 60 per minute = 1 per second
```

**Batch Processing with Concurrency Control**:
```javascript
import PQueue from 'p-queue';  // Or implement simple semaphore

async function processBatch(files, category, options = {}) {
  const { force = false } = options;
  
  // Sort by priority (force > docx > image)
  const sorted = files.sort((a, b) => {
    if (force) return 0;  // All equal priority if force
    const typeA = detectSourceType(a);
    const typeB = detectSourceType(b);
    return PROCESSING_CONFIG.priorities[typeA] - PROCESSING_CONFIG.priorities[typeB];
  });
  
  // Create queue with concurrency limit
  const queue = new PQueue({ 
    concurrency: PROCESSING_CONFIG.maxConcurrent,
    timeout: Math.max(PROCESSING_CONFIG.ocrTimeout, PROCESSING_CONFIG.enrichmentTimeout),
    throwOnTimeout: false  // Continue processing other files
  });
  
  // Track results
  const results = {
    succeeded: [],
    failed: [],
    skipped: []
  };
  
  // Process all files
  const tasks = sorted.map(file => async () => {
    try {
      const result = await processFile(file, category, options);
      
      if (result.status === 'skipped') {
        results.skipped.push({ file, reason: result.reason });
      } else if (result.status === 'success') {
        results.succeeded.push({ file, lessonId: result.lessonId });
      }
    } catch (error) {
      console.error(`❌ Failed to process ${file}:`, error.message);
      results.failed.push({ file, error: error.message });
    }
  });
  
  await queue.addAll(tasks);
  
  return results;
}
```

**Retry Logic with Exponential Backoff**:
```javascript
async function callWithRetry(fn, limiter, serviceName, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wait for rate limit token
      await limiter.acquire();
      
      // Call function
      return await fn();
      
    } catch (error) {
      const isRetryable = error.status === 429 || error.code === 'ETIMEDOUT';
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;  // Give up
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
      console.warn(`⏳ ${serviceName} error (${error.status}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Usage
const ocrResult = await callWithRetry(
  () => extractTextFromImage(imageBuffer),
  visionLimiter,
  'Azure Computer Vision'
);
```

**Rationale**:
- Token bucket smooths traffic spikes, prevents API quota exhaustion
- Priority queue ensures fast documents don't wait behind slow images
- Exponential backoff recovers from transient failures
- Concurrency limit (3) balances throughput with memory usage

---

### Task 6: Error Recovery and Retry Strategy

**Question**: How to handle partial failures (extraction OK, enrichment fails) without data loss?

#### Findings

**Choice: Incremental Persistence with Status-Based Retry**

**Status State Machine**:
```
           START
             ↓
         [pending]
             ↓
   ┌─── [extracting] ────┐
   │         ↓            │
   │    [extracted]       │
   │         ↓            │
   │   [enriching] ───────┼─→ [extraction-failed] (terminal)
   │         ↓            │
   │    [enriched]        │
   │                      │
   └─→ [enrichment-failed] (retryable)
        [pending-enrichment] (manual)
```

**Implementation**:
```javascript
// In processDocuments.js
async function processFile(filePath, category, options = {}) {
  const fileName = path.basename(filePath);
  let lesson = {
    id: null,
    status: 'pending',
    source: detectSourceType(filePath),
    sourceFile: fileName
  };
  
  try {
    // STAGE 1: Extract content (save immediately)
    console.log(`1️⃣  Extracting content from ${fileName}...`);
    lesson.status = 'extracting';
    
    let extracted;
    if (lesson.source === 'image') {
      extracted = await extractImageContent(filePath);
      lesson.ocrMetadata = extracted.metadata;
    } else {
      extracted = await extractWordContent(filePath);
    }
    
    lesson.rawContent = extracted.text;
    lesson.status = 'extracted';
    
    // Parse to get ID
    const parsed = parseLesson(extracted.text, fileName);
    lesson = { ...lesson, ...parsed };
    
    // Save with extracted content (even if enrichment fails)
    const outputPath = getLessonPath(category.id, lesson.id);
    saveLessonToDisk(lesson, outputPath);
    console.log(`💾 Saved extracted content: ${outputPath}`);
    
    // STAGE 2: Enrich with LLM (can fail and retry separately)
    console.log(`2️⃣  Enriching with Azure OpenAI...`);
    lesson.status = 'enriching';
    
    try {
      const enriched = await enrichWithLLM(lesson, category);
      lesson.enriched = enriched.enriched;
      lesson.validation = enriched.validation;
      lesson.status = enriched.validation.isValid ? 'enriched' : 'requires-review';
      
    } catch (enrichError) {
      // Enrichment failed, but we have extracted content
      console.error(`⚠️  Enrichment failed: ${enrichError.message}`);
      lesson.status = 'enrichment-failed';
      lesson.enrichmentError = {
        message: enrichError.message,
        code: enrichError.code || 'UNKNOWN',
        timestamp: new Date().toISOString(),
        retryCount: 0
      };
    }
    
    // Save final state
    saveLessonToDisk(lesson, outputPath);
    
    return {
      status: lesson.status === 'enrichment-failed' ? 'partial' : 'success',
      lessonId: lesson.id,
      warnings: lesson.status === 'enrichment-failed' ? ['Enrichment pending'] : []
    };
    
  } catch (extractError) {
    // Fatal: extraction failed, nothing to save
    console.error(`❌ Extraction failed: ${extractError.message}`);
    
    lesson.status = 'extraction-failed';
    lesson.error = extractError.message;
    
    return {
      status: 'failed',
      error: extractError.message
    };
  }
}
```

**Retry Failed Enrichments**:
```javascript
// CLI: node src/processDocuments.js --category=ingles --retry-failed
async function retryFailedEnrichments(categoryId) {
  const lessons = loadAllLessons(categoryId);
  const failed = lessons.filter(l => l.status === 'enrichment-failed');
  
  if (failed.length === 0) {
    console.log('✅ No failed enrichments to retry');
    return;
  }
  
  console.log(`🔄 Found ${failed.length} lessons to retry`);
  
  const category = categoryManager.getCategory(categoryId);
  const results = { succeeded: 0, failed: 0 };
  
  for (const lesson of failed) {
    try {
      console.log(`\n🔄 Retrying: ${lesson.id}...`);
      
      const enriched = await enrichWithLLM(lesson, category);
      lesson.enriched = enriched.enriched;
      lesson.validation = enriched.validation;
      lesson.status = 'enriched';
      lesson.enrichmentError = null;
      
      saveLessonToDisk(lesson);
      results.succeeded++;
      console.log(`✅ Success: ${lesson.id}`);
      
    } catch (error) {
      lesson.enrichmentError.retryCount++;
      lesson.enrichmentError.lastAttempt = new Date().toISOString();
      saveLessonToDisk(lesson);
      
      results.failed++;
      console.error(`❌ Still failing: ${lesson.id} - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Retry summary: ${results.succeeded} succeeded, ${results.failed} still failing`);
}
```

**Rationale**:
- Extracted content saved immediately (no data loss on enrichment failure)
- Status field enables targeted retry (only enrichment-failed lessons)
- Retry count prevents infinite loops
- Professors can manually review extracted content while waiting for retry

---

## Summary of Decisions

### Core Architectural Choices

1. **OCR Technology**: Azure AI Vision v4.0 Read API
   - Best accuracy for mixed printed/handwritten text
   - Confidence scores enable quality validation
   - Integrated Azure AD authentication

2. **Image Validation**: Multi-stage pre-flight checks
   - File system → Image content → OCR confidence
   - Fail fast to save API costs
   - Actionable error messages

3. **Category Routing**: Strategy pattern with validator pairing
   - Type-safe enrichment dispatch
   - Forbidden field validation (prevent contamination)
   - Already implemented (spec 002)

4. **Source Tracking**: Non-breaking schema extension
   - Optional metadata fields
   - OCR-specific quality indicators
   - Backward compatible

5. **Batch Processing**: Adaptive concurrency with rate limiting
   - 3 concurrent files (balance speed/memory)
   - Token bucket rate limiting
   - Priority queue (documents before images)

6. **Error Recovery**: Incremental persistence with status-based retry
   - Save extracted content immediately
   - Enrichment failures retryable separately
   - No data loss on partial failures

### Next Steps

1. ✅ **Research Complete**: All technical unknowns resolved
2. ⏭️ **Phase 1 Design**: Create data-model.md, contracts/, quickstart.md
3. ⏭️ **Phase 2 Tasks**: Generate tasks.md with implementation steps

---

**Last Updated**: 2026-03-20  
**Status**: Complete  
**Next Action**: Create Phase 1 artifacts (data-model.md, contracts/, quickstart.md)
