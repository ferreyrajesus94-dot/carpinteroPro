export interface YoutuberCreateInput {
  displayName: string;
  channelUrl?: string | null;
  contactEmail?: string | null;
  payoutMethod?: string | null;
  payoutCbu?: string | null;
  payoutCvu?: string | null;
  payoutAlias?: string | null;
  payoutBankName?: string | null;
  payoutHolderName?: string | null;
  payoutHolderCuit?: string | null;
}

export interface YoutuberUpdateInput {
  id: string;
  displayName?: string;
  channelUrl?: string | null;
  contactEmail?: string | null;
  payoutMethod?: string | null;
  payoutCbu?: string | null;
  payoutCvu?: string | null;
  payoutAlias?: string | null;
  payoutBankName?: string | null;
  payoutHolderName?: string | null;
  payoutHolderCuit?: string | null;
}

export interface YoutuberToggleInput {
  id: string;
  isActive: boolean;
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/;
const CBU_DIGITS_22 = /^\d{22}$/;
const CVU_DIGITS_23 = /^\d{23}$/;
const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

function validateBankFields(
  input: Partial<YoutuberCreateInput>,
): string[] {
  const errors: string[] = [];

  if (input.payoutCbu != null && input.payoutCbu.length > 0) {
    if (!CBU_DIGITS_22.test(input.payoutCbu)) {
      errors.push("CBU debe tener 22 dígitos");
    }
  }

  if (input.payoutCvu != null && input.payoutCvu.length > 0) {
    if (!CVU_DIGITS_23.test(input.payoutCvu)) {
      errors.push("CVU debe tener 23 dígitos");
    }
  }

  if (input.payoutHolderCuit != null && input.payoutHolderCuit.length > 0) {
    if (!CUIT_REGEX.test(input.payoutHolderCuit)) {
      errors.push("CUIT debe tener formato XX-XXXXXXXX-X");
    }
  }

  return errors;
}

export function validateCreateYoutuber(
  input: YoutuberCreateInput,
): ValidationResult<YoutuberCreateInput> {
  if (!input.displayName || input.displayName.trim().length === 0) {
    return { ok: false, error: { code: "validation_error", message: "display_name is required" } };
  }

  if (input.contactEmail != null && input.contactEmail.length > 0) {
    if (!EMAIL_REGEX.test(input.contactEmail)) {
      return { ok: false, error: { code: "validation_error", message: "Invalid email format" } };
    }
  }

  if (input.channelUrl != null && input.channelUrl.length > 0) {
    if (!URL_REGEX.test(input.channelUrl)) {
      return { ok: false, error: { code: "validation_error", message: "Invalid channel_url format" } };
    }
  }

  const bankErrors = validateBankFields(input);
  if (bankErrors.length > 0) {
    return {
      ok: false,
      error: { code: "invalid_bank_details", message: bankErrors.join("; ") },
    };
  }

  return { ok: true, data: input };
}

export function validateUpdateYoutuber(
  id: string,
  input: Partial<YoutuberCreateInput>,
): ValidationResult<YoutuberUpdateInput> {
  if (!id) {
    return { ok: false, error: { code: "validation_error", message: "id is required for update" } };
  }

  if (input.contactEmail != null && input.contactEmail.length > 0) {
    if (!EMAIL_REGEX.test(input.contactEmail)) {
      return { ok: false, error: { code: "validation_error", message: "Invalid email format" } };
    }
  }

  if (input.channelUrl != null && input.channelUrl.length > 0) {
    if (!URL_REGEX.test(input.channelUrl)) {
      return { ok: false, error: { code: "validation_error", message: "Invalid channel_url format" } };
    }
  }

  const bankErrors = validateBankFields(input);
  if (bankErrors.length > 0) {
    return {
      ok: false,
      error: { code: "invalid_bank_details", message: bankErrors.join("; ") },
    };
  }

  return { ok: true, data: { id, ...input } };
}

export function validateToggleYoutuber(
  id: string,
  isActive: boolean,
): ValidationResult<YoutuberToggleInput> {
  if (!id) {
    return { ok: false, error: { code: "validation_error", message: "id is required for toggle" } };
  }

  return { ok: true, data: { id, isActive } };
}
