# Anastasis QA Constitution

This folder contains the finite, machine-readable QA rule set used by the internal Anastasis QA agents.

Rules are TypeScript objects with stable IDs, domains, severity levels, explicit inputs, expected behavior, rationale, and deterministic `evaluate` functions. They are intentionally not prompts. The agents use these rules as the source of truth when deciding whether platform behavior is correct.

The current rules are a starter framework. Rules marked `provisional: true` require product-owner validation before they should be treated as final Anastasis business logic.
