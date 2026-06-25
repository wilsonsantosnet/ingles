# Feature Specification: Lesson Creation Process

**Feature Branch**: `001-lesson-creation-process`  
**Created**: March 20, 2026  
**Status**: Draft  
**Input**: User description: "Processo de criação de sessões de inglês com enriquecimento via Azure OpenAI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create New Lesson from Document (Priority: P1)

A professor creates a new English lesson by placing a formatted document in a designated folder and running a simple command. The system automatically processes the document, extracts content, enriches it with educational enhancements, and makes it available for students to study.

**Why this priority**: This is the core functionality that enables professors to create new study content. Without this, no lessons can be added to the system.

**Independent Test**: Can be fully tested by placing a single valid document in the input folder, executing the process command, and verifying that a structured lesson appears in the lessons list with all enrichment complete.

**Acceptance Scenarios**:

1. **Given** a professor has created a document with lesson content (title, date, vocabulary, examples), **When** the professor places the document in the input folder and executes the process command, **Then** the system creates a new lesson with extracted content, enrichment, and spaced repetition settings configured
2. **Given** a lesson document has been processed successfully, **When** the professor views the lesson list, **Then** the new lesson appears with its title, date, and enriched content visible
3. **Given** a new lesson has been created, **When** a student accesses the study interface, **Then** the lesson is immediately available for study with vocabulary, grammar topics, and exercises
4. **Given** the professor created a lesson on a specific date, **When** the lesson is processed, **Then** the spaced repetition schedule starts from that date with initial review intervals set appropriately

---

### User Story 2 - Update Existing Lesson Content (Priority: P2)

A professor needs to update an existing lesson after initial creation (fix typos, add vocabulary, clarify grammar explanations). The professor updates the source document and re-processes it, and the system updates the lesson while preserving student progress data.

**Why this priority**: Lessons may need corrections or improvements after initial creation. This ensures content quality without losing student data.

**Independent Test**: Can be tested by modifying an existing lesson document, re-processing it with a force flag, and verifying the updated content appears while student review schedules remain intact.

**Acceptance Scenarios**:

1. **Given** an existing lesson with student review data, **When** the professor updates the source document and forces re-processing, **Then** the lesson content is updated while student progress and review schedules are preserved
2. **Given** a professor wants to add new vocabulary to an existing lesson, **When** the updated document is processed, **Then** new vocabulary items are added without removing existing enrichment
3. **Given** a lesson has been updated, **When** students access it, **Then** they see the updated content immediately

---

### User Story 3 - Bulk Process Multiple Lessons (Priority: P2)

