# Copilot Agent Project Management Instructions

This file guides GitHub Copilot and other agentic tools (via MCP) on how to manage and classify issues for the `QECore/pw-core` repository.

## Mapping Rules

When creating or triage-processing issues:
1. **Bugs**:
   - Apply label: `bug`
   - Default Status: `Backlog`
   - Default Priority: `Medium` (unless specified)
2. **Features**:
   - Apply label: `feature`
   - Default Status: `Backlog`
   - Default Priority: `Medium` (unless specified)
3. **Enhancements**:
   - Apply label: `enhancement`
   - Default Status: `Backlog`
   - Default Priority: `Medium` (unless specified)
4. **Documentation**:
   - Apply label: `docs`
   - Default Status: `Backlog`
   - Default Priority: `Medium` (unless specified)

## Project Board
- Add all new issues to the **PW-Core Roadmap** GitHub Project.

## Labels & Milestones Reference
- **Priority Labels**: `priority:critical`, `priority:high`, `priority:medium`, `priority:low`
- **Area Labels**: `registry`, `locators`, `assertions`, `tables`, `fixtures`, `auth`, `storage`, `cli`, `docs`
- **Workflow Labels**: `blocked`, `good-first-issue`, `help-wanted`, `needs-discussion`
- **Milestones**: `v2.0`, `v2.1`, `v3.0`
