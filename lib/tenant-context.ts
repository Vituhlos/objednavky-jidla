import { cache } from "react";
import { headers } from "next/headers";

type Store = { slug: string | null };

const getStore = cache((): Store => ({ slug: null }));

export function setTenantSlug(slug: string): void {
  getStore().slug = slug;
}

export function getTenantSlugForRequest(): string | null {
  try {
    return getStore().slug;
  } catch {
    return null;
  }
}

export async function initTenantContext(): Promise<string | null> {
  try {
    const h = await headers();
    const slug = h.get("x-tenant-slug");
    if (slug) setTenantSlug(slug);
    return slug;
  } catch {
    return null;
  }
}
