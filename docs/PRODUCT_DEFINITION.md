# Portuguese for You — Product Definition

**Status:** DECISION READY  
**Product:** Portuguese for You (PFY)  
**Project type:** greenfield rebuild with selective legacy migration  
**UX reference:** approved PFY navigable prototype, where consistent with this document

## 1. Product vision

Portuguese for You is a digital platform specialized in teaching and learning Portuguese as a Foreign Language (PLE).

PFY supports:

- teacher-mediated synchronous learning;
- independent learner practice;
- structured pedagogical learning paths;
- institutional and sponsored-access models;
- reusable interactive learning content.

The same learning architecture supports teachers and learners. Differences in experience come from permissions, relationships, context and available actions rather than duplicated content catalogs.

The existing WordPress platform is a legacy source of content, users and migration evidence. It is not the technical or domain foundation of the new PFY.

## 2. Product principles

### Identity registration and access

PFY may allow a person to self-register a canonical PFY identity through the approved authentication flow independently of commercial access.

Creating and authenticating a PFY identity does not by itself create:

- Teacher or Student capability;
- an Organization membership;
- a teacher-student relationship;
- a license or license allocation;
- an entitlement;
- paid learning access.

Identity creation, authorization and entitlement are separate product concerns.

The access available to an independently registered user is defined by the applicable authorization and entitlement contracts, not by registration itself.

### 2.1 Activity-first

`Activity` is the fundamental PFY learning unit.

An Activity is not equivalent to an H5P package.

An Activity is a composed learning workspace that may contain editorial content, media and one or more interactive Exercises.

An Activity:

- has its own canonical PFY identity;
- can be discovered and opened independently;
- may participate in one or more Percursos;
- may contain zero, one or multiple scorable Exercises;
- may contain non-scoring interactive content;
- owns Activity-level completion and pedagogical performance semantics.

### 2.2 Shared learning architecture

Teachers and learners access the same Activities and Percursos.

PFY must not maintain separate teacher and learner copies of learning content.

Role/context differences affect capabilities and supplementary information, not canonical learning-content identity.

### 2.3 H5P is an implementation technology

H5P is not a PFY product entity.

H5P may implement an Exercise or interactive content block inside an Activity.

PFY domain semantics must remain portable enough that another interactive technology could later implement an Exercise without redefining Activity, progress, teacher-student relationships or Percursos.

### 2.4 Completion and performance are distinct

Completing an Activity does not imply mastery, passing or strong performance.

PFY independently represents:

- Exercise completion;
- Exercise performance;
- Activity completion;
- Activity performance;
- Percurso progress.

### 2.5 Structured learning without traditional LMS semantics

PFY supports intentional pedagogical sequences through `Syllabus`, presented to users as `Percurso`.

PFY does not define `Course`, `Lesson`, `Module` or `Unit` as current product entities.

The platform should not require traditional LMS course-enrollment or assignment semantics for learners to access learning content.

### 2.6 Commerce is separate from learning

Commercial arrangements originate access but do not define the learning domain.

```text
Commerce / Contract
        ↓
      License
        ↓
    Allocation
        ↓
   Entitlement
        ↓
       User
        ↓
     Learning
```

### 2.7 Relationships are persistent

Teacher-student relationships are distinct from paid access.

Cancellation, expiration or downgrade may suspend entitlement without deleting the underlying teacher-student relationship.

### 2.8 Privacy by design

Permission to see learning data is distinct from permission to see civil identity.

This distinction applies particularly to institutional and PFY Impact reporting.

## 3. Primary personas

### Student

A Student can:

- browse the shared learning library;
- open published Activities independently;
- follow published Percursos;
- perform Exercises;
- repeat Exercises;
- see Activity completion and available performance feedback;
- see their learning history and progress;
- accept teacher invitations.

Students do not require assignments to access Activities.

### Teacher

A Teacher can:

- use the same learning library as Students;
- open and use Activities during synchronous lessons;
- browse and use Percursos;
- invite Students;
- maintain authorized teacher-student relationships;
- view the PFY learning history of linked Students while authorization remains active;
- see Activity completion, Exercise results and pedagogical attention indicators for authorized linked Students.

A Teacher is not automatically a PFY Content Author.

### Content Author

A Content Author is an authorized non-technical pedagogical user, such as a PFY pedagogical consultant.

The authoring experience must support creation and maintenance of composed Activities rather than requiring the author to think of an Activity as a single H5P package.

Content Author is a capability/context, not necessarily a global user role.

### Organization Manager

