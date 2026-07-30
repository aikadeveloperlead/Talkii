import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

// AA-03 — Architecture Validation Gate: prueba que el gate de eslint
// (import/no-restricted-paths + no-restricted-imports en eslint.config.mjs)
// realmente bloquea violaciones de capa, en vez de sostenerse solo por
// disciplina. Los fixtures se escriben dentro de src/ en tiempo de test
// (así el resolver de imports los resuelve como archivos reales) y se
// borran siempre al terminar.

const projectRoot = path.resolve(__dirname, "..", "..");

const fixtures: string[] = [];

function writeFixture(relativePath: string, content: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf-8");
  fixtures.push(absolutePath);
  return absolutePath;
}

afterEach(() => {
  while (fixtures.length > 0) {
    const file = fixtures.pop();
    if (file) rmSync(file, { force: true });
  }
});

async function lint(filePath: string) {
  const eslint = new ESLint({ cwd: projectRoot });
  const [result] = await eslint.lintFiles([filePath]);
  return result.messages;
}

describe("AA-03 import boundaries", () => {
  it("blocks domain/ importing from application/", async () => {
    const file = writeFixture(
      "src/domain/__aa03_fixture_domain_importing_application__.ts",
      'import { AddFunnelStep } from "../application/use-cases/add-funnel-step";\nexport const violation = AddFunnelStep;\n',
    );

    const messages = await lint(file);

    expect(messages.some((m) => m.ruleId === "import/no-restricted-paths")).toBe(true);
  }, 20000);

  it("blocks application/ importing from infrastructure/", async () => {
    const file = writeFixture(
      "src/application/__aa03_fixture_application_importing_infrastructure__.ts",
      'import { SystemClock } from "../infrastructure/time/system-clock";\nexport const violation = SystemClock;\n',
    );

    const messages = await lint(file);

    expect(messages.some((m) => m.ruleId === "import/no-restricted-paths")).toBe(true);
  }, 20000);

  it("blocks infrastructure/ importing from app/", async () => {
    const file = writeFixture(
      "src/infrastructure/__aa03_fixture_infrastructure_importing_app__.ts",
      'import { createContainer } from "../app/_lib/container";\nexport const violation = createContainer;\n',
    );

    const messages = await lint(file);

    expect(messages.some((m) => m.ruleId === "import/no-restricted-paths")).toBe(true);
  }, 20000);

  it("blocks domain/ importing external frameworks (Next/React/Supabase)", async () => {
    const file = writeFixture(
      "src/domain/__aa03_fixture_domain_importing_react__.ts",
      'import { useState } from "react";\nexport const violation = useState;\n',
    );

    const messages = await lint(file);

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  }, 20000);

  it("allows domain/ importing only from domain/", async () => {
    const file = writeFixture(
      "src/domain/__aa03_fixture_domain_compliant__.ts",
      'import { Decision } from "./execution/decision";\nexport const compliant = Decision;\n',
    );

    const messages = await lint(file);

    expect(messages.some((m) => m.ruleId === "import/no-restricted-paths")).toBe(false);
    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(false);
  }, 20000);
});
