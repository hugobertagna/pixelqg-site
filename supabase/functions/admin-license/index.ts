// `admin-license`: lets an admin grant or revoke a licence by e-mail (used until Stripe is wired).
import { callerOf, fail, json, preflight, readJson, serviceClient } from "../_shared/http.ts";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail(req, 405, "Méthode non autorisée.");

  const db = serviceClient();
  const caller = await callerOf(req, db);
  if (!caller) return fail(req, 401, "Session expirée : reconnecte-toi.", "auth");
  const { data: me } = await db.from("profiles").select("is_admin").eq("id", caller.id).maybeSingle();
  if (!me?.is_admin) return fail(req, 403, "Réservé aux administrateurs.", "forbidden");

  const body = await readJson(req);
  const action = String(body.action ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail(req, 400, "Adresse e-mail invalide.");
  if (action !== "grant" && action !== "revoke") return fail(req, 400, "Action inconnue.");

  const { data: target } = await db.from("profiles").select("id, email").eq("email", email).maybeSingle();
  if (!target) return fail(req, 404, "Aucun compte avec cet e-mail.", "not_found");

  if (action === "grant") {
    const { data, error } = await db.from("licenses")
      .upsert({ user_id: target.id, status: "active", source: "admin", revoked_at: null }, { onConflict: "user_id" })
      .select("id, status, source, created_at").single();
    if (error) return fail(req, 500, "Impossible d'attribuer la licence.");
    return json(req, 200, { ok: true, license: data, email });
  }

  const { data, error } = await db.from("licenses")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("user_id", target.id).select("id, status, source, created_at").maybeSingle();
  if (error) return fail(req, 500, "Impossible de révoquer la licence.");
  if (!data) return fail(req, 404, "Ce compte n'a pas de licence.", "no_license");
  return json(req, 200, { ok: true, license: data, email });
});