A professor prepares multiple lesson documents at once (e.g., a month's worth of lessons) and processes them all in a single operation. The system processes each document incrementally, skipping those already processed, and provides progress feedback.

**Why this priority**: Enables efficient batch preparation of content, saving professor time when planning ahead.

**Independent Test**: Can be tested by placing multiple new documents in the input folder, executing the process command once, and verifying all documents are processed correctly without redundant work.

**Acceptance Scenarios**:

1. **Given** five new lesson documents in the input folder, **When** the professor executes the process command, **Then** all five lessons are created successfully with progress logged for each
2. **Given** the input folder contains both new and previously processed documents, **When** the process command runs, **Then** only new documents are processed, and previously processed ones are skipped
3. **Given** multiple documents are being processed, **When** one document fails validation, **Then** processing continues for remaining documents and the failure is logged clearly

---

### User Story 4 - Validate Document Before Processing (Priority: P3)

A professor wants immediate feedback if their document is incorrectly formatted before spending time on processing. The system validates document structure and reports specific issues (missing date, missing title, incorrect format) with actionable error messages.

**Why this priority**: Prevents wasted time processing invalid documents and helps professors understand formatting requirements.

**Independent Test**: Can be tested by submitting documents with various structural issues and verifying clear, specific error messages are returned before any processing occurs.

**Acceptance Scenarios**:

1. **Given** a document without a valid date, **When** the professor attempts to process it, **Then** the system reports "Date not found or invalid format. Expected: DD Month YYYY" and skips processing
2. **Given** a document without a title, **When** validation runs, **Then** the system reports "Title missing from document" with the document name
3. **Given** an empty document, **When** validation runs, **Then** the system reports "Document appears to be empty" and provides guidance on minimum content requirements
4. **Given** all documents pass validation, **When** processing begins, **Then** the professor sees a clear list of which documents will be processed

---

### User Story 5 - Monitor Processing Progress (Priority: P3)

A professor wants to see detailed progress while lessons are being processed, especially when processing multiple documents or when enrichment takes time. The system provides real-time feedback on each processing stage.

**Why this priority**: Improves user experience during potentially long operations and helps identify where issues occur.

**Independent Test**: Can be tested by processing a document and observing that each processing stage (extraction, parsing, enrichment, saving) is logged with timestamps and status.

**Acceptance Scenarios**:

1. **Given** a lesson is being processed, **When** each processing stage completes, **Then** the professor sees a log entry with stage name, status, and duration
2. **Given** enrichment is taking longer than expected, **When** the professor checks progress, **Then** the system indicates "Enrichment in progress" with elapsed time
3. **Given** processing completes successfully, **When** the final log appears, **Then** it includes total time, enrichment summary (vocabulary count, grammar topics count, exercises count), and file location

---

---

### User Story 6 - Create Lesson from Image (Priority: P2)

A professor takes a photo of handwritten notes or a whiteboard during class and wants to convert it into a structured lesson. The professor places the image file in the input folder, and the system extracts text content using OCR/Vision AI, then enriches it following the same process as document-based lessons.

**Why this priority**: Enables quick lesson creation from real classroom materials without requiring typed documents. Particularly valuable for capturing spontaneous teaching moments or student contributions.

**Independent Test**: Can be tested by placing an image file (JPEG/PNG) with readable text content in the input folder, processing it, and verifying that text is accurately extracted and enriched into a complete lesson.

**Acceptance Scenarios**:

1. **Given** a professor has a clear photo of whiteboard notes, **When** the image is placed in the input folder and processed, **Then** the system extracts text content, creates a structured lesson, and enriches it with vocabulary and grammar
2. **Given** an image contains both printed and handwritten text, **When** the system processes it, **Then** both text types are extracted and included in the lesson content
3. **Given** an image has poor quality or is blurry, **When** the system attempts OCR, **Then** it reports "Image quality too low for text extraction - please provide a clearer image" with confidence score
4. **Given** an image is processed successfully, **When** the professor views the lesson, **Then** the source is marked as "📸 Image" to distinguish it from document sources
5. **Given** an image contains a lesson date in the content, **When** the system processes it, **Then** the date is automatically extracted and used for the lesson ID

---

### User Story 7 - Specialized Enrichment by Category Type (Priority: P1)

A professor manages both language lessons (English) and technology certification content (AZ-104). The system automatically detects the category type and applies specialized enrichment: language categories extract vocabulary/grammar/expressions, while technology categories extract topics/concepts/commands/scenarios.

**Why this priority**: Different content types require fundamentally different enrichment strategies. Generic enrichment produces poor results for technical content.

**Independent Test**: Can be tested by processing a language lesson and a technology lesson, then verifying each has appropriate enrichment fields (vocabulary for language, commands for technology) without irrelevant fields.

**Acceptance Scenarios**:

1. **Given** a professor processes an English lesson, **When** enrichment runs, **Then** the system extracts vocabulary (word, translation, examples), grammar topics (explanation, rules), and expressions
2. **Given** a professor processes an AZ-104 lesson, **When** enrichment runs, **Then** the system extracts technical topics, key concepts, Azure CLI commands, PowerShell examples, and scenario-based questions
3. **Given** a category is marked as type "language", **When** any lesson in that category is enriched, **Then** the LLM prompt emphasizes vocabulary acquisition, grammar structures, and conversational usage
4. **Given** a category is marked as type "technology", **When** any lesson is enriched, **Then** the LLM prompt emphasizes technical accuracy, command syntax, troubleshooting scenarios, and certification exam relevance
5. **Given** enrichment completes for a technology lesson, **When** the professor views it, **Then** practice questions are technical scenarios, multiple-choice certification-style questions, and command completion exercises

---

### Edge Cases

- **Empty Document**: What happens when a professor places an empty document in the input folder? System should detect and report "Document appears to be empty" without attempting processing.

- **Empty Image**: What happens when an image file is provided but contains no readable text? System should report "No text content detected in image - please verify image contains readable text" without creating a lesson.

- **Mixed Image (Text + Diagrams)**: What happens when an image contains both text and diagrams? System should extract all readable text and note in metadata that "Image may contain visual elements not captured in text extraction".

- **Image File Size**: What happens when an image file is very large (high resolution)? System should resize if necessary for optimal OCR processing and log "Image resized from [original] to [processed] for OCR".

- **Unsupported Image Format**: What happens when a professor provides a TIFF or BMP file? System should report "Image format not supported - please use JPEG or PNG" or attempt conversion if feasible.

- **Category Type Mismatch**: What happens when a professor accidentally processes an English lesson in a technology category? System should detect language indicators (e.g., translations, grammar terms) and warn "Content appears to be language-focused but category is technology type - continue anyway?".

- **Missing Date**: What happens when a document lacks a valid date? System should report the specific date format expected and skip processing.

- **Missing Title**: What happens when a document has no title? System should report "Title missing" and skip processing.

- **Enrichment Service Unavailable**: What happens when the enrichment service fails (service down, rate limit, invalid credentials)? System should save the raw extracted content without enrichment, mark status as "pending-enrichment", log the specific error, and allow retry later without re-extracting.

- **Already Processed Document**: What happens when a professor tries to process a document that was already processed? System should skip it by default and log "Skipping [filename] - already processed on [date]". Force flag should override this.

- **Invalid Document Format**: What happens when the input file is corrupted or not a valid document format? System should report "Unable to read document - file may be corrupted or invalid format" and continue with next document if batch processing.

- **Input Folder Missing**: What happens when the designated input folder doesn't exist? System should report "Input folder not found at [path]. Please create the folder and add documents" with clear instructions.

- **Duplicate Date**: What happens when two documents have the same date? System should report "Lesson for date [YYYY-MM-DD] already exists. Use force flag to overwrite or choose a different date" and skip processing.

- **Inconsistent Date Format**: What happens when dates vary in format (e.g., "18 June 2025" vs "June 18, 2025" vs "18/06/2025")? System should normalize to consistent internal format (YYYY-MM-DD) and log the original format detected.

- **Permission Denied**: What happens when the system lacks write permissions for output folders? System should report "Permission denied - cannot write to [path]" with instructions to check folder permissions.

- **Partial Enrichment Failure**: What happens when enrichment succeeds for vocabulary but fails for grammar topics? System should save successfully enriched sections, mark failed sections as "enrichment-incomplete" in status, and allow selective retry.

- **Very Large Document**: What happens when a professor submits an extremely large document (100+ pages)? System should warn if document size exceeds reasonable lesson size and ask for confirmation before processing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept documents as input through a designated folder location accessible to professors

- **FR-002**: System MUST validate document structure before processing, checking for required elements (title, date, content) and reporting specific validation failures

- **FR-003**: System MUST extract content from documents, preserving all text including titles, dates, vocabulary examples, grammar explanations, and expressions

- **FR-004**: System MUST parse extracted content into a structured format with identifiable sections (vocabulary, grammar, expressions, examples)

- **FR-005**: System MUST enrich lesson content by:
  - Identifying vocabulary with translations, definitions, pronunciation guidance, and usage examples
  - Extracting or generating grammar topics with explanations and rules
  - Identifying idiomatic expressions with meanings and usage contexts
  - Generating practice exercises based on the lesson content
  - Adding relevant cultural notes where appropriate

- **FR-006**: System MUST preserve all original examples and content from the source document during enrichment (no content loss)

- **FR-007**: System MUST automatically configure spaced repetition settings for new lessons with appropriate initial intervals, repetition counts, and ease factors

- **FR-008**: System MUST store lessons in a structured, persistent format with unique identifiers based on date (format: lesson-YYYY-MM-DD)

- **FR-009**: System MUST maintain an index of all lessons organized by category for efficient retrieval

- **FR-010**: System MUST process documents incrementally, skipping already processed documents unless explicitly instructed to reprocess

- **FR-011**: System MUST provide a force mode option that allows reprocessing of previously processed documents

- **FR-012**: System MUST log detailed progress information during processing, including:
  - Document being processed
  - Current processing stage (extraction, parsing, enrichment, saving)
  - Success or failure status for each stage
  - Duration of processing operations
  - Summary statistics (vocabulary count, topics count, etc.)

- **FR-013**: System MUST handle processing failures gracefully, allowing continuation of batch operations when individual documents fail

- **FR-014**: System MUST report clear, actionable error messages when failures occur, including:
  - Specific reason for failure
  - Document or operation that failed
  - Suggested remediation steps
  - Location of logs for more details

- **FR-015**: System MUST support processing multiple documents in a single operation (batch processing)

- **FR-016**: System MUST detect and handle duplicate lessons (same date) with clear warnings and options

- **FR-017**: System MUST normalize date formats from documents to a consistent internal format (YYYY-MM-DD)

- **FR-018**: System MUST make processed lessons immediately available for student study upon successful completion

- **FR-019**: When updating existing lessons (force mode), system MUST preserve student progress data including review schedules, repetition counts, and performance history

- **FR-020**: System MUST provide feedback on validation errors before beginning processing, listing all validation issues found across all documents in batch

- **FR-021**: System MUST accept image files (JPEG, PNG) as input sources in addition to documents

- **FR-022**: System MUST extract text content from images using OCR/Vision AI technology (Azure Computer Vision), preserving text structure and detecting dates, titles, and content sections

- **FR-023**: System MUST apply specialized enrichment strategies based on category type:
  - For **language** categories (type: "language"): Extract vocabulary (word, translation, definition, examples), grammar topics (rules, explanations), expressions (idioms, collocations), and conversational exercises
  - For **technology** categories (type: "technology"): Extract technical topics, key concepts, commands (Azure CLI, PowerShell, bash), code snippets, troubleshooting scenarios, and certification-focused practice questions

- **FR-024**: System MUST validate image quality before OCR processing, reporting confidence scores and warning when image quality is insufficient for accurate text extraction

- **FR-025**: System MUST track lesson source type (docx, manual, image) in metadata for filtering and reporting purposes

- **FR-026**: System MUST use category-specific LLM prompts for enrichment, ensuring language categories receive language-learning-focused enrichment and technology categories receive technical-certification-focused enrichment

- **FR-027**: System MUST handle mixed content in images (text + diagrams/charts) by extracting text and noting presence of non-textual elements in metadata

### Key Entities

- **Lesson**: Represents a single study session with content from a specific date. Contains extracted raw content, enriched educational content (vocabulary, grammar, expressions, exercises, cultural notes), spaced repetition configuration, processing status, and source type (docx, manual, image).

- **Document Metadata**: Information extracted from source document or image including title, date, original format, source type, and OCR confidence score (for images). Links source to generated lesson.

- **Image Source**: Represents an image file used as lesson input, including file path, image dimensions, format (JPEG/PNG), OCR confidence score, and extraction timestamp.

- **Vocabulary Item**: (Language categories only) A word or phrase from the lesson with translation, definition, usage examples, pronunciation guidance, part of speech, synonyms, and difficulty level.

- **Grammar Topic**: (Language categories only) A grammatical concept covered in the lesson with explanation, rules, examples, and common mistakes to avoid.

- **Expression**: (Language categories only) An idiomatic expression or collocation with meaning, usage context, and example sentences.

- **Technical Topic**: (Technology categories only) A technology concept or feature covered in the lesson with description, use cases, and best practices.

- **Command/Code Snippet**: (Technology categories only) A technical command (Azure CLI, PowerShell, bash) or code example with syntax, parameters, expected output, and usage context.

- **Concept**: (Technology categories only) A fundamental technical principle or theory with explanation, real-world applications, and related topics.

- **Exercise**: A practice item for student learning with type (multiple choice, fill-in-blank, translation, scenario, command completion, troubleshooting), question text, correct answer, and optional hint. Exercise type varies by category type.

- **Cultural Note**: (Language categories only) Contextual cultural information related to lesson content, including topic and explanatory content.

- **Spaced Repetition Schedule**: Configuration for when lesson should be reviewed, including current interval (days), number of previous repetitions, ease factor (difficulty adjustment), and next review date.

- **Processing Status**: Current state of lesson processing (pending, extracting, ocr-processing, enriching, enriched, failed, pending-enrichment, enrichment-incomplete).

- **Category Index**: Organizational structure maintaining list of all lessons in a category with metadata for quick lookup and filtering. Includes category type for enrichment routing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Professors can create a new lesson from document to available-for-study in under 5 minutes for typical lesson content (3-5 pages)

- **SC-002**: 100% of properly formatted documents are processed successfully without manual intervention

- **SC-003**: All original examples and content from source documents appear in the final lesson (0% content loss)

- **SC-004**: Spaced repetition schedules are automatically configured for 100% of successfully processed lessons

- **SC-005**: When processing multiple documents in batch, previously processed documents are skipped (incremental processing works correctly 100% of the time)

- **SC-006**: Error messages provide sufficient information for professors to fix document issues without consulting documentation in 90% of validation failures

- **SC-007**: Processing failures for individual documents do not block processing of remaining documents in batch operations (100% resilience to partial failures)

- **SC-008**: Lessons are immediately available for student study within 30 seconds of successful processing completion

- **SC-009**: When updating existing lessons, 100% of student progress data (review schedules, repetition history) is preserved

- **SC-010**: Processing logs provide sufficient detail to diagnose any processing issues without requiring code inspection (for 95% of issues)

- **SC-011**: Professors can successfully identify and fix validation errors on first attempt in 85% of cases based on error message clarity

- **SC-012**: System handles enrichment service unavailability gracefully, allowing retry without data loss in 100% of cases

- **SC-013**: Image files with clear, readable text achieve 95%+ text extraction accuracy

- **SC-014**: Language category lessons have 0% technology-specific fields (commands, technical topics) and 100% language-specific fields (vocabulary, grammar, expressions)

- **SC-015**: Technology category lessons have 0% language-specific fields (vocabulary, grammar, expressions) and 100% technology-specific fields (topics, commands, concepts)

- **SC-016**: OCR processing completes within 2 minutes for typical classroom images (1-3 pages equivalent of text)

- **SC-017**: System correctly detects category type and routes to appropriate enrichment strategy 100% of the time

- **SC-018**: Image quality validation prevents processing of unreadable images in 90%+ of cases before attempted OCR

- **SC-019**: Technology lessons generate certification-relevant practice questions (scenario-based, troubleshooting, command syntax) in 100% of cases

- **SC-020**: Language lessons generate conversation-focused exercises (role-play, translation, grammar practice) in 100% of cases

### Assumptions

- Professors have basic computer skills and can place files in folders and run simple commands
- Documents and images follow a consistent structural pattern (title, date, content sections) even if format details vary
- Network connectivity is available for content enrichment services and OCR/Vision API
- Professors create documents/images in advance of student study dates (not real-time during student sessions)
- Document content is primarily text-based; images should have readable text (handwritten or printed)
- A single lesson corresponds to a single study session or class period
- Images are clear enough for OCR to extract text with reasonable accuracy (not severely blurred or low contrast)
- Professors have appropriate file system permissions for input and output folders
- Lesson dates are unique within a category (one lesson per date per category)
- Content enrichment quality is acceptable even if not perfect (professors can manually edit if needed)
- Category type (language vs technology) is correctly configured in categories.json before lesson processing
- Azure Computer Vision service (or equivalent OCR API) is configured and accessible for image processing
- Different category types require fundamentally different enrichment structures (not one-size-fits-all)
