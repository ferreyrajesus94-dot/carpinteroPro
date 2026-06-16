/**
 * Build signup metadata, optionally including a referral code from the URL.
 * Extracted into a pure function for testability — no mocks needed.
 *
 * @param baseMetadata - Standard signup fields (workshop_name, terms_accepted_at, etc.)
 * @param refCode - The raw `?ref=` query param value, or null/undefined if absent
 * @returns A new metadata object; referral_code key is omitted when refCode is falsy
 */
export function buildSignupMetadata(
  baseMetadata: Record<string, string>,
  refCode: string | null | undefined,
): Record<string, string> {
  if (refCode) {
    return { ...baseMetadata, referral_code: refCode };
  }
  return { ...baseMetadata };
}
