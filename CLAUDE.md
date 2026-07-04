# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repository currently contains **no application source code**. It only holds installed agent skill packs (design/branding/UI tooling) under `.claude/skills/` and a mirrored copy under `.codex/skills/`:

- `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`, `ui-ux-pro-max`

There is no README, package manifest, build system, test suite, or source tree yet. When the "seren-chatbot" application is actually added to this repository, this file should be rewritten to cover:

- Build/lint/test commands (and how to run a single test)
- The application's high-level architecture (e.g. frontend/backend split, chat/LLM integration points, data flow)

Until then, do not assume any framework, language, or structure for the chatbot itself — verify by inspecting whatever code is added.
