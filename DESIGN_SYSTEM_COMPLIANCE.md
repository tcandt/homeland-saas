# Design System Compliance Report (Wave 2)

This report evaluates the current compliance of `apps/web` with the Design System tokens and principles as of the end of Wave 2.

## Audit Criteria: 0 Arbitrary Presentation Values

### Current Violations Found
A comprehensive scan of the `apps/web` directory has revealed numerous violations of the Design System strict rules.

1. **Colors (bg-white, text-gray-*, border-gray-*)**:
   - `bg-white` is still heavily used in `components/tasks`, `components/settings`, `components/auth`.
   - Hardcoded gray palettes (e.g., `text-gray-500`, `border-gray-200`) remain in the codebase.
   - Requirement: Must be replaced with `bg-card`, `bg-surface`, `bg-background`, `text-muted`, `border-border`.

2. **Arbitrary Spacing and Typography (`text-[...]`, `gap-[...]`, `px-[...]`)**:
   - Arbitrary pixel values are pervasive in older components (e.g., `text-[13px]`, `px-[18px]`, `gap-[7px]`).
   - Requirement: Must use standard Tailwind scaling (e.g., `text-sm`, `px-4`, `gap-2`).

3. **Arbitrary Border Radius (`rounded-[...]`)**:
   - Instances of `rounded-[14px]`, `rounded-[8px]` are still prevalent.
   - Requirement: Must use design tokens (e.g., `rounded-xl`, `rounded-md`, `rounded-2xl`).

## Conclusion
The compliance check **FAILED**. There are still a significant number of arbitrary presentation values and raw UI tags scattered across components outside the Wave 1 and Wave 2 scope (e.g. Tasks, Settings, Auth).

**Recommendation**: A dedicated **Wave 3** is required to refactor the remaining components to achieve 100% Design System compliance before starting the Security & Performance Audit.
