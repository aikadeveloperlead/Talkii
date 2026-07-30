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
  ];

  it.each(cases)("$name — acepta válido, rechaza inválido", ({ schema, valid, invalid }) => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});
