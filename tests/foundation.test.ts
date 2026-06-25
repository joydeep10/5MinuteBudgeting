import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("project foundation", () => {
  it("declares the requested React, Vite, TypeScript, Vitest, and date-fns toolchain", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      build: "tsc -b && vite build",
      typecheck: "tsc -b",
      test: "vitest run",
    });

    const declaredPackages = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(declaredPackages).toHaveProperty("react");
    expect(declaredPackages).toHaveProperty("react-dom");
    expect(declaredPackages).toHaveProperty("vite");
    expect(declaredPackages).toHaveProperty("date-fns");
    expect(declaredPackages).toHaveProperty("typescript");
    expect(declaredPackages).toHaveProperty("vitest");
  });

  it("provides a Vite app entry with the landing page shell", () => {
    const files = [
      "index.html",
      "src/main.tsx",
      "src/app/App.tsx",
      "src/app/App.css",
      "tsconfig.json",
      "tsconfig.app.json",
      "tsconfig.node.json",
      "vite.config.ts",
    ];

    for (const file of files) {
      expect(read(file).trim().length, file).toBeGreaterThan(20);
    }

    expect(read("src/app/App.tsx")).toContain("Know what is safe to spend today");
  });

  it("documents the product, calculation, architecture, and phase decisions", () => {
    const docs = [
      "docs/product-decisions.md",
      "docs/calculation-rules.md",
      "docs/architecture-boundaries.md",
      "docs/implementation-phases.md",
    ];

    for (const doc of docs) {
      expect(read(doc).trim().length, doc).toBeGreaterThan(200);
    }
  });

  it("defines source boundaries for domain, application, infrastructure, features, ui, and app", () => {
    const boundaries = [
      "src/domain/README.md",
      "src/application/README.md",
      "src/infrastructure/README.md",
      "src/features/README.md",
      "src/ui/README.md",
      "src/app/README.md",
    ];

    for (const boundary of boundaries) {
      const content = read(boundary);

      expect(content, boundary).toContain("## Belongs here");
      expect(content, boundary).toContain("## Does not belong here");
    }

    expect(read("src/domain/README.md")).toContain(
      "must not depend on React, storage, browser APIs, routing, or CSS",
    );
  });
});
