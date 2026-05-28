export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast: AUTH_SECRET is required for JWT signing. Without it Auth.js silently
    // accepts the login form but cannot issue a valid session cookie.
    if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
      console.error(
        "\n" +
        "┌─────────────────────────────────────────────────────────────────┐\n" +
        "│  CHYBA KONFIGURACE: AUTH_SECRET není nastaven                   │\n" +
        "│                                                                 │\n" +
        "│  Přihlašování nebude fungovat. Uživatelé se přihlásí, ale      │\n" +
        "│  budou okamžitě odhlášeni (JWT nelze podepsat).                │\n" +
        "│                                                                 │\n" +
        "│  Vygeneruj secret:  openssl rand -base64 32                    │\n" +
        "│  Nastav env:        AUTH_SECRET=<výstup příkazu>               │\n" +
        "└─────────────────────────────────────────────────────────────────┘\n"
      );
    }

    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
