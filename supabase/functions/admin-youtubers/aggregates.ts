export const ACTIVE_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
] as const;

export interface CodeCountRow {
  youtuber_id: string;
  count: number;
}

export interface ActiveWorkshopsRow {
  youtuber_id: string;
  count: number;
}

export interface CommissionSumRow {
  youtuber_id: string;
  sum: number;
}

interface AggregateQueryResult {
  data: unknown[] | null;
}

interface AggregateFilterBuilder extends AggregateQueryResult {
  in(column: string, values: readonly string[]): AggregateFilterBuilder;
}

interface AggregateQueryBuilder {
  select(
    columns: string,
    options?: { count: "exact"; head: false },
  ): AggregateFilterBuilder;
}

export interface AggregateSupabaseClient {
  from(table: string): AggregateQueryBuilder;
}

export async function loadYoutuberAggregates(
  supabase: AggregateSupabaseClient,
  youtuberIds: string[],
) {
  if (youtuberIds.length === 0) {
    return { codeCounts: [], activeWorkshops: [], commissions: [] };
  }

  const [codeCountsResult, activeWsResult, commissionsResult] = await Promise.all([
    supabase
      .from("referral_codes")
      .select("youtuber_id, count: id", { count: "exact", head: false })
      .in("youtuber_id", youtuberIds),
    supabase
      .from("workshop_referrals")
      .select("youtuber_id, count: workshop_id, subscriptions!inner(status)", {
        count: "exact",
        head: false,
      })
      .in("youtuber_id", youtuberIds)
      .in("subscriptions.status", ACTIVE_SUBSCRIPTION_STATUSES),
    supabase
      .from("referral_commissions")
      .select("youtuber_id, sum: commission_amount")
      .in("youtuber_id", youtuberIds),
  ]);

  return {
    codeCounts: (codeCountsResult.data ?? []) as CodeCountRow[],
    activeWorkshops: (activeWsResult.data ?? []) as ActiveWorkshopsRow[],
    commissions: (commissionsResult.data ?? []) as CommissionSumRow[],
  };
}
