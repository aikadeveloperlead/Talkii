import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { toErrorResponse } from "@/app/_lib/route-container";
import {
  updateAgentSchema,
  updateCompanySchema,
  updateCustomerSchema,
  updateFunnelSchema,
  updateFunnelStepSchema,
  updateKnowledgeDocumentSchema,
  updateLeadSchema,
  updatePreferencesSchema,
  updateTemplateSchema,
  updateWebhookSchema,
  updateWorkspaceSchema,
} from "@/app/_lib/validation";

/**
 * Item 8b de la auditoría: ~40 (en realidad 10) rutas PUT sin validación de
 * esquema — el body de `request.json()` se spreadeaba directo al caso de uso.
 * Cubre las 10 rutas PUT reales del proyecto (confirmadas por grep, no ~40).
 */
describe("toErrorResponse — ZodError → 400 (validación de esquema, item 8b)", () => {
  it("mapea un ZodError a 400 con los issues", async () => {
    const result = updateCustomerSchema.safeParse({ email: "no-es-un-email" });
    expect(result.success).toBe(false);
    const response = toErrorResponse((result as { error: ZodError }).error);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues).toBeInstanceOf(Array);
    expect(body.issues.length).toBeGreaterThan(0);
  });
});

describe("Esquemas de validación de rutas PUT", () => {
  const cases: {
    name: string;
    schema: { safeParse: (v: unknown) => { success: boolean } };
    valid: unknown;
    invalid: unknown;
  }[] = [
    {
      name: "updateCustomerSchema",
      schema: updateCustomerSchema,
      valid: { firstName: "Ana", email: "ana@talkii.io" },
      invalid: { email: "no-es-un-email" },
    },
    {
      name: "updatePreferencesSchema",
      schema: updatePreferencesSchema,
      valid: { language: "es", timezone: "America/Bogota" },
      invalid: { language: 123 },
    },
    {
      name: "updateCompanySchema",
      schema: updateCompanySchema,
      valid: { businessName: "Aika Solutions" },
      invalid: { website: "no-es-una-url" },
    },
    {
      name: "updateCompanySchema — businessName requerido",
      schema: updateCompanySchema,
      valid: { businessName: "Aika Solutions" },
      invalid: {},
    },
    {
      name: "updateWorkspaceSchema",
      schema: updateWorkspaceSchema,
      valid: { name: "Mi Workspace" },
      invalid: { name: 42 },
    },
    {
      name: "updateWebhookSchema",
      schema: updateWebhookSchema,
      valid: { url: "https://example.com/hook", events: ["lead.created"] },
      invalid: { url: "no-es-una-url" },
    },
    {
      name: "updateFunnelSchema",
      schema: updateFunnelSchema,
      valid: { name: "Ventas", adsAttribution: true },
      invalid: { adsAttribution: "sí" },
    },
    {
      name: "updateKnowledgeDocumentSchema",
      schema: updateKnowledgeDocumentSchema,
      valid: { title: "FAQ", content: "..." },
      invalid: { title: "" },
    },
    {
      name: "updateAgentSchema",
      schema: updateAgentSchema,
      valid: { name: "Ventas", transferKeywords: ["asesor"] },
      invalid: { transferKeywords: "asesor" },
    },
    {
      name: "updateTemplateSchema",
      schema: updateTemplateSchema,
      valid: {
        name: "bienvenida",
        category: "MARKETING",
        components: { body: "hola", buttons: [] },
      },
      invalid: { category: "NO_EXISTE" },
    },
    {
      name: "updateFunnelStepSchema",
      schema: updateFunnelStepSchema,
      valid: { name: "Contacto inicial", status: "active" },
      invalid: { status: "no-existe" },
    },
    {
      name: "updateLeadSchema — status fuera del enum (hallazgo MEDIUM)",
      schema: updateLeadSchema,
      valid: { status: "qualified", score: 80 },
      invalid: { status: "pwned" },
    },
    {
      name: "updateLeadSchema — score negativo",
      schema: updateLeadSchema,
      valid: { score: 0 },
      invalid: { score: -1 },
    },
  ];

  it.each(cases)("$name — acepta válido, rechaza inválido", ({ schema, valid, invalid }) => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});

/**
 * Item BAJO #1 de la auditoría: las rutas PUT hacen
 * `{ tenantId: scope.tenantId, ...body }` / `{ webhookId: id, ...body }` —
 * si `body` trajera esas mismas claves, el spread (que gana con el último
 * valor) las pisaría. Verificado: los 8 esquemas de rutas settings+[id] son
 * z.object() en modo "strip" (default de Zod, sin .passthrough()), así que
 * .parse() descarta cualquier clave no declarada — tenantId/webhookId/
 * customerId/funnelId/knowledgeId/agentId JAMÁS sobreviven en `body`. El
 * hallazgo ya estaba cerrado como efecto colateral de la validación zod
 * (item 8b) antes de que existiera este test; se deja como regresión.
 */
describe("Zod strip mode impide que el body pise tenantId/ids (item BAJO #1)", () => {
  const spoofCases: {
    name: string;
    schema: { parse: (v: unknown) => Record<string, unknown> };
    spoofedKey: string;
    validPayload: Record<string, unknown>;
  }[] = [
    {
      name: "updatePreferencesSchema",
      schema: updatePreferencesSchema,
      spoofedKey: "tenantId",
      validPayload: { language: "es" },
    },
    {
      name: "updateCompanySchema",
      schema: updateCompanySchema,
      spoofedKey: "tenantId",
      validPayload: { businessName: "Aika" },
    },
    {
      name: "updateWorkspaceSchema",
      schema: updateWorkspaceSchema,
      spoofedKey: "tenantId",
      validPayload: { name: "Aika" },
    },
    {
      name: "updateWebhookSchema",
      schema: updateWebhookSchema,
      spoofedKey: "webhookId",
      validPayload: { name: "Hook" },
    },
    {
      name: "updateFunnelSchema",
      schema: updateFunnelSchema,
      spoofedKey: "funnelId",
      validPayload: { name: "Ventas" },
    },
    {
      name: "updateKnowledgeDocumentSchema",
      schema: updateKnowledgeDocumentSchema,
      spoofedKey: "knowledgeId",
      validPayload: { title: "FAQ" },
    },
    {
      name: "updateCustomerSchema",
      schema: updateCustomerSchema,
      spoofedKey: "customerId",
      validPayload: { firstName: "Ana" },
    },
    {
      name: "updateAgentSchema",
      schema: updateAgentSchema,
      spoofedKey: "agentId",
      validPayload: { name: "Ventas" },
    },
  ];

  it.each(spoofCases)(
    "$name descarta '$spoofedKey' inyectado en el body",
    ({ schema, spoofedKey, validPayload }) => {
      const parsed = schema.parse({ ...validPayload, [spoofedKey]: "otro-tenant-o-id" });
      expect(parsed).not.toHaveProperty(spoofedKey);
    },
  );
});
