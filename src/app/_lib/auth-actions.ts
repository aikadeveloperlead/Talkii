// src/app/_lib/auth-actions.ts
"use server";

import { redirect } from "next/navigation";
import {
  createServiceClient,
  SupabaseAuthGateway,
  UuidIdGenerator,
} from "@/infrastructure";
import { SupabaseTenantRepository } from "@/infrastructure/supabase/repositories";
import { ProvisionTenant } from "@/application/use-cases";
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

  const db = await createServerSupabase();
  const { error } = await db.auth.signUp({ email, password });
  if (error) {
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

  const service = createServiceClient();
  const useCase = new ProvisionTenant(
    new UuidIdGenerator(),
    new SupabaseTenantRepository(service),
    new SupabaseAuthGateway(service),
  );

  try {
    await useCase.execute({ userId: user.id, organizationName });
  } catch (err) {
    console.error("provisionTenant: fallo al aprovisionar el tenant", err);
    redirect("/onboarding?error=provision-failed");
  }

  await db.auth.refreshSession();
  redirect("/dashboard");
}
