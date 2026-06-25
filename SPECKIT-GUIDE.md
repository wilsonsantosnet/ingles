# 📋 Guia do SpecKit - Sistema de Repetição Espaçada

Este documento explica como usar o **SpecKit** (Spec-Driven Development) neste projeto para documentar e desenvolver novas funcionalidades de forma estruturada.

## 🎯 O que é SpecKit?

SpecKit é um framework de desenvolvimento orientado a especificações (Spec-Driven Development) que ajuda a:
- ✅ Documentar funcionalidades ANTES de implementá-las
- ✅ Separar **O QUÊ** fazer (especificação) do **COMO** fazer (implementação)
- ✅ Garantir que requisitos sejam testáveis e claros
- ✅ Facilitar revisão e aprovação antes de codificar
- ✅ Criar documentação viva que evolui com o projeto

## 📁 Estrutura do Projeto com SpecKit

```
c:\projetos\ingles\
├── .specify/                      # Configuração do SpecKit
│   ├── templates/                 # Templates de documentação
│   │   ├── spec-template.md      # Template de especificação
│   │   ├── plan-template.md      # Template de plano técnico
│   │   ├── tasks-template.md     # Template de tarefas
│   │   └── constitution-template.md
│   ├── memory/
│   │   └── constitution.md       # Princípios e regras do projeto
│   └── scripts/                   # Scripts de automação
│
├── .github/agents/                # Agentes do SpecKit
│   ├── speckit.specify.agent.md  # Cria especificações
│   ├── speckit.plan.agent.md     # Cria planos técnicos
│   ├── speckit.tasks.agent.md    # Gera tarefas
│   └── speckit.implement.agent.md # Executa implementação
│
└── specs/                         # Especificações de features
    └── 001-lesson-creation-process/
        ├── spec.md               # Especificação (O QUÊ)
        ├── plan.md               # Plano técnico (COMO)
        ├── tasks.md              # Lista de tarefas
        └── checklists/
```

## 🚀 Workflow do SpecKit

```
┌────────────────────────────────────────────────────────────┐
│                    WORKFLOW SPECKIT                        │
└────────────────────────────────────────────────────────────┘

1️⃣  /speckit.specify "descrição da funcionalidade"
    ↓
    Cria: specs/###-nome-feature/spec.md
    ✅ Define requisitos funcionais
    ✅ Descreve cenários de uso
    ✅ Estabelece critérios de sucesso
    ✅ Identifica edge cases
    📝 SEM detalhes de implementação!

2️⃣  /speckit.clarify (opcional)
    ↓
    ✅ Faz perguntas de clarificação
    ✅ Refina requisitos ambíguos
    ✅ Atualiza spec.md

3️⃣  /speckit.plan
    ↓
    Cria: specs/###-nome-feature/plan.md
    ✅ Define arquitetura técnica
    ✅ Escolhe tecnologias e padrões
    ✅ Identifica dependências
    ✅ Planeja testes
    💻 AGORA com detalhes técnicos!

4️⃣  /speckit.tasks
    ↓
    Cria: specs/###-nome-feature/tasks.md
    ✅ Lista tarefas ordenadas
    ✅ Define dependências entre tarefas
    ✅ Estima esforço
    ✅ Cria checklist executável

5️⃣  /speckit.implement
    ↓
    ✅ Executa tarefas do tasks.md
    ✅ Implementa código
    ✅ Executa testes
    ✅ Atualiza documentação
```

## 📝 Exemplo: Especificação Criada

Foi criada a primeira especificação para documentar o **processo de criação de sessões de inglês**:

### 📂 Localização
- **Branch**: `001-lesson-creation-process`
- **Spec**: [specs/001-lesson-creation-process/spec.md](specs/001-lesson-creation-process/spec.md)
- **Checklist**: [specs/001-lesson-creation-process/checklists/requirements.md](specs/001-lesson-creation-process/checklists/requirements.md)

### 📋 O que foi documentado

#### 5 User Stories Priorizadas (P1 a P3)
1. **P1 - Create New Lesson from Document** (MVP Core)
   - Professor coloca documento Word na pasta
   - Sistema extrai, enriquece e configura para estudo
   
2. **P2 - Update Existing Lesson Content**
   - Permite atualizar lição sem perder progresso do aluno
   
3. **P2 - Bulk Process Multiple Lessons**
   - Processa múltiplos documentos em batch
   
4. **P3 - Validate Document Before Processing**
   - Valida estrutura antes de processar
   
5. **P3 - Monitor Processing Progress**
   - Mostra progresso detalhado em tempo real

#### 20 Requisitos Funcionais (FR-001 a FR-020)
Exemplo:
- **FR-001**: Sistema DEVE aceitar documentos através de pasta designada
- **FR-005**: Sistema DEVE enriquecer conteúdo com vocabulário, gramática, expressões, exercícios e notas culturais
- **FR-006**: Sistema DEVE preservar 100% dos exemplos originais
- **FR-010**: Sistema DEVE processar documentos incrementalmente

#### 12 Critérios de Sucesso Mensuráveis
- Professor cria nova sessão em **< 5 minutos**
- **100%** de documentos válidos processados com sucesso
- **0%** de perda de conteúdo original
- Mensagens de erro resolvem **90%** dos problemas sem consultar docs
- Lições disponíveis em **< 30 segundos** após processamento

#### 12 Edge Cases Identificados
- Documento vazio
- Data/título ausente
- Serviço de enriquecimento indisponível
- Documentos duplicados
- Falhas parciais de enriquecimento
- Permissões negadas
- E mais...

## 🎓 Como Usar no Dia a Dia

### Criar uma Nova Funcionalidade

