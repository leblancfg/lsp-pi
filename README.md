# lsp-pi

Language Server Protocol integration for [pi-coding-agent](https://github.com/nichochar/pi), by [leblancfg](https://github.com/leblancfg/lsp-pi).

## What it does

- **Hook** (`lsp.ts`): Automatic diagnostics after writes/edits. Default mode runs once at agent end; can also run per edit/write or be disabled.
- **Tool** (`lsp-tool.ts`): On-demand LSP queries -- definitions, references, hover, symbols, diagnostics, signatures, rename, code actions. Includes dbt support for navigating refs, sources, macros, and model definitions in `.sql` files.
- Manages one LSP server per project root, reused across turns.
- Bounded memory: LRU cache (30 files), idle file cleanup (60s), server shutdown after 2min inactivity.

## Supported Languages

| Language | Server | Detection |
|----------|--------|-----------|
| TypeScript/JavaScript | `typescript-language-server` | `package.json`, `tsconfig.json` |
| Vue | `vue-language-server` | `package.json`, `vite.config.ts` |
| Svelte | `svelteserver` | `svelte.config.js` |
| Dart/Flutter | `dart language-server` | `pubspec.yaml` |
| Python | `pyright-langserver` | `pyproject.toml`, `requirements.txt` |
| Go | `gopls` | `go.mod` |
| Kotlin | `kotlin-ls` | `settings.gradle(.kts)`, `build.gradle(.kts)` |
| Swift | `sourcekit-lsp` | `Package.swift`, `*.xcodeproj` |
| Rust | `rust-analyzer` | `Cargo.toml` |
| Ruby | `ruby-lsp` | `Gemfile`, `.ruby-version`, `Rakefile` |
| dbt (SQL) | `dbt-language-server` | `dbt_project.yml` |

### Known Limitations

**rust-analyzer**: Very slow to initialize (30-60+ seconds) because it compiles the entire Rust project before returning diagnostics. This is a known rust-analyzer behavior. For quick feedback, consider `cargo check` directly.

**dbt-language-server**: Provides dbt-specific intelligence (ref/source/macro navigation, completions, hover). Only activates for `.sql` files inside a dbt project (detected via `dbt_project.yml`). The `@fivetrandevelopers/dbt-language-server` and `j-clemons/dbt-language-server` implementations are both supported -- whichever is on your `$PATH` as `dbt-language-server`.

## Installation

```bash
pi install ~/src/github.com/leblancfg/lsp-pi
```

Or add to `settings.json`:

```json
{
  "packages": [
    "~/src/github.com/leblancfg/lsp-pi"
  ]
}
```

### Prerequisites

Install the language servers you need:

```bash
# TypeScript/JavaScript
npm i -g typescript-language-server typescript

# Vue
npm i -g @vue/language-server

# Svelte
npm i -g svelte-language-server

# Python
npm i -g pyright

# Go
go install golang.org/x/tools/gopls@latest

# Kotlin
brew install JetBrains/utils/kotlin-lsp

# Swift (usually available via Xcode)
xcrun sourcekit-lsp --help

# Rust
rustup component add rust-analyzer

# Ruby
gem install ruby-lsp

# dbt (option A: Fivetran/dbt-labs Node.js server)
npm i -g @fivetrandevelopers/dbt-language-server

# dbt (option B: j-clemons Go binary)
curl -fsSL https://j-clemons.com/dbt-language-server/install | bash
```

## How It Works

### Hook (auto-diagnostics)

1. On `session_start`, warms up LSP for detected project type
2. Tracks files touched by `write`/`edit`
3. Default (`agent_end`): after all tool calls complete, sends touched files to LSP and posts a diagnostics message
4. Optional (`edit_write`): per `write`/`edit`, appends diagnostics to the tool result
5. Reuses cached diagnostics if a server doesn't re-publish for unchanged files

### Tool (on-demand queries)

| Action | Description | Requires |
|--------|-------------|----------|
| `definition` | Jump to definition | `file` + (`line`/`column` or `query`) |
| `references` | Find all references | `file` + (`line`/`column` or `query`) |
| `hover` | Get type/docs info | `file` + (`line`/`column` or `query`) |
| `symbols` | List symbols in file | `file`, optional `query` filter |
| `diagnostics` | Get single file diagnostics | `file`, optional `severity` filter |
| `workspace-diagnostics` | Get diagnostics for multiple files | `files` array, optional `severity` filter |
| `signature` | Get function signature | `file` + (`line`/`column` or `query`) |
| `rename` | Rename symbol across files | `file` + (`line`/`column` or `query`) + `newName` |
| `codeAction` | Get available quick fixes/refactors | `file` + `line`/`column` |

**Query resolution**: Provide a `query` (symbol name) instead of `line`/`column` for position-based actions.

**Severity filtering**: `all` (default), `error`, `warning`, `info`, `hint`.

## Settings

Use `/lsp` to configure the auto diagnostics hook:

- Mode: `agent_end` (default), `edit_write`, or `disabled`
- Scope: session-only or global (`~/.pi/agent/settings.json`)

```json
{
  "lsp": {
    "hookMode": "disabled"
  }
}
```

Disabling the hook does not disable the `/lsp` tool.

## Development

```bash
npm install
npm test            # unit tests
npm run check       # type check
```

## File Structure

| File | Purpose |
|------|---------|
| `src/lsp.ts` | Hook extension (auto-diagnostics) |
| `src/lsp-tool.ts` | Tool extension (on-demand LSP queries) |
| `src/lsp-core.ts` | LSPManager class, server configs, utilities |

## License

MIT
