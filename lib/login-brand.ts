const GENERIC_BRAND = "Dahan";

/**
 * The name `/login` shows. Only `LOGIN_SHOW_ORG_NAME=true` with exactly one organization reveals
 * an organization name; every other case is the generic brand, so the page never leaks who else
 * uses the deployment.
 */
export function loginBrand(flag: string | undefined, orgs: readonly { name: string }[]): string {
  if (flag !== "true" || orgs.length !== 1) return GENERIC_BRAND;
  return orgs[0].name;
}
