# Quickstart: Lesson Creation Process

**Feature**: 001-lesson-creation-process  
**Date**: 2026-03-20  
**Audience**: Developers implementing or extending lesson creation functionality

## Prerequisites

Before starting, ensure you have:

1. **Node.js 20+** installed
   ```bash
   node --version  # Should be v20.0.0 or higher
   ```

2. **Azure Credentials** configured
   - Azure AD authentication (for OpenAI + Computer Vision)
   - Environment variables set (see Configuration section)

3. **Project Repository** cloned
   ```bash
   git clone <repository-url>
   cd ingles
   npm install
   ```

4. **Azure Services** provisioned:
   - Azure OpenAI (already configured)
   - Azure Computer Vision (new requirement)

---

## Configuration

### Environment Variables

Create or update `.env` file in project root:

```bash
# Azure OpenAI (existing)
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4
AZURE_OPENAI_MODEL_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Azure Computer Vision (NEW)
VISION_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/

# Authentication: Azure AD (no keys needed)
# DefaultAzureCredential will use:
# 1. Environment variables (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)
# 2. VS Code authentication
# 3. Azure CLI authentication (az login)
```

### Azure CLI Login

Authenticate with Azure:
```bash
az login
```

Verify subscription:
```bash
az account show
```

---

## Project Structure Overview

```
src/
├── services/              # NEW - Business logic orchestration
│   ├── documentProcessor.js    # Document processing pipeline
│   └── imageProcessor.js       # Image validation + OCR
├── processors/            # NEW - Content extraction
│   ├── ocrExtractor.js         # Azure Computer Vision integration
│   ├── textExtractor.js        # Document text extraction
│   └── contentParser.js        # Parse extracted text
├── schemas/               # Validation (existing)
│   ├── languageSchema.js       # Language enrichment validator
│   └── technologySchema.js     # Technology enrichment validator
├── llmEnricher.js         # Enrichment dispatch (existing)
├── processDocuments.js    # CLI entry point (existing, will refactor)
└── config.js              # Configuration (extend for Computer Vision)

data/
├── categories.json        # Category definitions (type: language/technology)
└── categories/
    ├── ingles/            # Language lessons
    └── az104/             # Technology lessons

docs/                      # Input folder for documents/images
├── ingles/                # Place English lesson files here
└── az104/                 # Place Azure certification files here
```

---

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

**New Dependencies** (add to `package.json`):
```json
{
  "dependencies": {
    "@azure/ai-vision-image-analysis": "^1.0.0",
    "sharp": "^0.33.0",
    "p-queue": "^8.0.0"
  }
}
```

Install:
```bash
npm install @azure/ai-vision-image-analysis sharp p-queue
```

---

### 2. Verify Azure Computer Vision Access

Test Azure Computer Vision connectivity:

```bash
# Create test script: test-vision.js
node test-vision.js
```

**test-vision.js**:
```javascript
import { ImageAnalysisClient } from "@azure/ai-vision-image-analysis";
import { DefaultAzureCredential } from "@azure/identity";
import fs from 'fs';

const credential = new DefaultAzureCredential();
const endpoint = process.env.VISION_ENDPOINT;

const client = new ImageAnalysisClient(endpoint, credential);

// Test with a sample image
const imageBuffer = fs.readFileSync('./test-image.jpg');

try {
  const result = await client.analyzeImage(imageBuffer, ["Read"]);
  console.log('✅ Azure Computer Vision connected successfully');
  console.log(`Text detected: ${result.readResult.blocks.length} blocks`);
} catch (error) {
  console.error('❌ Connection failed:', error.message);
}
```

---

## Usage Examples

### Example 1: Process Documents (Existing Workflow)

**Scenario**: Professor has Word documents ready to process

```bash
# Place documents in input folder
cp lesson.docx docs/ingles/

# Process all documents in category
node src/processDocuments.js --category=ingles

# Output:
# 📚 Iniciando processamento de documentos...
# 📂 Categoria: 🇺🇸 Inglês
# ✅ Modo incremental: processando apenas arquivos novos
# 
# 📄 Encontrados 1 documentos
# ============================================================
# 📖 Processando: lesson.docx
# ============================================================
# 1️⃣  Extraindo conteúdo...
#    ✅ Extraído com sucesso: 1523 caracteres
# 2️⃣  Analisando estrutura...
# 🤖 Enriquecendo aula: Simple Past and Irregular Verbs...
# 📂 Tipo de categoria: language
# 🌐 Usando prompt de idiomas...
# 📡 Enviando requisição para Azure OpenAI...
# ✅ Validação PASSOU - estrutura correta
# 3️⃣  Configurando repetição espaçada...
# ✅ Salvo em: data/categories/ingles/lesson-2026-03-20.json
```

