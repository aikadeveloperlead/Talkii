import { describe, expect, it } from "vitest";
import { RegisterUser } from "@/application/use-cases";
import { FakeAuthGateway } from "../fakes";

describe("RegisterUser (alta self-service confirmada de origen, sin depender de \"Confirm email\" global)", () => {
  it("crea el usuario vía AuthGateway y devuelve su userId", async () => {
    const authGateway = new FakeAuthGateway(undefined, { userId: "user-42" });
    const useCase = new RegisterUser(authGateway);

    const result = await useCase.execute({
      email: "ana@acme.com",
      password: "Secreta123!",
    });

    expect(result.userId).toBe("user-42");
    expect(authGateway.createdUsers).toEqual([
      { email: "ana@acme.com", password: "Secreta123!" },
    ]);
  });

  it("propaga el fallo si el AuthGateway no puede crear el usuario", async () => {
    const authGateway = new FakeAuthGateway(new Error("email ya registrado"));
    const useCase = new RegisterUser(authGateway);

    await expect(
      useCase.execute({ email: "ana@acme.com", password: "Secreta123!" }),
    ).rejects.toThrow("email ya registrado");
  });
});
