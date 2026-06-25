# Tasks: Suporte a Múltiplas Categorias com Estruturas Personalizadas

**Input**: Design documents from `/specs/002-custom-category-schemas/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL and only included if explicitly requested in the feature specification. This spec does not require TDD, so test tasks focus on validation and verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure preparation

- [X] T001 Create directory structure for schemas in src/schemas/
- [X] T002 Verify Node.js version compatibility (Node.js 20+) and ES Modules support
- [X] T003 [P] Document feature overview in README.md section for multiple category types

**Checkpoint**: Basic directory structure ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema validation infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until validation infrastructure is complete

- [X] T004 Create base schema validator framework in src/schemas/schemaValidator.js
- [X] T005 [P] Implement language schema validation function in src/schemas/languageSchema.js
- [X] T006 [P] Implement technology schema validation function in src/schemas/technologySchema.js
- [X] T007 Create validation error/warning reporting structure in src/schemas/schemaValidator.js
- [X] T008 Add schema validator exports and integration points in src/schemas/schemaValidator.js

**Checkpoint**: Foundation ready - validation infrastructure complete, user story implementation can begin in parallel

---

## Phase 3: User Story 1 - Processar categoria de tecnologia (Priority: P1) 🎯 MVP

**Goal**: Sistema processa documentos de categorias tipo "technology" gerando estrutura com topics, concepts, commands, scenarios, examTips

**Independent Test**: Criar categoria AZ-104 (type: technology), processar documento sobre Azure, verificar JSON gerado contém campos corretos (topics/concepts/commands) e NÃO contém campos de idioma (vocabulary/grammar)

### Backend Implementation for User Story 1

- [ ] T009 [P] [US1] Add technology-specific prompt template in src/llmEnricher.js
- [ ] T010 [P] [US1] Implement enrichTechnologyContent() function in src/llmEnricher.js
- [ ] T011 [US1] Add type detection and dispatch logic (switch statement) in enrichWithLLM() function in src/llmEnricher.js
- [ ] T012 [US1] Integrate schema validation call for technology content in src/llmEnricher.js
- [ ] T013 [US1] Add error handling and logging for validation failures in src/llmEnricher.js
- [ ] T014 [US1] Expose category.type field in getCategoryById() function in src/categoryManager.js

### Data Configuration for User Story 1

- [ ] T015 [US1] Add "type": "technology" field to AZ-104 category (or create if doesn't exist) in data/categories.json

### Frontend Implementation for User Story 1

- [ ] T016 [P] [US1] Create CategoryAdapter class structure in public/categoryAdapter.js
- [ ] T017 [P] [US1] Implement renderTechnologyContent() method in public/categoryAdapter.js
- [ ] T018 [US1] Add UI sections for topics, concepts, commands in public/categoryAdapter.js
- [ ] T019 [US1] Add UI sections for scenarios and examTips in public/categoryAdapter.js
- [ ] T020 [US1] Integrate CategoryAdapter instantiation in public/app.js loadLesson() function
- [ ] T021 [US1] Replace direct rendering with adapter.renderEnrichedContent() call in public/app.js

**Checkpoint**: User Story 1 complete - Technology categories process and render correctly

---

## Phase 4: User Story 2 - Manter funcionalidade de categorias de idiomas (Priority: P2)

**Goal**: Garantir 100% backward compatibility - categorias de idioma existentes mantêm todas funcionalidades (vocabulário, gramática, expressões)

**Independent Test**: Usar categoria "ingles" existente (type: language ou sem type), processar documento, verificar JSON mantém todas seções (vocabulary, grammar, expressions, culturalNotes)

### Backend Implementation for User Story 2

- [ ] T022 [US2] Extract current enrichment logic to enrichLanguageContent() function in src/llmEnricher.js
- [ ] T023 [US2] Add default type "language" fallback in enrichWithLLM() function in src/llmEnricher.js
- [ ] T024 [US2] Integrate language schema validation call in enrichLanguageContent() in src/llmEnricher.js
- [ ] T025 [US2] Add logging for type detection (language vs technology) in src/llmEnricher.js

### Data Configuration for User Story 2

- [ ] T026 [US2] Add "type": "language" field to existing language categories in data/categories.json (or leave empty for default)

### Frontend Implementation for User Story 2

- [ ] T027 [P] [US2] Extract current rendering logic to renderLanguageContent() method in public/categoryAdapter.js
- [ ] T028 [US2] Ensure renderEnrichedContent() dispatches to correct renderer based on type in public/categoryAdapter.js
- [ ] T029 [US2] Verify all language-specific UI elements render correctly (vocabulary, grammar, expressions, culturalNotes)

### Validation for User Story 2

- [ ] T030 [US2] Create snapshot of existing lesson JSON before changes for comparison (e.g., data/categories/ingles/lesson-2026-03-04.json)
- [ ] T031 [US2] Manually reprocess an existing language document and compare with snapshot
- [ ] T032 [US2] Verify 100% structural match between old and new language content

**Checkpoint**: User Story 2 complete - Language categories maintain full backward compatibility

---

## Phase 5: User Story 3 - Validar estrutura JSON por tipo de categoria (Priority: P3)

**Goal**: Sistema valida automaticamente que conteúdo enriquecido corresponde à estrutura esperada para o tipo de categoria e reporta inconsistências

**Independent Test**: Simular cenário onde processamento gera estrutura incorreta e verificar se sistema detecta e reporta adequadamente

### Validation Logic Implementation for User Story 3

- [ ] T033 [P] [US3] Implement required fields validation in src/schemas/languageSchema.js
- [ ] T034 [P] [US3] Implement forbidden fields detection in src/schemas/languageSchema.js
- [ ] T035 [P] [US3] Implement required fields validation in src/schemas/technologySchema.js
- [ ] T036 [P] [US3] Implement forbidden fields detection in src/schemas/technologySchema.js
- [ ] T037 [US3] Add minimum count recommendations (e.g., 3 exercises for language, 5 for technology) in src/schemas/schemaValidator.js
- [ ] T038 [US3] Implement error and warning categorization in src/schemas/schemaValidator.js

### Integration for User Story 3

- [ ] T039 [US3] Add validation result logging in src/llmEnricher.js after enrichment
- [ ] T040 [US3] Implement validation failure handling: save partial content with "requires-review" flag in src/llmEnricher.js
- [ ] T041 [US3] Add validation status display in processing UI in public/manage.js

### Error Reporting for User Story 3

- [ ] T042 [P] [US3] Add validation error display in professor management interface in public/manage.js
- [ ] T043 [US3] Implement clear error messages for missing required fields in src/schemas/schemaValidator.js
- [ ] T044 [US3] Implement clear warning messages for unexpected fields in src/schemas/schemaValidator.js

**Checkpoint**: User Story 3 complete - Validation detects and reports 100% of structure inconsistencies

---

## Phase 6: User Story 4 - Adicionar novo tipo de categoria (Priority: P4) ⚠️ OPTIONAL

**Goal**: Permitir adicionar novos tipos de categoria (e.g., "exam-prep") sem modificar código principal do sistema

**Independent Test**: Criar configuração para tipo "exam-prep", processar categoria desse tipo, verificar estrutura customizada é utilizada

**Note**: This user story is P4 (lowest priority) and represents future extensibility. Implementation is OPTIONAL for MVP. If implementing, consider config-driven approach.

### Extensibility Implementation (OPTIONAL)

- [ ] T045 [US4] Design plugin/config structure for new category types in specs/002-custom-category-schemas/research.md
- [ ] T046 [US4] Implement type registry system in src/schemas/schemaValidator.js
- [ ] T047 [US4] Refactor switch statements to use type registry lookup in src/llmEnricher.js
- [ ] T048 [US4] Create example configuration for "exam-prep" type in data/category-types.json
- [ ] T049 [US4] Document process for adding new types in docs/adding-category-types.md

**Checkpoint**: User Story 4 complete (if implemented) - New types can be added via configuration

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final quality assurance

- [ ] T050 [P] Update README.md with category types documentation
- [ ] T051 [P] Verify quickstart.md examples work end-to-end
- [ ] T052 Code cleanup: remove unused code, standardize error messages
- [ ] T053 [P] Add comprehensive logging for debugging (type detection, validation results)
- [ ] T054 Performance verification: ensure processing time remains within ±20% of baseline
- [ ] T055 Security review: validate no sensitive data in logs
- [ ] T056 [P] Create example documents for testing both language and technology categories
- [ ] T057 Final integration test: process language document, verify output
- [ ] T058 Final integration test: process technology document, verify output
- [ ] T059 Manual UI walkthrough: verify all rendering paths work correctly
- [ ] T060 Run quickstart.md validation with real AZ-104 and language categories

**Checkpoint**: Feature complete and production-ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - Can proceed independently
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) - Can proceed in parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 and US2 completion (needs both types implemented)
- **User Story 4 (Phase 6)**: OPTIONAL - Depends on US1, US2, US3 if implemented
- **Polish (Phase 7)**: Depends on all implemented user stories

### User Story Dependencies

- **User Story 1 (P1)**: Independent after Foundational - PRIMARY FEATURE
- **User Story 2 (P2)**: Independent after Foundational - CRITICAL for backward compatibility
- **User Story 3 (P3)**: Depends on both US1 and US2 (validates both type structures)
- **User Story 4 (P4)**: OPTIONAL - Depends on all previous stories (extensibility)

### Within Each User Story

**User Story 1 (Technology Categories)**:
- T009-T010 (prompts) can run in parallel
- T011-T013 (integration) must be sequential
- T014 (categoryManager) independent, can run in parallel with T009-T013
- T015 (data config) independent
- T016-T019 (frontend) can mostly run in parallel
- T020-T021 (integration) must be sequential, depend on T016-T019

**User Story 2 (Language Categories)**:
- T022-T025 (backend) must be sequential
- T026 (data config) independent
- T027-T029 (frontend) must be sequential
- T030-T032 (validation) must be sequential, run after backend complete

**User Story 3 (Validation)**:
- T033-T036 (validation logic) can run in parallel
- T037-T038 (schema validator) must be sequential
- T039-T041 (integration) must be sequential, depend on T037-T038
- T042-T044 (error reporting) can run in parallel with T039-T041

### Parallel Opportunities

**Setup Phase (Phase 1)**:
```bash
T003 # Documentation can run in parallel with directory creation
```

**Foundational Phase (Phase 2)**:
```bash
T005, T006 # languageSchema.js and technologySchema.js can be implemented in parallel
```

**User Story 1 - Backend**:
```bash
T009, T010 # Technology prompt and function can be developed in parallel
T014 # categoryManager changes independent, can run with T009-T013
```

**User Story 1 - Frontend**:
```bash
T016, T017, T018, T019 # All rendering methods can be built in parallel
```

**User Story 2 - Frontend**:
```bash
T027 # Can start in parallel with backend if structure is known
```

**User Story 3 - Validation Logic**:
```bash
T033, T034 # Language schema validations can run in parallel
T035, T036 # Technology schema validations can run in parallel
T042, T043, T044 # Error reporting UI components can run in parallel
```

**Polish Phase (Phase 7)**:
```bash
T050, T051, T053, T056 # All documentation and example tasks can run in parallel
```

---

## Parallel Example: User Story 1 Backend

```bash
# Launch parallel tasks for backend implementation:
Task T009: "Add technology-specific prompt template in src/llmEnricher.js"
Task T010: "Implement enrichTechnologyContent() function in src/llmEnricher.js"
Task T014: "Expose category.type field in src/categoryManager.js"