---

### Example 2: Process Images (NEW - This Feature)

**Scenario**: Professor takes photo of whiteboard during class

```bash
# Place image in input folder
cp whiteboard-2026-03-20.jpg docs/ingles/

# Process all files (documents + images)
node src/processDocuments.js --category=ingles

# Output:
# 📚 Iniciando processamento de documentos...
# 📂 Categoria: 🇺🇸 Inglês
# 
# 📄 Encontrados 1 imagens, 0 documentos
# ============================================================
# 📖 Processando: whiteboard-2026-03-20.jpg
# ============================================================
# 1️⃣  Validando imagem...
#    ✅ Formato: JPEG (2.1 MB, 2400x1800)
#    ✅ Qualidade: boa (brightness: good, contrast: excellent)
# 2️⃣  Extraindo texto com OCR...
#    📡 Chamando Azure Computer Vision...
#    ✅ Texto extraído: 42 linhas detectadas
#    ✅ Confiança: 87% (good)
#    ⏱️  Tempo de processamento: 8.3s
# 3️⃣  Analisando estrutura...
# 🤖 Enriquecendo aula: Simple Past and Irregular Verbs...
# 📂 Tipo de categoria: language
# (continues as normal enrichment...)
```

---

### Example 3: Batch Processing (Mixed Sources)

**Scenario**: Professor has multiple documents and images ready

```bash
# Place all files in category folder
ls docs/ingles/
# lesson-1.docx
# lesson-2.docx
# photo-1.jpg
# photo-2.jpg

# Process all at once
node src/processDocuments.js --category=ingles

# Output shows processing for each file
# Documents are prioritized (processed first)
# Images processed after documents (slower OCR)
```

---

### Example 4: Force Reprocessing

**Scenario**: Professor updated a lesson and wants to regenerate

```bash
# Reprocess all files (ignores already-processed check)
node src/processDocuments.js --category=ingles --force

# Updates existing lessons
# Preserves student progress data (SRS schedules)
```

---

### Example 5: Retry Failed Enrichments

**Scenario**: Azure OpenAI was temporarily unavailable during processing

```bash
# Check for failed enrichments
node src/processDocuments.js --category=ingles --status

# Output:
# 📊 Status Summary:
#    - enriched: 10
#    - enrichment-failed: 2
#    - pending-enrichment: 1

# Retry only failed enrichments (keeps extracted content)
node src/processDocuments.js --category=ingles --retry-failed

# Output:
# 🔄 Found 2 lessons to retry
# 🔄 Retrying: lesson-2026-03-15...
# ✅ Success: lesson-2026-03-15
# 🔄 Retrying: lesson-2026-03-18...
# ✅ Success: lesson-2026-03-18
```

---

### Example 6: Technology Category

**Scenario**: Process Azure certification content

```bash
# Place Azure content files
cp azure-vms.docx docs/az104/

# Process with technology category
node src/processDocuments.js --category=az104

# Output shows technology-specific enrichment:
# 📂 Tipo de categoria: technology
# 💻 Usando prompt de tecnologia...
# ✅ Validação PASSOU - estrutura correta
# 📊 Enriquecido: 5 topics, 12 concepts, 8 commands, 6 scenarios
```

---

## Testing

### Run Existing Tests

```bash
# Unit tests
npm test

# Integration tests (requires Azure credentials)
npm run test:integration
```

### Test Image Processing Locally

```bash
# Create test-ocr.js
node test-ocr.js ./test-images/sample.jpg
```

**test-ocr.js**:
```javascript
import { extractTextFromImage } from './src/processors/ocrExtractor.js';

const imagePath = process.argv[2];

if (!imagePath) {
  console.error('Usage: node test-ocr.js <image-path>');
  process.exit(1);
}

const result = await extractTextFromImage(imagePath);

if (result.success) {
  console.log('\n✅ OCR Success');
  console.log(`Confidence: ${(result.metadata.confidence * 100).toFixed(0)}%`);
  console.log(`Lines detected: ${result.metadata.linesDetected}`);
  console.log('\n--- Extracted Text ---');
  console.log(result.text);
} else {
  console.error('\n❌ OCR Failed');
  console.error(`Error: ${result.error.message}`);
}
```

---

## Troubleshooting

### Issue: Azure AD Authentication Fails

**Symptoms**:
```
Error: DefaultAzureCredential failed to retrieve a token
```

