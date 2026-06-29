# Governor Protocol

## Purpose

Before any implementation begins, the proposal must survive multiple independent reasoning passes.

Workers do not start until the governors converge on a reviewed plan.

## Protocol

1. User explains the goal.
2. Governor A (ChatGPT) reconstructs intent and grills the problem.
3. Governor A produces a Governor Packet v1 (architecture, assumptions, risks, acceptance criteria).
4. Governor B (Pro) reads the packet and actively tries to disprove it.
5. Governor B identifies:
   - hidden assumptions
   - architectural flaws
   - performance risks
   - UX issues
   - unnecessary complexity
   - simpler alternatives
6. Governor A reviews the critique and either:
   - accepts,
   - rejects with evidence,
   - or synthesizes a better design.
7. Only after this review loop completes does execution planning begin.
8. Planner decomposes work.
9. Workers execute.
10. Reviewer validates evidence and either passes or returns a revised plan.

## Rule

Pro is not another worker.

Pro is another governor/reviewer.

The objective is constructive disagreement before code exists.

## Long-term extension

The personal predictive model should inform the governors, not replace them.

Predictions are probabilistic and should be expressed with confidence and supporting signals, never as certainties.
