import { AuthGateway, type CreatedUser } from "../ports/auth-gateway";

/**
 * RegisterUser — alta self-service de una identidad.
 *
 * Aísla a la capa `app` (presentación) del mecanismo concreto de identidad:
 * solo conoce el puerto `AuthGateway`, nunca el cliente de Supabase (AA-01/AA-03).
 * `AuthGateway.createConfirmedUser` crea la identidad ya confirmada de origen,
 * sin depender del ajuste global "Confirm email" del proveedor (ver
 * `docs/DEPLOY.md` §"Auth — Google OAuth + Supabase").
 */
export interface RegisterUserInput {
  email: string;
  password: string;
}

export type RegisterUserResult = CreatedUser;

export class RegisterUser {
  constructor(private readonly authGateway: AuthGateway) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    return this.authGateway.createConfirmedUser(input.email, input.password);
  }
}
