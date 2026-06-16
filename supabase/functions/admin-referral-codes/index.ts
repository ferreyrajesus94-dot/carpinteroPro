import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";
import {
  validateCreateCode,
  validateDeactivateCode,
  validateListCodes,
  checkCodeConflict,
} from "./validate.ts";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface ReferralCodesRequest {
  action: "list" | "create" | "deactivate";
  youtuberId?: string;
  code?: string;
  discountPct?: number;
  commissionPct?: number;
  id?: string;
}

interface CodeRow {
  id: string;
  youtuber_id: string;
  code: string;
  discount_pct: number;
  commission_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface YoutuberRow {
  id: string;
  display_name: string;
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") {
    return structuredErr("method_not_allowed", "Method not allowed", 405);
  }

  try {
    await requirePlatformAdmin(req);

    const body: ReferralCodesRequest = await req.json().catch(() => ({} as ReferralCodesRequest));
    const { action } = body;

    if (!action || !["list", "create", "deactivate"].includes(action)) {
      return structuredErr(
        "validation_error",
        "action must be list, create, or deactivate",
        400,
      );
    }

    switch (action) {
      case "list": {
        const validation = validateListCodes(body.youtuberId);
        if (!validation.ok) {
          return json(validation.error, 400);
        }

        const supabase = serviceClient();

        let codesQuery = supabase
          .from("referral_codes")
          .select("*")
          .order("created_at", { ascending: false })
          .returns<CodeRow[]>();

        if (validation.data.youtuberId) {
          codesQuery = codesQuery.eq("youtuber_id", validation.data.youtuberId);
        }

        const { data: codes, error: codesError } = await codesQuery;
        if (codesError) {
          console.error("admin-referral-codes: list failed", codesError);
          return structuredErr("list_failed", "No se pudieron cargar los códigos", 500);
        }

        // Fetch youtuber names for the codes
        const youtuberIds = [...new Set((codes ?? []).map((c: CodeRow) => c.youtuber_id))];
        const { data: youtubers } = await supabase
          .from("youtubers")
          .select("id, display_name")
          .in("id", youtuberIds)
          .returns<YoutuberRow[]>();

        const youtuberNameById = new Map(
          (youtubers ?? []).map((y: YoutuberRow) => [y.id, y.display_name]),
        );

        const mappedCodes = (codes ?? []).map((c: CodeRow) => ({
          id: c.id,
          youtuberId: c.youtuber_id,
          youtuberName: youtuberNameById.get(c.youtuber_id) ?? null,
          code: c.code,
          discountPct: c.discount_pct,
          commissionPct: c.commission_pct,
          isActive: c.is_active,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));

        return json({ codes: mappedCodes });
      }

      case "create": {
        const validation = validateCreateCode({
          youtuberId: body.youtuberId ?? "",
          code: body.code ?? "",
          discountPct: body.discountPct ?? 0,
          commissionPct: body.commissionPct ?? 0,
        });
        if (!validation.ok) {
          return json(validation.error, 400);
        }

        // Check case-insensitive duplicate
        const { data: existingCodes } = await serviceClient()
          .from("referral_codes")
          .select("id, code")
          .returns<{ id: string; code: string }[]>();

        const conflict = checkCodeConflict(existingCodes ?? [], validation.data.code);
        if (conflict.hasConflict) {
          return json(conflict.error!, 409);
        }

        const { data, error } = await serviceClient()
          .from("referral_codes")
          .insert({
            youtuber_id: validation.data.youtuberId,
            code: validation.data.code,
            discount_pct: validation.data.discountPct,
            commission_pct: validation.data.commissionPct,
            is_active: true,
          })
          .select("id")
          .returns<{ id: string }[]>();

        if (error) {
          // Handle DB-level unique violation
          if (error.code === "23505") {
            return json(
              { code: "referral_code_conflict", message: `Code ${validation.data.code} already exists` },
              409,
            );
          }
          console.error("admin-referral-codes: create failed", error);
          return structuredErr("create_failed", "No se pudo crear el código", 500);
        }

        return json({ id: data?.[0]?.id }, 201);
      }

      case "deactivate": {
        const validation = validateDeactivateCode(body.id ?? "");
        if (!validation.ok) {
          return json(validation.error, 400);
        }

        const { data, error } = await serviceClient()
          .from("referral_codes")
          .update({ is_active: false })
          .eq("id", validation.data.id)
          .select("id, is_active")
          .returns<{ id: string; is_active: boolean }[]>();

        if (error) {
          console.error("admin-referral-codes: deactivate failed", error);
          return structuredErr("deactivate_failed", "No se pudo desactivar el código", 500);
        }
        if (!data || data.length === 0) {
          return structuredErr("code_not_found", "Código no encontrado", 404);
        }

        return json({ id: data[0].id, isActive: data[0].is_active });
      }
    }
  } catch (e: unknown) {
    if (e instanceof AdminAuthError) {
      return structuredErr("admin_auth_failed", e.message, e.status);
    }
    console.error("admin-referral-codes failed", e);
    return structuredErr("codes_failed", "Error al gestionar códigos", 500);
  }
});
