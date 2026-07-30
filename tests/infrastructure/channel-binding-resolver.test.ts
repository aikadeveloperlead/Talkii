import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseChannelBindingResolver } from "@/infrastructure/supabase/channel-binding-resolver";
import { encryptToken } from "@/infrastructure/security/token-cipher";

function fakeDb(row: Record<string, unknown> | null): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

describe("SupabaseChannelBindingResolver — descifra access_token (item MEDIO: token en texto plano)", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("descifra access_token con ENCRYPTION_KEY antes de exponerlo en ChannelBinding", async () => {
    process.env.ENCRYPTION_KEY = "clave-de-test";
    const cipherText = encryptToken("EAAG-token-real", "clave-de-test");
    const resolver = new SupabaseChannelBindingResolver(
      fakeDb({
        id: "cb1",
        tenant_id: "t1",
        channel: "whatsapp",
        external_id: "phone-1",
        agent_id: "a1",
        funnel_id: null,
        access_token: cipherText,
      }),
    );

    const binding = await resolver.findByChannelIdentity("whatsapp", "phone-1");

    expect(binding?.accessToken).toBe("EAAG-token-real");
  });

  it("devuelve accessToken undefined si la fila no tiene token (sin exigir ENCRYPTION_KEY)", async () => {
    delete process.env.ENCRYPTION_KEY;
    const resolver = new SupabaseChannelBindingResolver(
      fakeDb({
        id: "cb1",
        tenant_id: "t1",
        channel: "whatsapp",
        external_id: "phone-1",
        agent_id: "a1",
        funnel_id: null,
        access_token: null,
      }),
    );

    const binding = await resolver.findByChannelIdentity("whatsapp", "phone-1");

    expect(binding?.accessToken).toBeUndefined();
  });

  it("lanza un error descriptivo si hay un token cifrado pero falta ENCRYPTION_KEY", async () => {
    delete process.env.ENCRYPTION_KEY;
    const resolver = new SupabaseChannelBindingResolver(
      fakeDb({
        id: "cb1",
        tenant_id: "t1",
        channel: "whatsapp",
        external_id: "phone-1",
        agent_id: "a1",
        funnel_id: null,
        access_token: "algo-cifrado",
      }),
    );

    await expect(resolver.findByChannelIdentity("whatsapp", "phone-1")).rejects.toThrow(
      /ENCRYPTION_KEY/,
    );
  });
});
