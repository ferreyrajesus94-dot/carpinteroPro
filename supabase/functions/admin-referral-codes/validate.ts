export interface ReferralCodeCreateInput {
  youtuberId: string;
  code: string;
  discountPct: number;
  commissionPct: number;
}

export interface ReferralCodeDeactivateInput {
  id: string;
}

export interface ReferralCodeListInput {
  youtuberId?: string;
}

interface ValidationOk<T> {
  ok: true;
  data: T;
}

interface ValidationError {
  ok: false;
  error: { code: string; message: string };
}

type ValidationResult<T> = ValidationOk<T> | ValidationError;

export function validateCreateCode(
  input: ReferralCodeCreateInput,
): ValidationResult<ReferralCodeCreateInput> {
  if (!input.youtuberId || input.youtuberId.trim().length === 0) {
    return { ok: false, error: { code: "validation_error", message: "youtuberId is required" } };
  }

  if (!input.code || input.code.trim().length === 0) {
    return { ok: false, error: { code: "validation_error", message: "code is required" } };
  }

  if (typeof input.discountPct !== "number" || input.discountPct < 0 || input.discountPct > 100) {
    return {
      ok: false,
      error: {
        code: "referral_code_invalid_percentage",
        message: "discount_pct must be between 0 and 100",
      },
    };
  }

  if (typeof input.commissionPct !== "number" || input.commissionPct < 0 || input.commissionPct > 100) {
    return {
      ok: false,
      error: {
        code: "referral_code_invalid_percentage",
        message: "commission_pct must be between 0 and 100",
      },
    };
  }

  return { ok: true, data: input };
}

export function validateDeactivateCode(
  id: string,
): ValidationResult<ReferralCodeDeactivateInput> {
  if (!id) {
    return { ok: false, error: { code: "validation_error", message: "id is required for deactivate" } };
  }

  return { ok: true, data: { id } };
}

export function validateListCodes(
  youtuberId?: string,
): ValidationResult<ReferralCodeListInput> {
  const data: ReferralCodeListInput = {};
  if (youtuberId) {
    data.youtuberId = youtuberId;
  }
  return { ok: true, data };
}

export interface ExistingCode {
  id: string;
  code: string;
}

export function checkCodeConflict(
  existingCodes: ExistingCode[],
  newCode: string,
): { hasConflict: boolean; error?: { code: string; message: string } } {
  const normalized = newCode.toLowerCase();
  const conflict = existingCodes.find(
    (c) => c.code.toLowerCase() === normalized,
  );
  if (conflict) {
    return {
      hasConflict: true,
      error: {
        code: "referral_code_conflict",
        message: `Code ${newCode} already exists`,
      },
    };
  }

  return { hasConflict: false };
}
