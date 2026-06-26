# Project Management & Workflow Documentation

This document describes the workflow, issue tracking, and VS Code MCP integration for `pw-core`.

## GitHub Project Board: PW-Core Roadmap

All tasks, features, enhancements, and bugs are managed on the **PW-Core Roadmap** project board.

### Custom Fields
- **Type**: `Feature`, `Bug`, `Enhancement`, `Documentation`, `Release`
- **Status**: `Backlog`, `Ready`, `In Progress`, `Review`, `Done`
- **Priority**: `Critical`, `High`, `Medium`, `Low`
- **Area**: `Registry`, `Locators`, `Assertions`, `Tables`, `Fixtures`, `Authentication`, `Storage`, `CLI`, `Documentation`
- **Release**: Text field (e.g., `v2.0`)
- **Breaking Change**: `Yes`, `No`

### Project Views
1. **Backlog**: Cards in the `Backlog` status, sorted by priority.
2. **Current Release**: Active cards in `Ready`, `In Progress`, or `Review` targeted for the next release.
3. **Bugs**: Filtered for `Type: Bug`.
4. **Features**: Filtered for `Type: Feature`.
5. **Enhancements**: Filtered for `Type: Enhancement`.
6. **Documentation**: Filtered for `Type: Documentation`.
7. **Completed**: Cards in `Done` status.

---

## Labeling Taxonomy

### Types
- `bug`: Something isn't working.
- `feature`: New functional request.
- `enhancement`: Improvement to existing code.
- `docs`: Documentation improvement.
- `release`: Tracking release readiness.

### Priorities
- `priority:critical`
- `priority:high`
- `priority:medium`
- `priority:low`

### Areas
- `registry`
- `locators`
- `assertions`
- `tables`
- `fixtures`
- `auth`
- `storage`
- `cli`
- `docs`

### Workflow
- `blocked`: Waiting on another issue or external factor.
- `good-first-issue`: Easy task for new contributors.
- `help-wanted`: Seeking community contribution.
- `needs-discussion`: Requires design alignment.

---

## Milestones

- **v2.0**: Core stabilization & table helper upgrades.
- **v2.1**: Advanced locator caching & state persistence improvements.
- **v3.0**: Core-flow compiler integration.

---

## VS Code MCP Integration Usage

Copilot Agent and other MCP clients can create and manage project tasks directly from the editor.

### Commands Example
- `"Create a feature for table assertions."`
- `"Create a bug for IntelliSense ordering."`
- `"Create an enhancement for locator filters."`
- `"Create documentation for MCP integration."`
