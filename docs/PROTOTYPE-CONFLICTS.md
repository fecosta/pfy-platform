# PFY Prototype — Known Conflicts and Open Decisions

**Status:** CURRENT  
**Prototype snapshot:** `prototype/pfy-platform-prototype.dc.html` (2026-09-18)  
**Last reviewed:** 2026-09-19

This register lists places where the PFY prototype conflicts with, or goes beyond, the authoritative documentation.

It does not resolve any product decision. Authority rules are defined in `README.md` in this directory.

## Classification

| Class | Meaning | Treatment |
|---|---|---|
| `CONFLICT` | The prototype contradicts an authoritative contract. | Do not implement. Changing the contract requires an explicit product decision. |
| `DECISION REQUIRED` | Authoritative documents do not define the concept, and the prototype shows it. | Do not implement from the prototype. Resolve through a product decision before any SPEC includes it. |
| `UNDEFINED` | Minor element with no contract. | Do not implement without a definition in the governing SPEC. |
| `PROPOSAL` | The prototype encodes a possible answer to a pending decision. | Input to that decision only. Not approved behavior. |

## Register

### UXC-01 — Fixed, sequential Activity workspace

**Class:** `CONFLICT`

**Prototype:** the Activity Learning Workspace reveals blocks progressively through step buttons ("Começar atividade", "Continuar", "Ir para a prática", "Ir para a reflexão"). A progress rail shows fixed section labels: `Antes de começar`, `Bora entender?`, `Vídeo`, `Prática`, `Reflexão` (and `Sobre a atividade`, `Conteúdo`, `Exercício interativo` for other Activities).

**Contracts:** `PRODUCT_DEFINITION.md` §4.1–4.2; ADR-002; SPEC-004 §5.2 and §11.

- Activity content is an ordered sequence of heterogeneous blocks decided per Activity.
- PFY must not encode a rigid pedagogical sequence.
- `Bora entender?` is a content pattern, not a system stage.
- Navigating through passive blocks must not be required.

### UXC-02 — Manual Activity and Exercise completion

**Class:** `CONFLICT`

**Prototype:** a "Concluir atividade" button completes the Activity, in one case only after the reflection block. A "Marcar exercício como concluído" button completes an Exercise. The prototype labels the exercise UI as a representation.

**Contracts:** `PRODUCT_DEFINITION.md` §11; `ARCHITECTURE.md` §12; ADR-002; SPEC-006 §5.10.

- Activity completion is derived: all required Exercises completed.
- Exercise completion comes from Exercise Attempt evidence, e.g. from the H5P runtime, not from a learner button.

The completion summary itself (completion shown separately from results) is aligned and may guide UX.

### UXC-03 — Written reflection input and persistence

**Class:** `DECISION REQUIRED — WRITTEN REFLECTION INPUT`

**Prototype:** the reflection block contains a free-text field ("Escreva sua reflexão aqui...").

Authoritative documents define `reflection/prompt` only as a content block type. They do not define:

- whether learner-written text is persisted;
- who may see it (learner, linked Teacher, organization);
- privacy/LGPD treatment and retention;
- whether it is an Exercise, produces Attempts or affects completion.

**Affects:** SPEC-004 (block types), SPEC-006, SPEC-008, SPEC-011.

### UXC-04 — Gamification

**Class:** `CONFLICT`

**Prototype:** "Sequência atual — 3 dias" on the learner home and on "Meu progresso". The landing page promises "conquistas".

**Contracts:** `PRODUCT_DEFINITION.md` §24 (gamification not required for initial launch); `AGENTS.md` §8.

### UXC-05 — Recommendations

**Class:** `CONFLICT`

**Prototype:** "Atividades recomendadas" and "Recomendadas para você" on the learner home (a static list in the mock).

**Contracts:** `PRODUCT_DEFINITION.md` §24 (AI recommendations not required for initial launch); `docs/README.md` (automatic remediation/recommendations are future vision).

