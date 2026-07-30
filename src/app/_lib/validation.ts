import { z } from "zod";

/**
 * Esquemas de validación para los bodies de las rutas PUT (item 8b de la
 * auditoría — antes se hacía `await request.json()` y se spreadeaba directo
 * al caso de uso sin ningún chequeo de forma/tipo). Un esquema por
 * Update*Input de application; `.parse()` en la ruta lanza ZodError si el
 * body no calza, que `toErrorResponse` (route-container.ts) traduce a 400.
 */

export const updateCustomerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const updatePreferencesSchema = z.object({
  language: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  dateFormat: z.string().min(1).optional(),
});

export const updateCompanySchema = z.object({
  businessName: z.string().min(1),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  logo: z.string().optional(),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
});

export const updateFunnelSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  adsAttribution: z.boolean().optional(),
});

export const updateKnowledgeDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  content: z.string().min(1).optional(),
});

const captureFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  objective: z.string().optional(),
  permanentPrompt: z.string().optional(),
  personality: z.string().optional(),
  language: z.string().optional(),
  tone: z.string().optional(),
  businessName: z.string().optional(),
  businessDescription: z.string().optional(),
  productsServices: z.string().optional(),
  businessType: z.string().optional(),
  welcomeMessage: z.string().optional(),
  fallbackMessage: z.string().optional(),
  transferKeywords: z.array(z.string()).optional(),
  captureFields: z.array(captureFieldSchema).optional(),
});

const templateButtonSchema = z.object({
  type: z.string().min(1),
  text: z.string().min(1),
  value: z.string().optional(),
});

const templateComponentsSchema = z.object({
  headerType: z.enum(["text", "image", "video", "document", "location"]).optional(),
  headerContent: z.string().optional(),
  body: z.string().min(1),
  footer: z.string().optional(),
  buttons: z.array(templateButtonSchema),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  components: templateComponentsSchema.optional(),
});

export const updateFunnelStepSchema = z.object({
  name: z.string().min(1).optional(),
  objective: z.string().optional(),
  transitionCriteria: z.string().optional(),
  stepKey: z.string().optional(),
  order: z.number().optional(),
  nextStep: z.string().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});
