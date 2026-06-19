import { requirePlatformAdmin, AdminAuthError } from "../_shared/admin-auth.ts";
import { serviceClient } from "../_shared/auth.ts";
import { json, preflight, structuredErr } from "../_shared/response.ts";
import {
  validateCreateYoutuber,
  validateUpdateYoutuber,
  validateToggleYoutuber,
} from "./validate.ts";

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface MutateRequest {
  action: "create" | "update" | "toggle";
  id?: string;
  displayName?: string;
  channelUrl?: string;
  contactEmail?: string;
  payoutMethod?: string;
  isActive?: boolean;
  // Bank detail fields
  payoutCbu?: string;
  payoutCvu?: string;
  payoutAlias?: string;
  payoutBankName?: string;
  payoutHolderName?: string;
  payoutHolderCuit?: string;
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") {
    return structuredErr("method_not_allowed", "Method not allowed", 405);
  }

  try {
    await requirePlatformAdmin(req);

    const body: MutateRequest = await req.json().catch(() => ({} as MutateRequest));
    const { action } = body;

    if (!action || !["create", "update", "toggle"].includes(action)) {
      return structuredErr(
        "validation_error",
        "action must be create, update, or toggle",
        400,
      );
    }

    switch (action) {
      case "create": {
        const validation = validateCreateYoutuber({
          displayName: body.displayName ?? "",
          channelUrl: body.channelUrl,
          contactEmail: body.contactEmail,
          payoutMethod: body.payoutMethod,
          payoutCbu: body.payoutCbu,
          payoutCvu: body.payoutCvu,
          payoutAlias: body.payoutAlias,
          payoutBankName: body.payoutBankName,
          payoutHolderName: body.payoutHolderName,
          payoutHolderCuit: body.payoutHolderCuit,
        });
        if (!validation.ok) {
          return json(validation.error, 400);
        }

        const { data, error } = await serviceClient()
          .from("youtubers")
          .insert({
            display_name: validation.data.displayName.trim(),
            channel_url: validation.data.channelUrl || null,
            contact_email: validation.data.contactEmail || null,
            payout_method: validation.data.payoutMethod || null,
            payout_cbu: validation.data.payoutCbu || null,
            payout_cvu: validation.data.payoutCvu || null,
            payout_alias: validation.data.payoutAlias || null,
            payout_bank_name: validation.data.payoutBankName || null,
            payout_holder_name: validation.data.payoutHolderName || null,
            payout_holder_cuit: validation.data.payoutHolderCuit || null,
            is_active: true,
          })
          .select("id")
          .returns<{ id: string }[]>();

        if (error) {
          console.error("admin-youtube-mutate: create failed", error);
          return structuredErr("create_failed", "No se pudo crear el youtuber", 500);
        }

        return json({ id: data?.[0]?.id }, 201);
      }

      case "update": {
        const validation = validateUpdateYoutuber(body.id ?? "", {
          displayName: body.displayName,
          channelUrl: body.channelUrl,
          contactEmail: body.contactEmail,
          payoutMethod: body.payoutMethod,
          payoutCbu: body.payoutCbu,
          payoutCvu: body.payoutCvu,
          payoutAlias: body.payoutAlias,
          payoutBankName: body.payoutBankName,
          payoutHolderName: body.payoutHolderName,
          payoutHolderCuit: body.payoutHolderCuit,
        });
        if (!validation.ok) {
          return json(validation.error, 400);
        }

        const updateData: Record<string, unknown> = {};
        if (validation.data.displayName !== undefined) {
          updateData.display_name = validation.data.displayName.trim();
        }
        if (validation.data.channelUrl !== undefined) {
          updateData.channel_url = validation.data.channelUrl || null;
        }
        if (validation.data.contactEmail !== undefined) {
          updateData.contact_email = validation.data.contactEmail || null;
        }
        if (validation.data.payoutMethod !== undefined) {
          updateData.payout_method = validation.data.payoutMethod || null;
        }
        // Bank detail fields
        if (validation.data.payoutCbu !== undefined) {
          updateData.payout_cbu = validation.data.payoutCbu || null;
        }
        if (validation.data.payoutCvu !== undefined) {
          updateData.payout_cvu = validation.data.payoutCvu || null;
        }
        if (validation.data.payoutAlias !== undefined) {
          updateData.payout_alias = validation.data.payoutAlias || null;
        }
        if (validation.data.payoutBankName !== undefined) {
          updateData.payout_bank_name = validation.data.payoutBankName || null;
        }
        if (validation.data.payoutHolderName !== undefined) {
          updateData.payout_holder_name = validation.data.payoutHolderName || null;
        }
        if (validation.data.payoutHolderCuit !== undefined) {
          updateData.payout_holder_cuit = validation.data.payoutHolderCuit || null;
        }

        const { error } = await serviceClient()
          .from("youtubers")
          .update(updateData)
          .eq("id", validation.data.id);

        if (error) {
          console.error("admin-youtube-mutate: update failed", error);
          return structuredErr("update_failed", "No se pudo actualizar el youtuber", 500);
        }

        return json({ id: validation.data.id });
      }

      case "toggle": {
        const validation = validateToggleYoutuber(
          body.id ?? "",
          body.isActive ?? false,
        );
        if (!validation.ok) {
          return json(validation.error, 400);
        }

        const { data, error } = await serviceClient()
          .from("youtubers")
          .update({ is_active: validation.data.isActive })
          .eq("id", validation.data.id)
          .select("id, is_active")
          .returns<{ id: string; is_active: boolean }[]>();

        if (error) {
          console.error("admin-youtube-mutate: toggle failed", error);
          return structuredErr("toggle_failed", "No se pudo cambiar el estado", 500);
        }
        if (!data || data.length === 0) {
          return structuredErr("youtuber_not_found", "Youtuber no encontrado", 404);
        }

        return json({ id: data[0].id, isActive: data[0].is_active });
      }
    }
  } catch (e: unknown) {
    if (e instanceof AdminAuthError) {
      return structuredErr("admin_auth_failed", e.message, e.status);
    }
    console.error("admin-youtube-mutate failed", e);
    return structuredErr("mutate_failed", "Error al modificar youtuber", 500);
  }
});