An Organization Manager administers institutional participation according to contract and reporting policy, including seat allocation and permitted learning-data visibility.

### PFY Admin

PFY administrators manage platform-wide users, organizations, official content, access, configuration and operational controls according to explicitly defined administrative permissions.

## 4. Learning content model

### 4.1 Activity

An Activity is the canonical PFY learning-content unit.

Typical Activity metadata may include:

- title;
- summary;
- cover or illustrative image;
- language level;
- thematic metadata;
- pedagogical metadata;
- publication lifecycle.

Activity content is composed from an ordered sequence of heterogeneous blocks.

```text
Activity
├── identity and metadata
│   ├── title
│   ├── summary
│   ├── cover
│   ├── level
│   └── pedagogical metadata
│
└── ordered content blocks
    ├── editorial content
    ├── heading
    ├── reflection/prompt
    ├── image
    ├── video
    ├── infographic
    ├── external/social embed
    ├── Exercise
    └── other explicitly supported block types
```

The number and order of blocks are content decisions.

PFY must not encode a rigid pedagogical wizard such as:

```text
Introduction -> Video -> Exercise -> Completion
```

unless a specific Activity happens to use that structure.

### 4.2 Pedagogical patterns

PFY Activities commonly contain patterns such as:

- introduction to the theme;
- contextual questions;
- illustrative media;
- sections such as “Bora entender?”;
- one or more interactive Exercises;
- supplementary explanation or reflection.

These are pedagogical patterns, not mandatory platform stages.

For example, “Bora entender?” is not a required system state or fixed database stage.

### 4.3 Exercise

An `Exercise` is an interactive learning component within an Activity.

An Exercise:

- belongs to an Activity;
- has canonical PFY identity;
- may be required for Activity completion;
- may produce zero or more Attempts;
- may produce completion and scoring evidence;
- may be implemented by H5P;
- may later be implemented by another supported interactive technology.

For MVP, H5P is the primary interactive implementation.

### 4.4 H5P-backed Exercise

An H5P-backed Exercise associates a PFY Exercise with one H5P runtime content identity through the PFY H5P Adapter.

```text
PFY Activity
    ↓
PFY Exercise
    ↓
PFY H5P Adapter
    ↓
Lumi/H5P content
```

Lumi identifiers are implementation details and are not canonical PFY Activity or Exercise identifiers.

### 4.5 Required Exercises

Activity completion is based on required Exercises.

For the current product contract:

- Exercises belonging to an Activity are required unless a future explicit optional-exercise capability is introduced;
- editorial and media blocks do not independently require completion;
- Activity completion is not determined by score.

Do not introduce optional-exercise behavior during implementation unless a later product decision explicitly defines it.

## 5. Percursos and Syllabus

### 5.1 Syllabus

`Syllabus` is a first-class PFY pedagogical domain concept.

A Syllabus defines an intentional sequence of Activities and associated pedagogical context.

### 5.2 Percurso

`Percurso` is the learner- and teacher-facing product term for a Syllabus.

Use `Percurso` / `Percursos` in ordinary Portuguese UI.

A Percurso may contain:

- identity and title;
- description/objective;
- language level;
- expected workload;
- ordered Activity sequence;
- pedagogical metadata associated with Activities in that sequence.

Relevant pedagogical metadata may include:

- gêneros discursivos;
- propósitos;
- recursos léxico-gramaticais;
- sugestão de lição de casa.

These fields describe pedagogy and do not create LMS Lesson, Module or Assignment entities.

### 5.3 Activity reuse

An Activity:

- exists independently of any Percurso;
- may belong to zero, one or multiple Percursos;
- retains one canonical identity wherever it appears;
- opens in the same Activity Learning Workspace whether accessed from Explore, a Percurso, learning history or another valid entry point.

Percurso membership must never duplicate the Activity.

### 5.4 Percurso progress

Percurso progress is derived from Activity completion:

```text
completed applicable Activities
--------------------------------
total applicable Activities
```

Scores are not averaged to determine Percurso completion.

Activity performance does not prevent progression through a Percurso.

## 6. Library and discovery

PFY has one shared published learning library.

The learner-facing discovery destination is `Explorar`.

The library is an access/discovery surface, not a learning-content type.

Published Activities may be found and opened independently from Percursos.

Teachers and Students share the same canonical catalog.

PFY must not duplicate Activity records or catalogs by audience.

## 7. Core learner information architecture

The approved Student information architecture is:

```text
Início
Explorar
Percursos
Minha biblioteca
Meu progresso
```