A non-algorithmic, editorially curated selection is not defined either. If wanted, it requires a product decision.

### UXC-06 — Learner level

**Class:** `DECISION REQUIRED — LEARNER LEVEL`

**Prototype:** "Nível atual: A2" on "Meu progresso". A level is shown per student in the teacher views.

Authoritative documents define level as Activity/Percurso content metadata. They mention learner level only to say that `needs_review` must not change it.

The source and semantics of a learner level (self-declared, teacher-set, placement, other) are undefined. It must not be derived from scores or presented as CEFR mastery (`PRODUCT_DEFINITION.md` §12, §16).

**Affects:** SPEC-002 (profile), SPEC-006, SPEC-008.

### UXC-07 — Learning-time metric

**Class:** `UNDEFINED`

**Prototype:** "6h 40m — tempo de aprendizado".

No contract defines this metric. H5P duration is optional and `client_reported`.

### UXC-08 — Classes (Turmas)

**Class:** `DECISION REQUIRED — TEACHER STUDENT GROUPING (CLASSES)`

**Prototype:** "Minhas turmas", "+ Nova turma", class detail pages, "4 turmas ativas". The landing and institutional copy also refer to "turmas".

Authoritative documents define teacher–student relationships through invitation and acceptance (`PRODUCT_DEFINITION.md` §17). They define no Class/Group entity.

SPEC-004 §11 forbids inferring a Percurso from class.

**Affects:** SPEC-008, SPEC-010.

### UXC-09 — Assignments

**Class:** `CONFLICT`

**Prototype:** "Atividades atribuídas" on the class detail page; "7 atividades atribuídas essa semana" on the teacher home.

**Contracts:** `PRODUCT_DEFINITION.md` §9 and §24 (formal assignments are not MVP); SPEC-004 §6; SPEC-008 out of scope; `AGENTS.md` §8.

### UXC-10 — Generic learner progress percentage

**Class:** `CONFLICT`

**Prototype:** per-student progress bars (62%, 48%, 75%, ...) in the class detail page.

**Contracts:** SPEC-004 §11 ("do not display an invented generic learner-progress percentage"); SPEC-006 §16.

The only defined progress denominator is Percurso progress: completed applicable Activities / total applicable Activities.

### UXC-11 — Completion and performance conflated

**Class:** `CONFLICT`

**Prototype:**

- the teacher's student history replaces "Concluída" with "Revisão recomendada" for an Activity marked `needs_review`;
- "Meu progresso" shows "Resultado do exercício: 67%" on an Activity row;
- "Meu progresso" labels an Activity "Revisão recomendada" from a single score.

**Contracts:** `PRODUCT_DEFINITION.md` §12–13.

- Completion and performance are communicated separately. A `needs_review` Activity remains completed.
- PFY must not fabricate a single Activity score.
- `needs_review` is an Activity-level rule over scorable Exercises, not a label for one low score.

The teacher-facing evidence text ("X de Y exercícios pontuáveis ficaram abaixo de 50%") is aligned with §14.

### UXC-12 — Exercise scoreability inferred from Attempt evidence

**Class:** `CONFLICT` (prototype logic) + `DECISION REQUIRED — EXERCISE SCOREABILITY / ASSESSMENT SEMANTICS`

**Prototype:** `activityNeedsReview()` and the student-history mapping treat an Exercise as scorable when its latest score is non-null.

This inference must not be implemented. Under it:

- scoreability would depend on learner evidence rather than on the Exercise;
- an unattempted Exercise would have unknown scoreability;
- the `needs_review` denominator would vary per learner.

How PFY determines whether an Exercise is scorable, and the related assessment semantics, remain an unresolved product-model decision. See `PRODUCT_DEFINITION.md` §12 and SPEC-006 §11.

**Affects:** SPEC-004 (possibly the Exercise model), SPEC-005, SPEC-006.

### UXC-13 — Performance thresholds (50% / 70%)