```bash
# 1. Descrever a funcionalidade em linguagem natural
# Use o agente speckit.specify através do GitHub Copilot no VS Code
/speckit.specify "Adicionar suporte para áudio nas lições de inglês, permitindo que professores anexem arquivos de áudio para pronúncia"

# 2. Revisar a especificação gerada
# Arquivo criado em: specs/002-audio-support/spec.md

# 3. Se necessário, clarificar requisitos ambíguos
/speckit.clarify

# 4. Criar plano técnico
/speckit.plan "Usar Azure Blob Storage para áudio, React Audio Player no frontend"

# 5. Gerar tarefas
/speckit.tasks

# 6. Implementar (quando aprovado)
/speckit.implement
```

### Documentar Funcionalidade Existente

Se você já tem código implementado mas sem documentação:

```bash
# 1. Criar especificação descrevendo o que o código FAZ
/speckit.specify "Documentar funcionalidade existente de processamento de documentos Word"

# 2. Revisar e ajustar para refletir implementação atual
# Edite manualmente specs/###-nome/spec.md

# 3. Criar plano técnico documentando arquitetura atual
/speckit.plan "Documentar arquitetura existente: mammoth.js para extração, Azure OpenAI para enriquecimento, JSON para storage"
```

## ✅ Boas Práticas

### ✨ SEMPRE na Especificação (spec.md)
- ✅ Use linguagem de **negócio** (professor, aluno, lição)
- ✅ Foque no **valor para o usuário**
- ✅ Descreva **O QUÊ** o sistema deve fazer
- ✅ Use **Given/When/Then** para cenários
- ✅ Defina **critérios mensuráveis** (tempo, percentual, quantidade)
- ✅ Identifique **edge cases**
- ✅ Priorize user stories (**P1, P2, P3**)

### ❌ NUNCA na Especificação
- ❌ Mencionar tecnologias (Node.js, Express, Azure)
- ❌ Descrever APIs ou estruturas de dados
- ❌ Falar sobre arquitetura técnica
- ❌ Mencionar nomes de arquivos ou módulos
- ❌ Incluir código ou pseudocódigo

### 💻 Detalhes Técnicos VÃO NO PLAN.md
- Escolha de tecnologias
- Arquitetura de componentes
- Estruturas de dados
- APIs e endpoints
- Padrões de design
- Estratégia de testes

## 📚 Comandos do SpecKit

| Comando | Descrição | Quando Usar |
|---------|-----------|-------------|
| `/speckit.constitution` | Cria/atualiza princípios do projeto | Início do projeto ou mudança de regras |
| `/speckit.specify` | Cria especificação de feature | Antes de implementar qualquer funcionalidade |
| `/speckit.clarify` | Refina requisitos ambíguos | Quando spec tem [NEEDS CLARIFICATION] |
| `/speckit.plan` | Cria plano técnico | Após spec aprovada |
| `/speckit.tasks` | Gera lista de tarefas | Após plan criado |
| `/speckit.implement` | Executa implementação | Quando pronto para codificar |
| `/speckit.analyze` | Valida consistência | Após tasks geradas |
| `/speckit.checklist` | Cria checklist customizado | Para validações específicas |

## 🎯 Benefícios do SpecKit neste Projeto

### Para o Desenvolvimento
- ✅ Requisitos claros antes de codificar
- ✅ Redução de retrabalho
- ✅ Facilita code review (compara código com spec)
- ✅ Documentação sempre atualizada

### Para o Time
- ✅ Alinhamento sobre O QUÊ será feito
- ✅ Stakeholders não-técnicos podem revisar specs
- ✅ Histórico de decisões de design
- ✅ Facilita onboarding de novos membros

### Para Manutenção
- ✅ Entender propósito do código
- ✅ Verificar se bug é desvio da spec
- ✅ Planejar refatorações com segurança
- ✅ Rastrear evolução de features

## 🔗 Links Úteis

- **Repositório SpecKit**: https://github.com/github/spec-kit
- **Exemplo neste projeto**: [specs/001-lesson-creation-process/](specs/001-lesson-creation-process/)
- **Templates**: [.specify/templates/](.specify/templates/)
- **Agentes**: [.github/agents/](.github/agents/)

## 🆘 Dúvidas Comuns

### "Preciso criar spec para toda mudança?"
- ✅ **SIM** para novas funcionalidades ou mudanças significativas
- ❌ **NÃO** para bugfixes triviais ou refatorações internas

### "E se eu já comecei a codificar?"
- Crie a spec documentando o que **deveria** fazer
- Use para validar se implementação está correta
- Ajuste código para alinhar com spec

### "Spec ficou muito grande, o que fazer?"
- Divida em múltiplas specs menores
- Use prioridades (P1, P2, P3) para fases
- Implemente incrementalmente

### "Como atualizar spec após implementação?"
- Spec deve refletir comportamento **desejado**
- Se código difere da spec: corrija o código ou atualize spec com justificativa
- Mantenha histórico no Git

## 📈 Próximos Passos

Agora que você tem a primeira especificação criada:

1. **Revisar spec.md**
   - Ler [specs/001-lesson-creation-process/spec.md](specs/001-lesson-creation-process/spec.md)
   - Validar user stories e requisitos
   - Aprovar ou solicitar ajustes

2. **Criar plano técnico** (quando spec aprovada)
   ```bash
   /speckit.plan "Usar mammoth.js para extração, Azure OpenAI para enriquecimento, JSON files para storage"
   ```

3. **Gerar tarefas**
   ```bash
   /speckit.tasks
   ```

4. **Implementar** (quando pronto)
   ```bash
   /speckit.implement
   ```

---

**Criado em**: 20 de Março de 2026  
**Versão**: 1.0  
**Primeira Spec**: 001-lesson-creation-process (Criação de Sessões de Inglês)