Mobile navigation may use a smaller primary navigation surface, but `Percursos` must remain first-class and readily accessible.

## 8. Teacher-mediated learning

Teacher-mediated synchronous learning is a primary PFY use case.

```text
Teacher + Student
        ↓
synchronous online lesson
        ↓
Teacher opens/shares Activity
        ↓
Teacher explains theme/concept
        ↓
Student performs Exercises
        ↓
PFY captures learning evidence
        ↓
Teacher follows authorized results
        ↓
optional follow-up or homework
```

PFY does not need to provide video conferencing for this flow.

The Activity Learning Workspace must work well both during synchronous teacher-mediated lessons and during independent learner use.

## 9. Homework

Homework does not require a separate PFY Assignment entity for MVP.

A Teacher may ask a Student to continue or perform an Activity or Exercise later.

A Percurso may contain a pedagogical `sugestão de lição de casa`.

Assignments remain future vision unless explicitly promoted by a later product decision.

## 10. Exercise Attempts

An Attempt is one learner execution of one Exercise.

Attempts are append-only.

A later execution must not overwrite an earlier Attempt.

Core Attempt semantics include:

- PFY Exercise identity;
- learner identity;
- monotonically increasing attempt number per learner/Exercise;
- start timestamp;
- completion timestamp when applicable;
- completion state;
- score where available;
- success/pass evidence where available;
- duration where available;
- score provenance.

When PFY needs the current performance of an Exercise, use the learner's **latest completed Attempt** for that Exercise.

Previous Attempts remain available as historical evidence.

An Exercise may validly complete without a score.

Absence of score must never be converted to zero.

For H5P:

```text
score_provenance = client_reported
```

## 11. Activity progress

Activity progress is a PFY-owned domain state.

```text
not_started
    ↓
in_progress
    ↓
completed
```

An Activity becomes completed when all required Exercises belonging to the Activity have completed.

Activity completion:

- does not depend on score;
- does not imply passing;
- does not imply mastery;
- does not require editorial/media blocks to generate artificial completion events.

## 12. Activity performance

Activity performance is separate from Activity completion.

Current Activity performance states:

```text
no_score
adequate
attention
needs_review
```

PFY derives Activity performance from the latest completed Attempts of its scorable Exercises.

`needs_review` is triggered when **50% or more of the Activity's scorable Exercises have a latest completed score below 50%**.

`needs_review`:

- does not make the Activity incomplete;
- does not represent automatic failure;
- does not prevent Percurso progression;
- does not automatically assign remediation;
- does not change learner level;
- does not imply CEFR mastery or lack of mastery.

The following Activity Performance semantics are not yet defined:

- `DECISION REQUIRED — EXERCISE SCOREABILITY / ASSESSMENT SEMANTICS`: this document refers to scorable Exercises but does not define how an Exercise is determined to be scorable. Scoreability must not be inferred from the presence or absence of scores in existing Attempts.
- `DECISION REQUIRED — ACTIVITY PERFORMANCE ADEQUATE/ATTENTION AGGREGATION`: the rule that distinguishes `adequate` from `attention` for scored Activities that do not satisfy `needs_review` is not defined.

Thresholds shown in the UX prototype are proposals only (see `resources/ux/PROTOTYPE-CONFLICTS.md`, UXC-13).

## 13. Learner feedback

When an Activity completes, the learner should receive an explicit result summary.

Completion and performance must be communicated separately.

PFY must not fabricate a single Activity score when the underlying Exercises do not support a defined aggregation contract.

## 14. Teacher attention

An authorized Teacher may see pedagogical attention information for linked Students.

For an Activity marked `needs_review`, PFY should provide evidence supporting the indicator rather than only a label.

Example:

> Revisão recomendada. O aluno concluiu a atividade, mas 4 de 5 exercícios pontuáveis ficaram abaixo de 50%.

Teacher Attention is advisory and not an automatic intervention workflow, Assignment, AI recommendation or learner-risk classification.

## 15. Learning history

PFY learning history distinguishes:

- Exercise history: append-only Attempts;
- Activity history: progress, completion and derived current performance;
- Percurso progress: completion of Activities within a Syllabus/Percurso.

Students can access their own authorized history.

Teachers can access the learning history of linked Students while an active authorized relationship permits it.

## 16. Unsupported aggregate analytics

The current product contract does not define aggregate competence or category scores such as:

- “Gramática 58%”;
- “Vocabulário 82%”;
- “Comunicação 64%”;
- CEFR mastery percentages.

