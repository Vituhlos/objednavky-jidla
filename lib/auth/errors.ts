export type AuthErrorCode =
  | "NEPRIHLASEN"
  | "BLOKOVAN"
  | "CIZI_ZAZNAM"
  | "JEN_SPRAVCE"
  | "VYZADOVAN_PIN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}
