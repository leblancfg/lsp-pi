import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  formatDiagnostic,
  filterDiagnosticsBySeverity,
  uriToPath,
  findSymbolPosition,
  LANGUAGE_IDS,
  which,
  LSP_SERVERS,
} from "../src/lsp-core.js";
import type { Diagnostic, DocumentSymbol } from "vscode-languageserver-protocol";
import { DiagnosticSeverity, SymbolKind } from "vscode-languageserver-protocol";

// ---------------------------------------------------------------------------
// formatDiagnostic
// ---------------------------------------------------------------------------

describe("formatDiagnostic", () => {
  it("formats an error diagnostic", () => {
    const d: Diagnostic = {
      range: { start: { line: 4, character: 10 }, end: { line: 4, character: 15 } },
      severity: DiagnosticSeverity.Error,
      message: "Type 'string' is not assignable to type 'number'.",
    };
    expect(formatDiagnostic(d)).toBe("ERROR [5:11] Type 'string' is not assignable to type 'number'.");
  });

  it("formats a warning diagnostic", () => {
    const d: Diagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      severity: DiagnosticSeverity.Warning,
      message: "Unused variable 'x'.",
    };
    expect(formatDiagnostic(d)).toBe("WARN [1:1] Unused variable 'x'.");
  });

  it("formats an info diagnostic", () => {
    const d: Diagnostic = {
      range: { start: { line: 9, character: 3 }, end: { line: 9, character: 5 } },
      severity: DiagnosticSeverity.Information,
      message: "Consider refactoring.",
    };
    expect(formatDiagnostic(d)).toBe("INFO [10:4] Consider refactoring.");
  });

  it("formats a hint diagnostic", () => {
    const d: Diagnostic = {
      range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } },
      severity: DiagnosticSeverity.Hint,
      message: "Unnecessary semicolon.",
    };
    expect(formatDiagnostic(d)).toBe("HINT [3:1] Unnecessary semicolon.");
  });

  it("defaults to ERROR when severity is missing", () => {
    const d: Diagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      message: "Something went wrong.",
    };
    expect(formatDiagnostic(d)).toContain("ERROR");
  });
});

// ---------------------------------------------------------------------------
// filterDiagnosticsBySeverity
// ---------------------------------------------------------------------------

