# Contract: OCR Service

**Module**: `src/processors/ocrExtractor.js`  
**Integration**: Azure AI Vision (Computer Vision) v4.0 Read API  
**Purpose**: Extract text from images with quality validation  
**Date**: 2026-03-20

## Interface

### Function: `extractTextFromImage(imagePath: string): Promise<OCRResult>`

**Description**: Extracts text from an image file using Azure Computer Vision OCR. Performs pre-processing, validation, and quality assessment.

**Parameters**:
```typescript
imagePath: string  // Absolute path to image file (.jpg, .jpeg, .png)
```

**Returns**:
```typescript
interface OCRResult {
  success: boolean;
  text: string;                    // Extracted text (all lines joined)
  metadata: OCRMetadata;
  
  // Error info (if success === false)
  error?: {
    code: string;
    message: string;
    stage: 'validation' | 'preprocessing' | 'ocr' | 'postprocessing';
  };
}

interface OCRMetadata {
  confidence: number;              // 0.0 - 1.0 (average across all lines)
  confidenceLevel: 'excellent' | 'good' | 'acceptable' | 'poor';
  linesDetected: number;
  hasNonTextElements: boolean;     // True if regions without text detected
  processingTime: number;          // Seconds
  preprocessed: boolean;           // True if image enhancement applied
  
  imageQuality: {
    brightness: 'low' | 'good' | 'high';
    contrast: 'low' | 'good' | 'excellent';
    resolution: { width: number, height: number };
    fileSize: number;              // MB
  };
  
  processedAt: string;             // ISO 8601 timestamp
}
```

---

## Behavior Specification

### Success Case

**Given**: A clear image file with readable text at `/path/to/image.jpg`  
**When**: `extractTextFromImage('/path/to/image.jpg')` is called  
**Then**: 
- Returns `{ success: true, text: "...", metadata: {...} }`
- `text` contains all detected lines joined with `\n`
- `metadata.confidence` reflects OCR quality (0.0 - 1.0)
- `metadata.confidenceLevel` categorizes quality (excellent/good/acceptable/poor)

**Example**:
```javascript
const result = await extractTextFromImage('./whiteboard.jpg');

// result:
{
  success: true,
  text: "Simple Past\nIrregular Verbs\n\ndrink - drank - drunk (beber)\ngo - went - gone (ir)",
  metadata: {
    confidence: 0.87,
    confidenceLevel: 'good',
    linesDetected: 5,
    hasNonTextElements: false,
    processingTime: 8.3,
    preprocessed: true,
    imageQuality: {
      brightness: 'good',
      contrast: 'excellent',
      resolution: { width: 2400, height: 1800 },
      fileSize: 2.1
    },
    processedAt: '2026-03-20T14:32:15Z'
  }
}
```

---

### Error Cases

#### 1. Unsupported File Format

**Given**: A non-image file (e.g., PDF, DOCX)  
**When**: `extractTextFromImage('/path/to/document.pdf')` is called  
**Then**:
```javascript
{
  success: false,
  text: '',
  error: {
    code: 'UNSUPPORTED_FORMAT',
    message: 'Image format not supported - please use JPEG or PNG',
    stage: 'validation'
  }
}
```

#### 2. Image Too Dark/Bright

**Given**: An image with poor lighting (mean luminance < 30 or > 225)  
**When**: OCR extraction is attempted  
**Then**:
```javascript
{
  success: false,
  text: '',
  error: {
    code: 'IMAGE_QUALITY_LOW',
    message: 'Image too dark - please retake with better lighting',
    stage: 'validation'
  }
}
```

#### 3. No Text Detected

**Given**: An image with no readable text (diagram only, blank page)  
**When**: OCR completes but finds 0 lines  
**Then**:
```javascript
{
  success: false,
  text: '',
  metadata: {
    confidence: 0.0,
    confidenceLevel: 'poor',
    linesDetected: 0,
    ...
  },
  error: {
    code: 'NO_TEXT_DETECTED',
    message: 'No text detected in image - verify image contains readable text',
    stage: 'ocr'
  }
}
```

#### 4. Low OCR Confidence

**Given**: An image with blurry or handwritten text (confidence < 0.7)  
**When**: OCR extraction completes  
**Then**:
```javascript
{
  success: true,  // Still returns text for review
  text: '...',
  metadata: {
    confidence: 0.65,
    confidenceLevel: 'poor',
    linesDetected: 20,
    ...
  },
  error: {
    code: 'LOW_CONFIDENCE',
    message: 'Low OCR confidence: 65% - extracted text may contain errors',
    stage: 'postprocessing'
  }
}
```

#### 5. Azure API Error

**Given**: Azure Computer Vision service is unavailable or rate-limited  
**When**: API call fails  
**Then**:
```javascript
{
  success: false,
  text: '',
  error: {
    code: 'AZURE_API_ERROR',
    message: 'Azure Computer Vision unavailable (HTTP 503) - retry later',
    stage: 'ocr'
  }
}
```