# Then sequential integration:
Task T011: "Add type detection and dispatch logic in src/llmEnricher.js"
Task T012: "Integrate schema validation"
Task T013: "Add error handling and logging"
```

---

## Parallel Example: User Story 1 Frontend

```bash
# Launch all rendering methods together:
Task T016: "Create CategoryAdapter class structure in public/categoryAdapter.js"
Task T017: "Implement renderTechnologyContent() method"
Task T018: "Add UI sections for topics, concepts, commands"
Task T019: "Add UI sections for scenarios and examTips"

# Then integration:
Task T020: "Integrate CategoryAdapter in app.js"
Task T021: "Replace direct rendering with adapter pattern"
```

---

## Implementation Strategy

### MVP First (Recommended - User Stories 1 + 2)

1. **Complete Phase 1**: Setup (T001-T003) → ~30 minutes
2. **Complete Phase 2**: Foundational (T004-T008) → ~2 hours
3. **Complete Phase 3**: User Story 1 (T009-T021) → ~4-6 hours
4. **Complete Phase 4**: User Story 2 (T022-T032) → ~3-4 hours
5. **STOP and VALIDATE**: Test both types independently
6. **Optional: Add Phase 5**: User Story 3 for validation (T033-T044) → ~2-3 hours
7. **Complete Phase 7**: Polish (T050-T060) → ~2 hours

**Total Estimated Time for MVP**: ~14-18 hours of development

### Incremental Delivery Strategy

**Milestone 1 - Foundation Ready**:
- Setup + Foundational (Phases 1-2)
- Deliverable: Validation infrastructure ready
- Time: ~2.5 hours

**Milestone 2 - Technology Support (MVP)**:
- Add User Story 1 (Phase 3)
- Deliverable: AZ-104 category can process documents with correct structure
- Time: +4-6 hours
- **DEMO READY**: Show technology category processing

**Milestone 3 - Backward Compatibility**:
- Add User Story 2 (Phase 4)
- Deliverable: Language categories maintain 100% functionality
- Time: +3-4 hours
- **PRODUCTION READY**: Both types work, existing data safe

**Milestone 4 - Validation & Quality**:
- Add User Story 3 (Phase 5) + Polish (Phase 7)
- Deliverable: Automatic validation, error reporting, documentation
- Time: +4-5 hours
- **ENTERPRISE READY**: Full validation and error handling

**Milestone 5 - Extensibility (Optional)**:
- Add User Story 4 (Phase 6)
- Deliverable: New types can be added via configuration
- Time: +6-8 hours if implemented
- **FUTURE-PROOF**: Easy to extend for new category types

### Parallel Team Strategy

With 2 developers:

1. **Both**: Complete Setup + Foundational together (~2.5 hours)
2. **Split work**:
   - **Developer A**: User Story 1 (Technology) - Backend (T009-T015)
   - **Developer B**: User Story 1 (Technology) - Frontend (T016-T021)
3. **Both**: User Story 2 (Language compatibility) together (~3-4 hours)
4. **Split work**:
   - **Developer A**: User Story 3 - Validation Logic (T033-T038)
   - **Developer B**: User Story 3 - Integration & Error Reporting (T039-T044)
5. **Both**: Polish & final testing together

**Estimated Time with 2 devs**: ~10-12 hours to production-ready state

---

## Success Metrics

### Phase Completion Criteria

**Phase 1 - Setup**: 
- ✅ Directory `src/schemas/` exists

**Phase 2 - Foundational**:
- ✅ `schemaValidator.js`, `languageSchema.js`, `technologySchema.js` exist
- ✅ Validation functions can be called and return structured results

**Phase 3 - User Story 1**:
- ✅ `enrichTechnologyContent()` function exists in `llmEnricher.js`
- ✅ AZ-104 category has `"type": "technology"` in `categories.json`
- ✅ Processing AZ-104 document generates JSON with topics/concepts/commands
- ✅ Frontend renders technology content with appropriate sections

**Phase 4 - User Story 2**:
- ✅ `enrichLanguageContent()` function exists in `llmEnricher.js`
- ✅ Default type "language" is applied when type is missing
- ✅ Snapshot comparison shows 100% structural match for language content
- ✅ Frontend renders language content identically to before

**Phase 5 - User Story 3**:
- ✅ Validation runs automatically after enrichment
- ✅ Validation errors are logged and displayed to professor
- ✅ Invalid structure is detected (forbidden fields, missing fields)
- ✅ System saves partial content with "requires-review" flag on validation failure

**Phase 7 - Polish**:
- ✅ README updated with category types documentation
- ✅ Quickstart examples verified working
- ✅ Processing time remains within ±20% of baseline
- ✅ Manual UI testing passes for both category types

### Final Acceptance Criteria (maps to spec.md Success Criteria)

- **SC-001**: 100% das lições de idioma mantêm funcionalidades → Verified by T030-T032
- **SC-002**: 0% das lições de tecnologia contêm campos de idioma → Verified by validation in T012, T024
- **SC-003**: 100% validação de estrutura → Implemented in Phase 5
- **SC-004**: 100% detecção de inconsistências → Implemented in T037-T044
- **SC-005**: Processamento em <5 minutos → Verified by T054
- **SC-006**: UI clareza de tipo → Verified by T059
- **SC-008**: Tempo de processamento ±20% → Verified by T054

---

## Notes

### Critical Path

**Blocking path**: Phase 1 → Phase 2 → (Phase 3 | Phase 4) → Phase 5 → Phase 7

**Minimum viable**: Phase 1 + 2 + 3 + 4 = Technology support + Backward compatibility

### Risk Mitigation

**Risk: LLM returns incorrect structure**
- Mitigation: T012, T024 (validation integration), T040 (partial save with review flag)

**Risk: Backward compatibility breaks**
- Mitigation: T030-T032 (snapshot testing), T022-T023 (extract + default fallback)

**Risk: Performance degradation**
- Mitigation: T054 (performance verification), simple validation logic (not deep)

### File Modification Summary

**New files created**:
- `src/schemas/schemaValidator.js`
- `src/schemas/languageSchema.js`
- `src/schemas/technologySchema.js`
- `public/categoryAdapter.js`

**Existing files modified**:
- `src/llmEnricher.js` (major: add dispatch, extract functions, add validation)
- `src/categoryManager.js` (minor: expose type field)
- `data/categories.json` (minor: add type field)
- `public/app.js` (moderate: integrate adapter pattern)
- `public/manage.js` (minor: display validation status)
- `README.md` (documentation)

**Files read/referenced**:
- `specs/002-custom-category-schemas/contracts/language-schema.json`
- `specs/002-custom-category-schemas/contracts/technology-schema.json`
- `data/categories/ingles/lesson-*.json` (for snapshot testing)

### Commit Strategy

Suggested commit points:
- After Phase 1 (Setup)
- After Phase 2 (Foundational)
- After T015 (Backend for US1 complete)
- After T021 (Frontend for US1 complete)
- After T026 (Data config for US2)
- After T032 (Validation for US2 complete)
- After T044 (Validation for US3 complete)
- After Phase 7 (Polish & final)

Commit messages should reference task IDs (e.g., "T009-T010: Add technology prompts and enrichment function")

---

## Estimated Effort Summary

| Phase | Tasks | Estimated Time | Complexity |
|-------|-------|----------------|------------|
| Phase 1: Setup | 3 | 30 min | Low |
| Phase 2: Foundational | 5 | 2 hours | Medium |
| Phase 3: User Story 1 | 13 | 4-6 hours | Medium-High |
| Phase 4: User Story 2 | 11 | 3-4 hours | Medium |
| Phase 5: User Story 3 | 12 | 2-3 hours | Medium |
| Phase 6: User Story 4 (Optional) | 5 | 6-8 hours | High |
| Phase 7: Polish | 11 | 2 hours | Low |
| **Total (MVP - Phases 1-5,7)** | **55 tasks** | **14-18 hours** | **Medium** |
| **Total (Full - All Phases)** | **60 tasks** | **20-26 hours** | **Medium-High** |

### Task Breakdown by Type

- **Backend tasks**: 22 (37%)
- **Frontend tasks**: 15 (25%)
- **Validation tasks**: 14 (23%)
- **Configuration tasks**: 2 (3%)
- **Testing/Validation tasks**: 4 (7%)
- **Documentation/Polish tasks**: 8 (13%)

**Recommended approach**: Start with MVP (Phases 1-5 + 7) for production-ready solution, defer Phase 6 (extensibility) for future iteration based on actual need for new category types.
