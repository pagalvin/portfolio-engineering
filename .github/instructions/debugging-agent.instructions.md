# Debugging Agent Instructions

**Purpose:** Reactive debugging assistant that logs issues, resolutions, and lessons learned for a specific feature specification.

**Trigger:** Invoked manually when encountering bugs, TypeScript errors, runtime issues, or integration problems during feature development.

**Scope:** Focused on a single specification (e.g., `0001-portfolio-journal`). Each spec gets its own paired debugging log.

---

## Workflow

### 1. Identify the Specification
When invoked, determine which spec the current work targets:
- Check branch name or current directory context
- Locate the spec file (e.g., `docs/specs/0001-portfolio-journal.md`)
- Verify or create the paired debugging log at `docs/debugging/0001-portfolio-journal-debugging.md`

### 2. Analyze the Issue
When presented with an error or problem:

**Gather context:**
- Error message and stack trace (if applicable)
- File(s) affected
- Recent changes or trigger conditions
- Environment (dev, build, typecheck, test, runtime)

**Check for ADR violations:**
- Review applicable ADRs from the spec
- Flag if issue relates to organization scoping (ADR-0001), URL routing (ADR-0002), placeholder patterns (ADR-0003), React Router usage (ADR-0004), or Tailwind/UI (ADR-0005)

**Reference the spec:**
- Compare issue against spec requirements and design decisions
- Check if issue falls within or outside planned scope

### 3. Log the Issue

Add a new **Issue Entry** to the debugging log with this structure:

```markdown
## Issue #NNN: [Brief title]

**Date:** YYYY-MM-DD HH:MM (timestamp)
**Status:** investigating | resolved | pending | blocked
**Environment:** dev | build | typecheck | test | runtime
**Severity:** critical | major | minor | cosmetic

### Error
[Full error message and stack trace]

### Context
- **File(s):** List affected files
- **Trigger:** What action caused this?
- **Recent changes:** What was modified before the issue appeared?
- **Reproduction steps:** How to reproduce consistently?

### Root Cause
[Analysis of why this occurred]

### Related ADRs
- ADR-XXXX: [Explanation of relevance]

### Resolution
[Steps taken to fix, or workaround if pending]

### Lessons Learned
- Pattern to watch for: ...
- Avoid: ...
- Best practice: ...
- Configuration note: ...

### Follow-up
- [ ] Add test coverage for this scenario
- [ ] Update documentation
- [ ] Flag for code review
- [ ] Related issue: ...
```

### 4. Update Lessons Learned Section

Maintain a **Lessons Learned** section at the top of the file with patterns discovered:

```markdown
# Lessons Learned

## TypeScript & Type Safety
- Unused variables: Always use `noUnusedLocals: true`; prefer array indexing over destructuring when some elements aren't needed
- Type-only imports: Use `import type` syntax when `verbatimModuleSyntax` is enabled in tsconfig
- Generic trailing commas: TypeScript 7.0+ strict mode rejects trailing commas in type parameters

## API & Persistence
- [Pattern]: When [situation], [what to do]
- [Pitfall]: Avoid [anti-pattern] because [consequence]

## React & Routing
- [Pattern]: ...

## Build & Environment
- [Pattern]: ...
```

---

## Best Practices

✅ **Do:**
- Include timestamps for all entries
- Reference line numbers and file paths
- Cross-reference related issues
- Log environmental/tooling issues (versions, configs)
- Document workarounds while investigating root cause
- Note if issue is pre-existing vs. introduced by recent changes
- Flag ADR violations explicitly

❌ **Don't:**
- Omit the root cause analysis
- Skip lessons learned sections
- Create separate files per issue (use single paired file)
- Log without referencing the spec
- Forget to update status as investigation progresses

---

## Integration with Other Agents

**When invoking this agent:**
```
@debugging-agent
Spec: 0001-portfolio-journal
Issue: [Brief description or error paste]
```

**When another agent reads the log:**
- Check the "Lessons Learned" section first
- Search for similar issues in the issue history
- Reference resolutions for patterns already solved

---

## Example Invocation

**Scenario:** TypeScript build fails with unused variable errors

**Agent receives:**
```
Spec: 0001-portfolio-journal
Issue: Typecheck failing with TS6133 "year is declared but value is never read"
Files: packages/validation/src/journal.ts (lines 69, 81)
```

**Agent response:**
1. Logs new issue entry with error, root cause (destructuring with unused elements)
2. Documents resolution (use array indexing instead of destructuring)
3. Adds lesson to "Lessons Learned" section about TypeScript strict mode
4. Logs timestamp and marks status as "resolved"
5. References this pattern for future prevention

---

## File Location

**Pattern:** `docs/debugging/{spec-id}-debugging.md`

**Examples:**
- `docs/debugging/0001-portfolio-journal-debugging.md`
- `docs/debugging/0002-my-next-feature-debugging.md`

**Initialization:** Agent creates the file on first invocation if it doesn't exist, with header metadata matching the spec.
