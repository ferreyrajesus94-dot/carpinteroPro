export interface YoutuberDbRow {
  id: string;
  display_name: string;
  channel_url: string | null;
  contact_email: string | null;
  payout_method: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface YoutuberAggregates {
  codeCount: number;
  activeWorkshops: number;
  lifetimeCommission: number;
}

export interface YoutuberSummary {
  id: string;
  displayName: string;
  channelUrl: string | null;
  contactEmail: string | null;
  payoutMethod: string | null;
  isActive: boolean;
  codeCount: number;
  activeReferredWorkshops: number;
  lifetimeCommission: number;
}

export function mapYoutuberSummary(
  row: YoutuberDbRow,
  codeCount: number,
  activeReferredWorkshops: number,
  lifetimeCommission: number,
): YoutuberSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    channelUrl: row.channel_url,
    contactEmail: row.contact_email,
    payoutMethod: row.payout_method,
    isActive: row.is_active,
    codeCount,
    activeReferredWorkshops,
    lifetimeCommission,
  };
}

export function mapYoutuberList(
  rows: YoutuberDbRow[],
  aggregatesByYoutuberId: Record<string, YoutuberAggregates>,
): { youtubers: YoutuberSummary[] } {
  return {
    youtubers: rows.map((row) => {
      const agg = aggregatesByYoutuberId[row.id] ?? {
        codeCount: 0,
        activeWorkshops: 0,
        lifetimeCommission: 0,
      };
      return mapYoutuberSummary(
        row,
        agg.codeCount,
        agg.activeWorkshops,
        agg.lifetimeCommission,
      );
    }),
  };
}
