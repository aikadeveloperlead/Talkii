// src/app/_lib/auth-actions.ts
"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/infrastructure";
import { createContainer } from "./container";
import { createServerSupabase } from "./supabase-server";

export async function signInWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const db = await createServerSupabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=invalid-credentials");
  }
  redirect("/dashboard");
}

export async function signUpWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // La creación de la identidad pasa por el caso de uso RegisterUser (puerto
  // AuthGateway): la presentación no conoce `auth.admin.createUser`, solo que
  // el alta llega confirmada de origen. El login que sigue sí necesita el
  // cliente por-request (`createServerSupabase`) porque es el único punto
  // acoplado a Next capaz de escribir la cookie de sesión (@supabase/ssr).
  // registerUser exige service-role (auth.admin.createUser) — mismo Container
  // que el resto de la app, item MEDIO #7 de la auditoría (antes era un
  // composition root propio de este archivo).
  try {
    await createContainer(createServiceClient()).registerUser.execute({ email, password });
  } catch (err) {
    console.error("signUpWithPassword: fallo al registrar el usuario", err);
    redirect("/register?error=signup-failed");
  }

  const db = await createServerSupabase();
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) {
    redirect("/register?error=signup-failed");
  }
  redirect("/dashboard");
}

export async function signInWithGoogle(): Promise<void> {
  const db = await createServerSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const db = await createServerSupabase();
  await db.auth.signOut();
  redirect("/login");
}

export async function provisionTenant(formData: FormData): Promise<void> {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  if (!organizationName) {
    redirect("/onboarding?error=missing-name");
  }

  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const existingTenantId = (
    user.app_metadata as Record<string, unknown> | undefined
  )?.tenant_id as string | undefined;
  if (existingTenantId) {
    redirect("/dashboard");
  }

  // provisionTenant exige service-role (crea el Tenant y asigna el claim
  // tenant_id vía auth.admin.*) — mismo Container que el resto de la app.
  try {
    await createContainer(createServiceClient()).provisionTenant.execute({
      userId: user.id,
      organizationName,
    });
  } catch (err) {
    console.error("provisionTenant: fallo al aprovisionar el tenant", err);
    redirect("/onboarding?error=provision-failed");
  }

  await db.auth.refreshSession();
  redirect("/dashboard");
}
