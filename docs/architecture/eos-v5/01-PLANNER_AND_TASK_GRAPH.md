# EOS v5 Planner & Task Graph Architecture

This document defines the architecture of the Execution Planner and Task Graph system (Epic 90) for EOS v5.

## 1. Planner Responsibility
The Planner (`scripts/eos/planner.ts`) is a deterministic component responsible for orchestrating execution.
It evaluates:
- Machine-readable Gate files (`docs/gates/EPIC_*.yaml`)
- Policy Evaluation JSON (`docs/evidence/runs/*/policy-evaluation.json`)
- Dependency Graphs
- Previous immutable Task Graphs

It deterministically outputting a Directed Acyclic Graph (DAG) for the next unblocked target Epic, pinning the Gate and Policy source hashes to prevent post-plan alterations.

## 2. Task Graph Lifecycle
Each task inside the graph tracks state transition:
`PENDING` -> `READY` -> `RUNNING` -> `VERIFIED`
Other terminal or modifier states include:
- `BLOCKED` (upstream task has not passed or failed)
- `FAILED` (exit criteria or required tests failed)
- `SKIPPED_BY_POLICY`

## 3. Executor Boundary
The AI Executor's execution boundary is strictly limited. The AI:
- May only execute tasks in the `READY` state.
- Must operate within the explicit `allowedScope` (e.g. specific file paths or directories).
- Must satisfy all `requiredOutputs`, `requiredCommands`, and `requiredTests` to exit the task.
- Cannot mutate task states or the graph file directly.

## 4. Replanning and Discovery Conflicts
If the Executor encounters a discovery conflict (e.g., unexpected code dependencies), it emits `DISCOVERY_CONFLICT`. The Planner must then abort the current execution flow and issue a new Task Graph revision (`graphRevision + 1`, with `supersedesGraphId` referencing the prior graph ID). Historical graphs are immutable and never mutated in place.

## 5. Bootstrap Mode
To safely seed the system, a static operator-approved bootstrap graph (`docs/eos/bootstrap/EOS_V5_BOOTSTRAP_TASK_GRAPH.json`) is executed once, then marked as `CONSUMED` to prevent reuse.
