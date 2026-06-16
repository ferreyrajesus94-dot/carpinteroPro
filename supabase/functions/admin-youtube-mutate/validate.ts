export interface YoutuberCreateInput {
  displayName: string;
  channelUrl?: string | null;
  contactEmail?: string | null;
  payoutMethod?: string | null;
}

export interface YoutuberUpdateInput {
  id: string;
  displayName?: string;
  channelUrl?: string | null;
  contactEmail?: string | null;
  payoutMethod?: string | null;
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
