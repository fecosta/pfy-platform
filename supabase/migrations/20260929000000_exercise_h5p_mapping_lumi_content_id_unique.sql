-- SPEC-005 remediation (Finding 6): enforce one-to-one Exercise <-> Lumi
-- content id cardinality.
--
-- Authority: ADR-002 defines the mapping as bidirectional —
--   PFY Exercise UUID <-> PFY H5P Adapter <-> Lumi content id
-- — not many-Exercise-to-one-Lumi-content. SPEC-005 section 6.2 additionally
-- requires "one Lumi content identity per H5P-backed Exercise", and ADR-001
-- requires append-only, per-Exercise Attempt isolation once SPEC-006 attaches
-- Attempts through this mapping. If two Exercises resolved to the same Lumi
-- content id, editing or attempting through one Exercise would silently
-- mutate/affect the shared Lumi content state (parameters, user data) visible
-- through the other Exercise, breaking Exercise-level content lifecycle
-- ownership and Attempt isolation. `exercise_id` was already unique; this
-- migration closes the other half of the cardinality the original migration
-- left open.
--
-- Additive only: the original migration (20260928000000) is not rewritten
-- because it may already be applied. If any pre-existing row already
-- violates uniqueness, this migration will fail loudly at deploy time rather
-- than silently accepting ambiguous state — that failure must be resolved by
-- data reconciliation, not by weakening the constraint.

alter table public.exercise_h5p_mappings
  add constraint exercise_h5p_mappings_lumi_content_id_key unique (lumi_content_id);
