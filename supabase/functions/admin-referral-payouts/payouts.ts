// Pure utility functions for the admin-referral-payouts Edge Function.

export interface CommissionAmount {
	commissionAmount: number;
}

export interface BankDetails {
	payoutCbu?: string | null;
	payoutCvu?: string | null;
	payoutAlias?: string | null;
	payoutBankName?: string | null;
	payoutHolderName?: string | null;
	payoutHolderCuit?: string | null;
}

export interface BankValidationResult {
	valid: boolean;
	errors: Record<string, string>;
}

export interface PayoutRunInput {
	commissionIds: string[];
	totalAmount: number;
	reference?: string | null;
	notes?: string | null;
	createdBy: string;
}

export interface PayoutRunDbRecord {
	id: string;
	created_by: string;
	total_amount: number;
	commission_count: number;
	reference: string | null;
	notes: string | null;
}

const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

/**
 * Computes the sum of commission amounts.
 */
export function computePayoutTotal(commissions: CommissionAmount[]): number {
	return commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
}

/**
 * Validates bank detail fields.
 * CBU must be 22 digits, CVU must be 23 digits, CUIT must match XX-XXXXXXXX-X.
 * Empty fields are allowed (partial save).
 */
export function validateBankDetails(
	details: BankDetails,
): BankValidationResult {
	const errors: Record<string, string> = {};

	if (details.payoutCbu != null && details.payoutCbu.length > 0) {
		if (!/^\d{22}$/.test(details.payoutCbu)) {
			errors.payoutCbu = "CBU debe tener 22 dígitos";
		}
	}

	if (details.payoutCvu != null && details.payoutCvu.length > 0) {
		if (!/^\d{23}$/.test(details.payoutCvu)) {
			errors.payoutCvu = "CVU debe tener 23 dígitos";
		}
	}

	if (details.payoutHolderCuit != null && details.payoutHolderCuit.length > 0) {
		if (!CUIT_REGEX.test(details.payoutHolderCuit)) {
			errors.payoutHolderCuit = "CUIT debe tener formato XX-XXXXXXXX-X";
		}
	}

	return {
		valid: Object.keys(errors).length === 0,
		errors,
	};
}

/**
 * Builds a payout_runs database record from input.
 */
export function buildPayoutRunRecord(input: PayoutRunInput): PayoutRunDbRecord {
	return {
		id: crypto.randomUUID(),
		created_by: input.createdBy,
		total_amount: input.totalAmount,
		commission_count: input.commissionIds.length,
		reference: input.reference ?? null,
		notes: input.notes ?? null,
	};
}
