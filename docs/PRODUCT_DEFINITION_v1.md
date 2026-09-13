# Portuguese for You — Product Definition v1

**Status:** DECISION READY — PRODUCT DEFINITION v1  
**Product:** Portuguese for You (PFY)  
**Project type:** greenfield rebuild with selective legacy migration

## 1. Product vision

Portuguese for You is a digital platform specialized in teaching and learning Portuguese as a Foreign Language (PLE). It serves teachers, learners and institutions through a shared learning library and supports both teacher-mediated and self-directed learning.

The existing WordPress platform is a legacy source of behavior and migration data. It is not the technical foundation of the new PFY.

## 2. Product principles

### Activity-first

`Activity` is the fundamental learning-content unit. Activities may exist independently and may optionally belong to pedagogical collections or textbooks.

### Shared library

Teachers and learners use the same content library. Differences in experience come from permissions, relationships and available actions, not duplicated catalogs.

### Commerce is separate from learning

Commercial arrangements originate access but do not define the learning domain.

`Commerce / Contract -> License -> Allocation -> Entitlement -> User -> Learning`

### Relationships are persistent

Relationships such as teacher-to-student are distinct from paid access. Cancellation, expiration or downgrade can suspend access without deleting the relationship.

### Privacy by design

Permission to see learning data is distinct from permission to see personal identity.

## 3. Primary personas

### Student

A student can browse the available library, execute activities freely, repeat activities, see their own history and accept teacher invitations.

### Teacher

A teacher can browse the same library, invite students, maintain teacher-student relationships and view the full PFY learning history of linked students while authorization remains active.

### Content Author

A content author is a non-technical pedagogical user, such as a PFY pedagogical consultant, authorized to create, edit, review and publish official learning activities.

Content Author is a capability/context, not necessarily a global user role.

### Organization Manager

An organization manager administers institutional participation according to contract and reporting policy, including seat allocation and permitted learning-data visibility.

### PFY Admin

PFY administrators manage platform-wide users, organizations, content, access, configuration and operational controls according to explicitly defined administrative permissions.

## 4. Learning library

### Activity

An Activity:

- can be found and executed independently;
- can participate in one or more Activity Collections;
- can appear in larger editorial structures such as Textbooks;
- produces Attempts and optionally Results;
- may be implemented by H5P or by future native activity types.

H5P is an Activity implementation, not the PFY domain model.

### Activity Collection

An optional editorial or pedagogical grouping of activities around a topic, objective or teaching context.

Teacher-created personal collections are nice-to-have, not MVP.

### Textbook

A larger editorial structure composed of collections and/or activities. Membership in a textbook never removes an activity's independent identity.

## 5. Student experience

Core flow:

`Student -> Library -> Activity -> Attempt -> Result/history`

Students do not need assignments to access or execute activities.

## 6. Teacher experience

Core flow:

`Teacher -> Library`

and independently:

`Teacher -> Invitation -> Student -> Active relationship -> Student learning history`

The teacher can view all PFY learning history of an authorized linked student, not only activities assigned by that teacher.

## 7. Teacher-student relationship

The relationship is created through an invitation and acceptance flow.

Conceptual states:

- `pending`
- `active`
- `revoked`

A pending invitation grants no access to student learning data. A revoked relationship removes the teacher's access to that student's history.

Cancellation or expiration of a teacher subscription does not delete the relationship; it suspends the entitlement affected by the commercial rule.

## 8. Attempts and results

An Attempt is one learner engagement with one activity. Attempts are append-only and never reused to represent a later execution.

Core Attempt semantics:

- PFY activity identity;
- learner identity;
- monotonically increasing attempt number per learner/activity;
- start and completion timestamps.

Result semantics are intentionally nullable because not every activity produces a score.

Core Result semantics:

- `score_raw`: nullable
- `score_max`: nullable
- `score_scaled`: nullable
- `pass_threshold`: nullable
- `is_passed`: nullable
- `is_completed`: boolean
- `duration_seconds`: nullable
- `score_provenance`

### Completion and score are independent