describe("filterDiagnosticsBySeverity", () => {
  const diags: Diagnostic[] = [
    { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 1, message: "err" },
    { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } }, severity: 2, message: "warn" },
    { range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } }, severity: 3, message: "info" },
    { range: { start: { line: 3, character: 0 }, end: { line: 3, character: 1 } }, severity: 4, message: "hint" },
  ];

  it("returns all with 'all' filter", () => {
    expect(filterDiagnosticsBySeverity(diags, "all")).toHaveLength(4);
  });

  it("returns only errors with 'error' filter", () => {
    const result = filterDiagnosticsBySeverity(diags, "error");
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("err");
  });

  it("returns errors and warnings with 'warning' filter", () => {
    const result = filterDiagnosticsBySeverity(diags, "warning");
    expect(result).toHaveLength(2);
  });

  it("returns errors, warnings, and info with 'info' filter", () => {
    const result = filterDiagnosticsBySeverity(diags, "info");
    expect(result).toHaveLength(3);
  });

  it("returns all with 'hint' filter", () => {
    const result = filterDiagnosticsBySeverity(diags, "hint");
    expect(result).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// uriToPath
// ---------------------------------------------------------------------------

describe("uriToPath", () => {
  it("converts a file:// URI to a path", () => {
    const result = uriToPath("file:///home/user/project/src/index.ts");
    expect(result).toBe("/home/user/project/src/index.ts");
  });

  it("handles spaces in URIs", () => {
    const result = uriToPath("file:///home/user/my%20project/index.ts");
    expect(result).toBe("/home/user/my project/index.ts");
  });

  it("returns non-file URIs as-is", () => {
    expect(uriToPath("https://example.com")).toBe("https://example.com");
    expect(uriToPath("/some/path")).toBe("/some/path");
  });
});

// ---------------------------------------------------------------------------
// findSymbolPosition
// ---------------------------------------------------------------------------

describe("findSymbolPosition", () => {
  const symbols: DocumentSymbol[] = [
    {
      name: "MyClass",
      kind: SymbolKind.Class,
      range: { start: { line: 0, character: 0 }, end: { line: 20, character: 1 } },
      selectionRange: { start: { line: 0, character: 6 }, end: { line: 0, character: 13 } },
      children: [
        {
          name: "myMethod",
          kind: SymbolKind.Method,
          range: { start: { line: 2, character: 2 }, end: { line: 5, character: 3 } },
          selectionRange: { start: { line: 2, character: 4 }, end: { line: 2, character: 12 } },
        },
        {
          name: "myField",
          kind: SymbolKind.Property,
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 20 } },
          selectionRange: { start: { line: 1, character: 4 }, end: { line: 1, character: 11 } },
        },
      ],
    },
    {
      name: "helperFunction",
      kind: SymbolKind.Function,
      range: { start: { line: 22, character: 0 }, end: { line: 25, character: 1 } },
      selectionRange: { start: { line: 22, character: 9 }, end: { line: 22, character: 23 } },
    },
  ];

  it("finds an exact match", () => {
    const pos = findSymbolPosition(symbols, "MyClass");
    expect(pos).toEqual({ line: 0, character: 6 });
  });

  it("finds a nested symbol", () => {
    const pos = findSymbolPosition(symbols, "myMethod");
    expect(pos).toEqual({ line: 2, character: 4 });
  });

  it("finds a top-level function", () => {
    const pos = findSymbolPosition(symbols, "helperFunction");
    expect(pos).toEqual({ line: 22, character: 9 });
  });

  it("is case-insensitive", () => {
    const pos = findSymbolPosition(symbols, "myclass");
    expect(pos).toEqual({ line: 0, character: 6 });
  });

  it("finds partial matches", () => {
    const pos = findSymbolPosition(symbols, "helper");
    expect(pos).toEqual({ line: 22, character: 9 });
  });

  it("prefers exact over partial", () => {
    const pos = findSymbolPosition(symbols, "myField");
    expect(pos).toEqual({ line: 1, character: 4 });
  });

  it("returns null for no match", () => {
    const pos = findSymbolPosition(symbols, "nonexistent");
    expect(pos).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LANGUAGE_IDS
// ---------------------------------------------------------------------------

describe("LANGUAGE_IDS", () => {
  it("maps TypeScript extensions", () => {
    expect(LANGUAGE_IDS[".ts"]).toBe("typescript");
    expect(LANGUAGE_IDS[".tsx"]).toBe("typescriptreact");
    expect(LANGUAGE_IDS[".mts"]).toBe("typescript");
    expect(LANGUAGE_IDS[".cts"]).toBe("typescript");
  });

  it("maps JavaScript extensions", () => {
    expect(LANGUAGE_IDS[".js"]).toBe("javascript");
    expect(LANGUAGE_IDS[".jsx"]).toBe("javascriptreact");
    expect(LANGUAGE_IDS[".mjs"]).toBe("javascript");
    expect(LANGUAGE_IDS[".cjs"]).toBe("javascript");
  });

  it("maps other languages", () => {
    expect(LANGUAGE_IDS[".py"]).toBe("python");
    expect(LANGUAGE_IDS[".go"]).toBe("go");
    expect(LANGUAGE_IDS[".rs"]).toBe("rust");
    expect(LANGUAGE_IDS[".rb"]).toBe("ruby");
    expect(LANGUAGE_IDS[".kt"]).toBe("kotlin");
    expect(LANGUAGE_IDS[".swift"]).toBe("swift");
    expect(LANGUAGE_IDS[".dart"]).toBe("dart");
    expect(LANGUAGE_IDS[".vue"]).toBe("vue");
    expect(LANGUAGE_IDS[".svelte"]).toBe("svelte");
    expect(LANGUAGE_IDS[".sql"]).toBe("sql");
  });
});

// ---------------------------------------------------------------------------
// Root detection
// ---------------------------------------------------------------------------

describe("root detection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lsp-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function touch(relativePath: string) {
    const full = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "");
  }

  function findRootFor(ext: string, filePath: string): string | undefined {
    const config = LSP_SERVERS.find((s) => s.extensions.includes(ext));
    if (!config) return undefined;
    const absFile = path.join(tmpDir, filePath);
    return config.findRoot(absFile, tmpDir);
  }

  it("detects TypeScript root via package.json", () => {
    touch("package.json");
    touch("src/index.ts");
    expect(findRootFor(".ts", "src/index.ts")).toBe(tmpDir);
  });

  it("detects TypeScript root via tsconfig.json", () => {
    touch("tsconfig.json");
    touch("src/app.ts");
    expect(findRootFor(".ts", "src/app.ts")).toBe(tmpDir);
  });

  it("returns undefined for TypeScript in Deno project", () => {
    touch("deno.json");
    touch("main.ts");
    expect(findRootFor(".ts", "main.ts")).toBeUndefined();
  });

  it("detects Python root via pyproject.toml", () => {
    touch("pyproject.toml");
    touch("src/app.py");
    expect(findRootFor(".py", "src/app.py")).toBe(tmpDir);
  });

  it("detects Go root via go.mod", () => {
    touch("go.mod");
    touch("main.go");
    expect(findRootFor(".go", "main.go")).toBe(tmpDir);
  });

  it("prefers go.work over go.mod", () => {
    touch("go.work");
    touch("svc/go.mod");
    touch("svc/main.go");
    // go.work is at the top, so root should be tmpDir
    expect(findRootFor(".go", "svc/main.go")).toBe(tmpDir);
  });

  it("detects Rust root via Cargo.toml", () => {
    touch("Cargo.toml");
    touch("src/main.rs");
    expect(findRootFor(".rs", "src/main.rs")).toBe(tmpDir);
  });

  it("detects Dart root via pubspec.yaml", () => {
    touch("pubspec.yaml");
    touch("lib/main.dart");
    expect(findRootFor(".dart", "lib/main.dart")).toBe(tmpDir);
  });

  it("detects Ruby root via Gemfile", () => {
    touch("Gemfile");
    touch("lib/app.rb");
    expect(findRootFor(".rb", "lib/app.rb")).toBe(tmpDir);
  });

  it("detects Ruby root via .ruby-version", () => {
    touch(".ruby-version");
    touch("app.rb");
    expect(findRootFor(".rb", "app.rb")).toBe(tmpDir);
  });

  it("detects Kotlin root via settings.gradle.kts", () => {
    touch("settings.gradle.kts");
    touch("app/src/Main.kt");
    expect(findRootFor(".kt", "app/src/Main.kt")).toBe(tmpDir);
  });

  it("detects Swift root via Package.swift", () => {
    touch("Package.swift");
    touch("Sources/main.swift");
    expect(findRootFor(".swift", "Sources/main.swift")).toBe(tmpDir);
  });

  it("detects dbt root via dbt_project.yml", () => {
    touch("dbt_project.yml");
    touch("models/staging/stg_orders.sql");
    expect(findRootFor(".sql", "models/staging/stg_orders.sql")).toBe(tmpDir);
  });

  it("returns undefined for .sql without dbt_project.yml", () => {
    touch("queries/report.sql");
    expect(findRootFor(".sql", "queries/report.sql")).toBeUndefined();
  });

  it("returns undefined when no markers present", () => {
    touch("random.ts");
    expect(findRootFor(".ts", "random.ts")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// which
// ---------------------------------------------------------------------------

describe("which", () => {
  it("finds a common binary", () => {
    // 'node' should be on PATH in any test environment
    const result = which("node");
    expect(result).toBeDefined();
    expect(result).toContain("node");
  });

  it("returns undefined for nonexistent binary", () => {
    expect(which("definitely-not-a-real-binary-abc123")).toBeUndefined();
  });
});
