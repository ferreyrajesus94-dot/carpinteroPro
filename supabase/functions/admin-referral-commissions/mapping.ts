export interface CommissionFilters {
  youtuberId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  format?: string;
}

export interface CommissionRow {
  id: string;
  workshopId: string;
  youtuberId: string;
  referralCodeId: string;
  subscriptionId: string | null;
  providerPaymentId: string;
  paymentAmount: number;
  commissionPct: number;
  commissionAmount: number;
  currency: string;
  occurredAt: string;
  youtuberName: string | null;
  code: string | null;
  workshopName: string | null;
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

export function validateCommissionsRequest(
  body: Record<string, unknown>,
): ValidationResult<CommissionFilters> {
  const filters: CommissionFilters = {};

  if (body.youtuberId !== undefined) {
    if (typeof body.youtuberId !== "string" || !body.youtuberId.trim()) {
      return { ok: false, error: { code: "validation_error", message: "youtuberId must be a non-empty string" } };
    }
    filters.youtuberId = body.youtuberId.trim();
  }

  if (body.fromDate !== undefined) {
    if (typeof body.fromDate !== "string" || !body.fromDate.trim()) {
      return { ok: false, error: { code: "validation_error", message: "fromDate must be a string" } };
    }
    filters.fromDate = body.fromDate.trim();
  }

  if (body.toDate !== undefined) {
    if (typeof body.toDate !== "string" || !body.toDate.trim()) {
      return { ok: false, error: { code: "validation_error", message: "toDate must be a string" } };
    }
    filters.toDate = body.toDate.trim();
  }

  if (body.limit !== undefined) {
    const limit = Number(body.limit);
    if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
      return { ok: false, error: { code: "validation_error", message: "limit must be between 1 and 1000" } };
    }
    filters.limit = limit;
  }

  if (body.format !== undefined) {
    if (body.format !== "json" && body.format !== "csv") {
      return { ok: false, error: { code: "validation_error", message: "format must be json or csv" } };
    }
    filters.format = body.format;
  }

  return { ok: true, data: filters };
}

export function buildCommissionCsv(rows: CommissionRow[]): string {
  const escape = (v: string | null | undefined): string => {
    if (v == null) return "";
    const str = String(v);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = [
    "occurred_at",
    "youtuber",
    "code",
    "workshop",
    "payment_amount",
    "commission_amount",
    "currency",
  ];

  const dataRows = rows.map((r) =>
    [
      escape(r.occurredAt),
      escape(r.youtuberName),
      escape(r.code),
      escape(r.workshopName),
      escape(String(r.paymentAmount)),
      escape(String(r.commissionAmount)),
      escape(r.currency),
    ].join(","),
  );

  return [headers.map(escape).join(","), ...dataRows].join("\n");
}

export function buildCommissionJsonResponse(
  rows: CommissionRow[],
): { commissions: CommissionRow[] } {
  return { commissions: rows };
}