**Solution**:
1. Ensure you're logged in: `az login`
2. Check subscription: `az account show`
3. Verify VS Code is signed in to Azure
4. Set environment variables:
   ```bash
   export AZURE_CLIENT_ID=<your-client-id>
   export AZURE_TENANT_ID=<your-tenant-id>
   export AZURE_CLIENT_SECRET=<your-secret>
   ```

---

### Issue: Image OCR Returns Low Confidence

**Symptoms**:
```
⚠️ Low OCR confidence: 65% - extracted text may contain errors
```

**Causes**:
- Image too blurry or out of focus
- Poor lighting (too dark/bright)
- Handwriting not clear
- Image resolution too low

**Solutions**:
1. Retake photo with better lighting
2. Ensure text is in focus
3. Use higher resolution (≥1200x900 recommended)
4. Use image editing to increase contrast

---

### Issue: No Text Detected in Image

**Symptoms**:
```
❌ No text detected in image - verify image contains readable text
```

**Causes**:
- Image contains only diagrams/charts
- Text is too small
- Image is blank or corrupted

**Solutions**:
1. Verify image file opens correctly
2. Check that text is visible and readable
3. Ensure image is not just diagrams
4. Try a different image format (JPEG vs PNG)

---

### Issue: Rate Limit Exceeded

**Symptoms**:
```
⏳ Rate limited, retrying in 2000ms...
```

**Causes**:
- Processing too many files too quickly
- Azure OpenAI/Computer Vision quota exceeded

**Solutions**:
1. System automatically retries with exponential backoff
2. Reduce batch size (process fewer files at once)
3. Check Azure service quotas and upgrade if needed

---

### Issue: Enrichment Has Wrong Structure

**Symptoms**:
```
⚠️ Validação FALHOU - estrutura incorreta
🚨 Erros:
   - Technology lesson MUST NOT have 'vocabulary' field
```

**Causes**:
- Category type misconfigured in `categories.json`
- LLM returned wrong structure (rare)

**Solutions**:
1. Check `data/categories.json` - verify `type` field:
   ```json
   { "id": "az104", "type": "technology" }  // NOT "language"
   ```
2. If category type is correct, re-run enrichment (LLM variance)
3. Check LLM prompt in `llmEnricher.js` for clarity

---

## API Reference

### Key Functions

#### `processAllDocuments(categoryId, force)`
- **Purpose**: Main entry point for processing documents/images
- **Parameters**:
  - `categoryId` (string): Category ID from `categories.json`
  - `force` (boolean): If true, reprocess all files
- **Returns**: Summary of processed lessons
- **Location**: `src/processDocuments.js`

#### `extractTextFromImage(imagePath)`
- **Purpose**: Extract text from image using Azure Computer Vision
- **Parameters**: `imagePath` (string): Absolute path to image
- **Returns**: `{success, text, metadata, error?}`
- **Location**: `src/processors/ocrExtractor.js`

#### `enrichWithLLM(lesson, category)`
- **Purpose**: Enrich lesson content with category-specific strategy
- **Parameters**:
  - `lesson` (Lesson): Lesson with `rawContent`
  - `category` (Category): Category with `type` field
- **Returns**: Enriched lesson with validation results
- **Location**: `src/llmEnricher.js`

#### `validateLanguageStructure(lesson)` / `validateTechnologyStructure(lesson)`
- **Purpose**: Validate enriched content structure
- **Parameters**: `lesson` (Lesson): Lesson with `enriched` content
- **Returns**: `{isValid, errors[], warnings[]}`
- **Location**: `src/schemas/languageSchema.js` / `technologySchema.js`

---

## Next Steps

1. **Read the Full Spec**: [spec.md](./spec.md)
2. **Review Research Decisions**: [research.md](./research.md)
3. **Understand Data Model**: [data-model.md](./data-model.md)
4. **Study Contracts**: [contracts/](./contracts/)
5. **Start Implementation**: Follow tasks in [tasks.md](./tasks.md) (generated by `/speckit.tasks`)

---

## Additional Resources

- [Azure Computer Vision Documentation](https://learn.microsoft.com/azure/ai-services/computer-vision/)
- [Azure OpenAI Service Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
- [Azure AD Authentication (DefaultAzureCredential)](https://learn.microsoft.com/javascript/api/@azure/identity/defaultazurecredential)
- [Sharp Image Processing Library](https://sharp.pixelplumbing.com/)

---

**Last Updated**: 2026-03-20  
**Status**: Complete  
**Feedback**: Report issues or suggestions in project repository