Do not implement or present these as canonical PFY metrics until explicit future contracts exist.

## 17. Teacher-student relationship

Teacher-student relationships are created through invitation and acceptance.

```text
pending
active
revoked
```

A pending invitation grants no learning-data access.

An active authorized relationship permits the Teacher to access the Student's PFY learning history.

A revoked relationship removes that access.

Cancellation or expiration of commercial access does not delete the relationship.

## 18. H5P authoring

PFY must allow authorized non-technical pedagogical users to create and edit composed Activities.

The Activity authoring experience may manage:

- title;
- summary;
- cover;
- pedagogical metadata;
- ordered content blocks;
- editorial content;
- media;
- H5P Exercises;
- preview;
- draft/publish lifecycle.

The stock H5P editor is not the editor for the entire PFY Activity.

Minimum Activity lifecycle remains:

```text
draft
published
archived
```

## 19. AI-assisted authoring

AI-assisted authoring remains future vision and must use PFY-controlled structured representations with human review.

## 20. B2C access model

The primary B2C buyer is a Teacher.

- Monthly plan: Teacher access + capacity for up to 5 Student accesses.
- Quarterly plan: Teacher access + capacity for up to 10 Student accesses.
- Annual plan: Teacher access + capacity for up to 10 Student accesses.

A plan grants capacity; it does not own teacher-student relationships.

## 21. Organizations and B2B

Users may belong to multiple Organizations and may hold different contextual capabilities in each.

Institutional licenses have separate audience capacities, particularly Teacher and Student capacity.

PFY Impact supports sponsored learner access with independently authorized learning-data and identity visibility.

## 22. Institutional reporting

Institutional reporting must derive from canonical learning semantics.

Unsupported competence/category analytics must not be introduced merely because Attempts exist.

## 23. Legacy migration boundary

Required migration includes relevant users, profile data, meaningful relationships, H5P content, H5P libraries/dependencies, assets/media and migration provenance.

The current WordPress Activity experience may contain meaningful content outside H5P, including title, summary, introductory text, images, videos, embeds, H5P ordering and surrounding editorial content.

The migration strategy for this composition is not yet approved:

`DECISION REQUIRED — LEGACY ACTIVITY COMPOSITION MIGRATION`

Legacy Syllabus content also requires an explicit migration/mapping strategy.

Historical learning migration remains optional.

## 24. MVP boundary

### Included

- identity/authentication;
- shared learning library;
- Activity composed-content model;
- Exercises;
- H5P Exercise playback;
- Exercise Attempts and Results;
- Activity Progress;
- Activity Performance;
- Teacher Attention;
- Syllabus/Percurso;
- learner Percurso progress;
- teacher-student invitation and monitoring;
- B2C access capacity;
- Organization / membership / license / allocation / entitlement foundation;
- basic institutional monitoring;
- PFY Impact pseudonymous individual monitoring;
- Activity/H5P authoring capability.

### Not required for initial launch

- teacher-created personal collections;
- formal assignments;
- due-date workflows;
- certificates;
- gamification;
- messaging;
- built-in video conferencing;
- automatic remediation;
- AI recommendations;
- CEFR mastery scoring;
- predictive learner-risk classification;
- advanced category/competency analytics;
- complete legacy learning-history migration;
- sophisticated co-funding;
- advanced impact reports.

## 25. Product terminology

Authoritative current terminology:

| Concept | Product term |
|---|---|
| Fundamental learning unit | Activity / Atividade |
| Interactive component | Exercise / Exercício |
| Structured pedagogical sequence | Syllabus / Percurso |
| Discovery surface | Library / Explorar |
| Learner history/progress | Meu progresso |

The following are not current PFY product entities:

- Course / Curso;
- Lesson / Lição;
- Module / Módulo;
- Unit / Unidade;
- Track;
- Program;
- Certificate.

`Lição de casa` remains valid as pedagogical metadata.

## 26. UX reference authority

The approved PFY prototype is an authoritative UX reference for visual identity, information architecture, navigation, page composition and represented user-facing states.

The prototype is not the authoritative source for database schema, domain invariants, authorization, calculation rules beyond explicitly approved decisions, migration semantics, architecture, security or unrepresented edge cases.

Mock data in the prototype does not establish product semantics.

The prototype and the register of its known conflicts with this document are versioned under `resources/ux/`.

## 27. Current state

**DECISION READY**

This document owns current PFY product intent.

If implementation discovers a constraint requiring a material change to these contracts, return:

`BLOCKED / DECISION REQUIRED`
