/**
 * Generic OIDC provider (Auth.js has no next-auth/providers/oidc export in v5 beta).
 * @see https://authjs.dev/guides/providers/custom-provider
 */
export default function AppOidcProvider(options: {
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
}) {
  return {
    id: "oidc",
    name: "SSO",
    type: "oidc" as const,
    issuer: options.issuer,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  };
}
