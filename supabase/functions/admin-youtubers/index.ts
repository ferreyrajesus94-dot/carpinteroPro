import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";
import { mapYoutuberList, type YoutuberDbRow } from "./mapping.ts";
import { loadYoutuberAggregates } from "./aggregates.ts";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: { get(key: string): string | undefined };
};

interface AdminYoutubersRequest {
  search?: string;
  youtuberId?: string;
}

async function readBody(req: Request): Promise<AdminYoutubersRequest> {
  if (!req.body) return {};
  const body: unknown = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  return {
    search: typeof record.search === "string" ? record.search.trim() : undefined,
    youtuberId: typeof record.youtuberId === "string" ? record.youtuberId : undefined,
  };
}

function escapeIlikeSearch(search: string): string {
  return search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function loadYoutubers(body: AdminYoutubersRequest): Promise<YoutuberDbRow[]> {
  const supabase = serviceClient();
  let query = supabase
    .from("youtubers")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<YoutuberDbRow[]>();

  if (body.youtuberId) {
    query = query.eq("id", body.youtuberId);
  }
  if (!body.youtuberId && body.search) {
    query = query.ilike("display_name", `%${escapeIlikeSearch(body.search)}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("admin-youtubers: lookup failed", error);
    return [];
  }
  return data ?? [];
}

async function loadAggregates(youtuberIds: string[]) {
  const supabase = serviceClient();
  return await loadYoutuberAggregates(supabase, youtuberIds);
}

async function handleAuthorizedRequest(
  body: AdminYoutubersRequest,
): Promise<Response> {
  const youtubers = await loadYoutubers(body);
  const youtuberIds = youtubers.map((y: YoutuberDbRow) => y.id);

  const aggregates = await loadAggregates(youtuberIds);

  // Build aggregates map
  const aggregatesByYoutuberId: Record<string, { codeCount: number; activeWorkshops: number; lifetimeCommission: number }> = {};

  for (const yt of aggregates.codeCounts) {
    if (!aggregatesByYoutuberId[yt.youtuber_id]) {
      aggregatesByYoutuberId[yt.youtuber_id] = { codeCount: 0, activeWorkshops: 0, lifetimeCommission: 0 };
    }
    aggregatesByYoutuberId[yt.youtuber_id].codeCount = yt.count;
  }

  for (const yt of aggregates.activeWorkshops) {
    if (!aggregatesByYoutuberId[yt.youtuber_id]) {
      aggregatesByYoutuberId[yt.youtuber_id] = { codeCount: 0, activeWorkshops: 0, lifetimeCommission: 0 };
    }
    aggregatesByYoutuberId[yt.youtuber_id].activeWorkshops = yt.count;
  }

  for (const yt of aggregates.commissions) {
    if (!aggregatesByYoutuberId[yt.youtuber_id]) {
      aggregatesByYoutuberId[yt.youtuber_id] = { codeCount: 0, activeWorkshops: 0, lifetimeCommission: 0 };
    }
    aggregatesByYoutuberId[yt.youtuber_id].lifetimeCommission = yt.sum;
  }

  return json(mapYoutuberList(youtubers, aggregatesByYoutuberId));
}

async function handleRequest(req: Request): Promise<Response> {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") {
    return structuredErr("method_not_allowed", "Method not allowed", 405);
  }

  try {
    await requirePlatformAdmin(req);
    return await handleAuthorizedRequest(await readBody(req));
  } catch (e: unknown) {
    if (e instanceof AdminAuthError) {
      return structuredErr("admin_auth_failed", e.message, e.status);
    }
    console.error("admin-youtubers failed", e);
    return structuredErr(
      "admin_youtubers_failed",
      "No se pudieron cargar los youtubers",
      500,
    );
  }
}

Deno.serve(handleRequest);