An unscored activity may validly produce:

`is_completed = true`, `score_raw = null`, `is_passed = null`.

Completion must not be interpreted as mastery or passing.

### Score provenance

H5P scoring is calculated in the browser and therefore enters PFY as `client_reported`. Future PFY-native activities may use `server_authoritative` scoring when scores are recomputed and validated server-side.

## 9. H5P authoring

Authoring is a product capability, not merely an administrative implementation detail.

PFY must allow authorized non-technical pedagogical users to:

- create H5P activities;
- edit existing and migrated H5P activities;
- preview activities;
- save drafts;
- publish reviewed activities;
- export H5P content when required.

The stock H5P editor must be wrapped by a PFY authoring shell that improves content-type selection, title flow, draft/publish behavior, errors and review workflow.

Minimum Activity lifecycle:

- `draft`
- `published`
- `archived` (planned for production model)

AI-generated content must enter as draft and require human review before publication.

## 10. AI-assisted authoring

Future AI authoring uses a PFY-controlled structured intermediate representation rather than asking models to generate opaque `.h5p` archives directly.

Flow:

`Pedagogical prompt -> PFY Authoring Draft -> deterministic H5P transformer -> H5P Editor -> human review -> publish`

Support should expand incrementally by tested H5P content type.

## 11. B2C access model

The primary B2C buyer is a teacher.

- Monthly plan: teacher access + capacity for up to 5 student accesses.
- Quarterly plan: teacher access + capacity for up to 10 student accesses.
- Annual plan: teacher access + capacity for up to 10 student accesses.

A plan grants capacity; it does not own the student relationships themselves.

When access ends:

- teacher-student relationships persist;
- affected entitlements are suspended;
- renewal may restore entitlement without a new invitation.

Downgrade allocation policy, such as 10 seats to 5, remains a product decision required before implementation of that lifecycle.

## 12. Organizations and B2B

Users may belong to multiple organizations and may hold different roles/capabilities in each.

An institutional license has separate capacities by audience, particularly teacher and student capacity.

### Partner / Reseller

A partner organization can distribute/resell access and is also authorized, within its reporting scope, to monitor activity and progress of its participants.

### Institutional

An institution contracts teacher and student capacity for direct use by its participants.

### PFY Impact

PFY Impact supports sponsored access for beneficiaries. Organizations need to evaluate individual learner progress without necessarily seeing civil identity.

Learning-data visibility and identity visibility must therefore be independently authorized.

## 13. Reporting policy

Conceptual permissions include at least:

- ability to view learning data;
- ability to view personal identity.

A traditional school may be allowed both. A PFY Impact organization may receive individual pseudonymous learning records and aggregated metrics while identity remains restricted.

## 14. Migration boundary

### Required migration

- relevant existing users;
- required user profile data;
- valid relationships that remain meaningful;
- H5P activities;
- H5P libraries/dependencies;
- H5P assets/media;
- migration provenance such as legacy H5P content identifiers.

### Optional migration

- historical H5P attempts;
- scores;
- xAPI history;
- historical progress.

### Not migrated by default

- WordPress pages;
- Elementor layouts;
- plugin configuration;
- WordPress authentication implementation;
- plugin-specific membership representation;
- Automator recipes;
- legacy application architecture.

## 15. MVP boundary

Included:

- identity/authentication;
- shared library;
- Activity / Collection / Textbook editorial model;
- H5P playback;
- Attempts and Results;
- teacher-student invitation and monitoring;
- B2C access capacity;
- Organization / membership / license / allocation / entitlement foundation;
- basic institutional monitoring;
- PFY Impact pseudonymous individual monitoring;
- H5P authoring capability for PFY content authors.

Not required for initial launch:

- favorites;
- teacher personal collections;
- assignments;
- certificates;
- complete legacy progress migration;
- advanced analytics;
- sophisticated co-funding;
- advanced impact reports.

## 16. Current state

**DECISION READY — PRODUCT DEFINITION v1**

This document owns product intent. Technical implementation choices must preserve these contracts.
