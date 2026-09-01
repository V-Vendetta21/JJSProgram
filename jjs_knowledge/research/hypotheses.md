# Research Hypotheses

No hypothesis is used by production generation rules.

## HYPOTHESIS-001

Claim: `Line` array order is execution order.

Evidence: community documentation calls Timeline an ordered list; WAIT nodes occur between other nodes; public samples are structurally consistent with sequential interpretation.

Counter-evidence: no controlled in-game execution trace has been recorded locally.

Confidence: **LIKELY**.

## HYPOTHESIS-002

Claim: some branch names in the particle template are explanatory labels rather than runtime-significant identifiers.

Evidence: several keys are sentence-like comments.

Counter-evidence: they are still preserved as actual object keys and could be referenced externally.

Confidence: **LOW / ASSUMED**. Never delete or rename them automatically.
