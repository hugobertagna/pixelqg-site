// `download`: a 10-minute signed link to the newest app release, for any signed-in account.
import { callerOf, fail, json, preflight, serviceClient } from "../_shared/http.ts";

const BUCKET = "releases";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail(req, 405, "Méthode non autorisée.");

  const db = serviceClient();
  const user = await callerOf(req, db);
  if (!user) return fail(req, 401, "Session expirée : reconnecte-toi.", "auth");

  // Any signed-in account may download: the app itself refuses to run without a trial or a licence.

  const { data: files, error } = await db.storage.from(BUCKET).list("", {
    limit: 1, sortBy: { column: "created_at", order: "desc" },
  });
  const latest = (files ?? []).find((f) => f.name && !f.name.startsWith("."));
  if (error || !latest) return fail(req, 404, "Aucune version n'est encore disponible au téléchargement.", "no_release");

  const { data: signed, error: signErr } = await db.storage.from(BUCKET).createSignedUrl(latest.name, 600, { download: true });
  if (signErr || !signed) return fail(req, 500, "Impossible de préparer le téléchargement.");
  return json(req, 200, { ok: true, url: signed.signedUrl, name: latest.name, size: latest.metadata?.size ?? null });
});