**Class:** `PROPOSAL` — input to `DECISION REQUIRED — ACTIVITY PERFORMANCE ADEQUATE/ATTENTION AGGREGATION`

**Prototype:** `performanceLabel(pct)` classifies an individual Exercise's latest completed score:

```text
>= 70%  adequate
>= 50%  attention
<  50%  needs_review
```

This is not approved behavior.

- Only the Activity-level `needs_review` rule is approved: 50% or more of scorable Exercises with latest completed score below 50%.
- The 70% threshold, Exercise-level performance bands and the use of `needs_review` as an Exercise-level label are not approved.
- The prototype defines no Activity-level rule separating `adequate` from `attention`.

See SPEC-006 §11.

### UXC-14 — "Current Percurso" of a learner

**Class:** `DECISION REQUIRED — CURRENT PERCURSO SEMANTICS`

**Prototype:** the learner home shows a "percurso atual". The teacher view shows Percurso progress only when a student record carries a Percurso reference (`percursoId`).

Learners must not need enrollment (`PRODUCT_DEFINITION.md` §2.5). SPEC-004 §11 forbids inferring a Percurso from level, class or teacher relationship.

It is undefined whether a "current Percurso" exists, and whether it is derived from learner activity or explicitly chosen.

**Affects:** SPEC-004, SPEC-006, SPEC-008.

### UXC-15 — Generic institutional license capacity

**Class:** `CONFLICT`

**Prototype:** the institutional overview shows "142 / 200 licenças utilizadas" as a single pool.

**Contracts:** `PRODUCT_DEFINITION.md` §21; `ARCHITECTURE.md` §24; SPEC-009; SPEC-010. Institutional licenses have separate audience capacities, particularly Teacher and Student.

The overview also lists teacher names only. The independent learning-data vs. civil-identity visibility required for PFY Impact (`PRODUCT_DEFINITION.md` §2.8, §21) is not represented, so it is not validated by the prototype.

### UXC-16 — Status colors

**Class:** `CONFLICT`

**Prototype:**

- `attention` uses `brand.yellow.800` (`#91651B`);
- `needs_review` uses `brand.coral.800` (`#993733`) on a coral surface with an alert icon, i.e. error styling;
- completed/success uses greens (`#4A6B4A`, `#3F5C3F`, `#EAF1E8`) that do not exist in the design tokens.

**Contracts:**

- `DESIGN-TOKENS.md` §16: do not map coral → error or yellow → warning; status values require accessibility validation (§50, §54).
- `PRODUCT_DEFINITION.md` §12: `needs_review` is pedagogical attention, not failure.

Status colors must come from a validated semantic status palette in the design tokens.

### UXC-17 — "Minha biblioteca" as saved Activities

**Class:** `DECISION REQUIRED — MINHA BIBLIOTECA SEMANTICS`

**Prototype:** "Minha biblioteca — Atividades que você salvou para acessar depois", with save/bookmark icons on Activity cards and in the workspace header.

`PRODUCT_DEFINITION.md` §7 includes "Minha biblioteca" in the learner information architecture without defining it. SPEC-001 and SPEC-004 exclude favorites/personal collections. `PRODUCT_DEFINITION.md` §24 excludes teacher-created personal collections from the initial launch.

**Affects:** SPEC-004, SPEC-006.

### UXC-18 — Independent learner access

**Class:** `DECISION REQUIRED — INDEPENDENT LEARNER ENTITLEMENT / ACCESS MODEL`

**Prototype:** the landing page offers "Para alunos — Aprenda no seu ritmo" with "Comece agora" / "Entrar" self-entry.

**Resolved identity decision:** SPEC-002 establishes that a new person may self-register a canonical PFY identity through the email-first Magic Link flow.

Self-registration is therefore no longer an open identity/authentication decision.

Account creation does not itself create:

- Student capability;
- Teacher capability;
- an Organization membership;
- a teacher-student relationship;
- a license;
- an entitlement;
- paid learning access.

The remaining open question is what authorization and entitlement, if any, an independently registered user receives.

The currently defined commercial/access paths include:

- B2C plans bought by Teachers, with Student capacity (`PRODUCT_DEFINITION.md` §20);
- institutional licenses;
- PFY Impact sponsorship.

Independent learner practice remains a supported usage mode, but its entitlement/access model is not yet defined.

**Affects:** SPEC-009, SPEC-012.

**Does not block:** SPEC-002 self-registration or authentication.

### UXC-19 — Teacher information architecture

**Class:** `DECISION REQUIRED — TEACHER INFORMATION ARCHITECTURE`

**Prototype:** teacher navigation: Início, Minhas turmas, Percursos, Alunos, Biblioteca, Atividades, Resultados.

Authoritative documents define only the learner information architecture (§7), and state that Teachers use the same shared library ("Explorar").

The teacher navigation must be defined consistently with UXC-08 and UXC-09 before SPEC-008.

### UXC-20 — Minor undefined elements

**Class:** `UNDEFINED`

- **"Em breve" Percursos:** a visible, non-published Percurso state that does not exist in the content lifecycle.
- **"Lição de casa disponível →":** the link target is undefined. `Sugestão de lição de casa` is Percurso pedagogical metadata (§5.2, §9).
- **Duplicated objective/purpose:** the Activity `objective` is duplicated as the Percurso membership `purpose`. SPEC-004 §5.4 requires Activity metadata to stay distinct from membership metadata.
- **Notifications bell:** no notification capability is defined.

## Coverage gaps

The prototype does not represent these surfaces. They need UX definition before their SPECs:

- sign-in, sign-up, activation and recovery (SPEC-002);
- teacher invitation, acceptance and pending/revoked states (SPEC-008);
- Activity authoring shell and H5P Exercise editing (SPEC-007);
- license capacity, seat allocation and organization membership management (SPEC-009, SPEC-010);
- institutional reports and PFY Impact pseudonymous views (SPEC-011);
- empty, loading and error states;
- real H5P playback inside the workspace (the prototype renders a native true/false mock, labeled as a representation).

## Aligned elements

These prototype elements are consistent with authoritative contracts and may guide UX:

- the learner information architecture (Início, Explorar, Percursos, Minha biblioteca, Meu progresso) and the mobile bottom navigation that keeps Percursos first-class;
- Activities composed from per-Activity block lists, and the Activity header with level and format;
- Percurso detail: ordered Activities, workload, and membership-level pedagogical metadata (gênero discursivo, propósito, recursos léxico-gramaticais, lição de casa); no locked Activities; progress shown as "X de Y atividades";
- the completion summary separating "N de N exercícios concluídos" from the result message;
- the teacher `needs_review` alert with supporting evidence;
- brand application: Lora/Plus Jakarta Sans and primary colors taken from design-token primitives, e.g. `brand.coral.600` for primary actions and `brand.blue.800` for structure.

## Related conflicts in brand references

These are recorded here for visibility. They were not edited in this pass, because brand documents change only through a design/product decision (`BRAND-SYSTEM.md` §26).

- `DESIGN-TOKENS.md` §46 lists a "Course Card" component. Course is not a PFY entity (`PRODUCT_DEFINITION.md` §25).
- `DESIGN-TOKENS.md` §40 lists an `activity.locked` state. No Activity locking is defined.
- `BRAND-SYSTEM.md` §12 lists a "Courses" icon category, §16 a "course interface", and §18 "recommend relevant activities" and "assign resources".
- `resources/brand/image.png` (visual concept) shows "Meus cursos", "Certificados", "Sequência atual", "Nível A2 — 75%", "Minhas turmas", "Fórum" and "Eventos".
- `BRAND-SYSTEM.md` §28 still states "Design tokens: Pending", although `DESIGN-TOKENS.md` exists.