---

## Pre-Processing Pipeline

**Steps** (in order):

1. **File Validation**
   - Check file exists and readable
   - Verify extension (.jpg, .jpeg, .png)
   - Check file size (50KB min, 20MB max)

2. **Image Content Validation**
   - Load metadata (dimensions, format, color space)
   - Check resolution (800x600 min recommended)
   - Validate brightness (mean luminance 30-225)
   - Validate contrast (range > 50)
   - Detect blank images (stdDev < 5)

3. **Image Preprocessing** (if needed)
   - Resize if >4MB (API limit)
   - Convert PNG→JPEG if >2MB (optimization)
   - Enhance contrast if low (normalize histogram)

4. **OCR Execution**
   - Call Azure AI Vision Read API
   - Poll for completion (async operation)
   - Extract text blocks + confidence scores

5. **Post-Processing**
   - Join lines with `\n`
   - Calculate average confidence
   - Categorize quality level
   - Detect non-text regions

---

## Quality Thresholds

| Confidence Range | Level | User Message | Recommended Action |
|-----------------|-------|--------------|-------------------|
| ≥ 0.90 | Excellent | ✅ Excellent text quality | None - proceed |
| 0.80 - 0.89 | Good | ✅ Good text quality | None - proceed |
| 0.70 - 0.79 | Acceptable | ⚠️ Acceptable - review recommended | Manual review |
| < 0.70 | Poor | ❌ Poor quality - consider retaking | Reject or manual entry |

---

## Dependencies

**Azure SDK**:
```javascript
import { ImageAnalysisClient } from "@azure/ai-vision-image-analysis";
import { DefaultAzureCredential } from "@azure/identity";
```

**Image Processing**:
```javascript
import sharp from 'sharp';
```

**Configuration** (from `config.js`):
```javascript
export const config = {
  computerVision: {
    endpoint: process.env.VISION_ENDPOINT,
    // No API key needed (Azure AD auth)
  }
};
```

**Environment Variables**:
- `VISION_ENDPOINT`: Azure Computer Vision endpoint (e.g., `https://myresource.cognitiveservices.azure.com/`)

---

## Testing Contract

### Unit Tests

```javascript
describe('extractTextFromImage', () => {
  test('extracts text from clear JPEG image', async () => {
    const result = await extractTextFromImage('./test-images/clear-text.jpg');
    expect(result.success).toBe(true);
    expect(result.text).toContain('expected text');
    expect(result.metadata.confidence).toBeGreaterThan(0.8);
  });
  
  test('rejects unsupported file format', async () => {
    const result = await extractTextFromImage('./test-images/document.pdf');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('UNSUPPORTED_FORMAT');
  });
  
  test('detects image with no text', async () => {
    const result = await extractTextFromImage('./test-images/blank.jpg');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('NO_TEXT_DETECTED');
    expect(result.metadata.linesDetected).toBe(0);
  });
  
  test('warns on low confidence extraction', async () => {
    const result = await extractTextFromImage('./test-images/blurry.jpg');
    expect(result.success).toBe(true);  // Still returns text
    expect(result.error.code).toBe('LOW_CONFIDENCE');
    expect(result.metadata.confidence).toBeLessThan(0.7);
  });
});
```

### Integration Tests

```javascript
describe('OCR Integration', () => {
  test('processes real classroom whiteboard photo', async () => {
    const result = await extractTextFromImage('./test-images/classroom.jpg');
    expect(result.success).toBe(true);
    expect(result.metadata.linesDetected).toBeGreaterThan(10);
    expect(result.text).toMatch(/grammar|vocabulary|verb/i);
  });
});
```

---

## Performance Expectations

| Metric | Target | Notes |
|--------|--------|-------|
| **Latency** | < 10s per image (p95) | Includes API call + processing |
| **Success Rate** | > 95% for clear images | Excludes user errors (wrong format) |
| **Confidence** | > 0.85 average (good images) | Handwritten may be 0.75-0.85 |
| **Memory** | < 100MB per image | Preprocessing uses `sharp` buffers |

---

## Error Codes Reference

| Code | Stage | Retry? | User Action |
|------|-------|--------|-------------|
| `UNSUPPORTED_FORMAT` | validation | No | Use JPEG/PNG |
| `FILE_TOO_SMALL` | validation | No | Use higher resolution |
| `FILE_TOO_LARGE` | validation | No | Compress image |
| `IMAGE_BLANK` | validation | No | Check file integrity |
| `IMAGE_QUALITY_LOW` | validation | No | Improve lighting/focus |
| `NO_TEXT_DETECTED` | ocr | No | Verify text present |
| `LOW_CONFIDENCE` | postprocessing | Manual | Review extracted text |
| `AZURE_API_ERROR` | ocr | Yes | Retry later |

---

**Last Updated**: 2026-03-20  
**Status**: Contract Defined  
**Implementation**: Pending
