// `license`: activates a PC for the caller's licence and returns a signed certificate
// (docs/ACCOUNTS.md §1 "Certificate format"). Actions: activate | release | status.
import { callerOf, fail, json, preflight, readJson, serviceClient } from "../_shared/http.ts";

const CERT_DAYS = 14;
const TRIAL_DAYS = 7;
const DEVICE_RE = /^[0-9a-f]{64}$/;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64decode(text: string): Uint8Array {
  const bin = atob(text.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let signingKey: CryptoKey | null = null;
async function key(): Promise<CryptoKey> {
  if (signingKey) return signingKey;
  const secret = Deno.env.get("LICENSE_PRIVATE_KEY");
  if (!secret) throw new Error("LICENSE_PRIVATE_KEY is not set");
  signingKey = await crypto.subtle.importKey("pkcs8", b64decode(secret), { name: "Ed25519" }, false, ["sign"]);
  return signingKey;
}

/** base64url(payload) + "." + base64url(Ed25519 signature over that base64url string). */
async function sign(payload: Record<string, unknown>): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, await key(), new TextEncoder().encode(body)));
  return body + "." + b64url(sig);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail(req, 405, "Méthode non autorisée.");

  const db = serviceClient();
  const user = await callerOf(req, db);
  if (!user) return fail(req, 401, "Session expirée : reconnecte-toi.", "auth");

  const body = await readJson(req);
  const action = String(body.action ?? "");
  const deviceHash = typeof body.device_hash === "string" ? body.device_hash.toLowerCase() : "";
  const deviceName = typeof body.device_name === "string" ? body.device_name.slice(0, 60) : null;

  let { data: lic, error: licErr } = await db
    .from("licenses").select("id, status, created_at, trial_ends_at").eq("user_id", user.id).maybeSingle();
  if (licErr) return fail(req, 500, "Impossible de lire ta licence pour le moment.");

  const publicLicense = (l: typeof lic) =>
    l ? { status: l.status, created_at: l.created_at, trial_ends_at: l.trial_ends_at ?? null } : null;

  if (action === "status") {
    let devices: unknown[] = [];
    if (lic) {
      const { data } = await db.from("devices").select("name, first_seen, last_seen")
        .eq("license_id", lic.id).order("last_seen", { ascending: false });
      devices = data ?? [];
    }
    return json(req, 200, { ok: true, license: publicLicense(lic), devices });
  }

  if (!DEVICE_RE.test(deviceHash)) return fail(req, 400, "Identifiant de PC invalide.", "device");

  if (action === "release") {
    if (lic) await db.from("devices").delete().eq("license_id", lic.id).eq("device_hash", deviceHash);
    return json(req, 200, { ok: true });
  }

  if (action !== "activate") return fail(req, 400, "Action inconnue.");

  // No licence yet: start the free trial, once per PC (whatever the account).
  if (!lic) {
    const { error: trialErr } = await db.from("trial_devices").insert({ device_hash: deviceHash, user_id: user.id });
    if (trialErr) {
      if (trialErr.code === "23505") {
        return fail(req, 402, "L'essai gratuit a déjà été utilisé sur ce PC. Achète PixelQG pour continuer.", "trial_used");
      }
      return fail(req, 500, "Impossible de démarrer l'essai gratuit pour le moment.");
    }
    const ends = new Date(Date.now() + TRIAL_DAYS * 86400 * 1000).toISOString();
    const { data: created, error: createErr } = await db.from("licenses")
      .insert({ user_id: user.id, status: "trial", source: "trial", trial_ends_at: ends })
      .select("id, status, created_at, trial_ends_at").single();
    if (createErr || !created) return fail(req, 500, "Impossible de démarrer l'essai gratuit pour le moment.");
    lic = created;
  }

  const trialEnd = lic.status === "trial" && lic.trial_ends_at ? Math.floor(new Date(lic.trial_ends_at).getTime() / 1000) : 0;
  if (lic.status === "trial" && trialEnd <= Math.floor(Date.now() / 1000)) {
    return fail(req, 402, "Ton essai gratuit est terminé. Achète PixelQG pour continuer.", "trial_ended");
  }
  if (lic.status !== "active" && lic.status !== "trial") {
    return fail(req, 402, "Aucune licence active sur ce compte.", "no_license");
  }

  const { data: existing } = await db.from("devices").select("id")
    .eq("license_id", lic.id).eq("device_hash", deviceHash).maybeSingle();
  if (existing) {
    await db.from("devices").update({ last_seen: new Date().toISOString(), ...(deviceName ? { name: deviceName } : {}) })
      .eq("id", existing.id);
  } else {
    const { error: insErr } = await db.from("devices")
      .insert({ license_id: lic.id, device_hash: deviceHash, name: deviceName });
    if (insErr) {
      if (/device_limit/.test(insErr.message)) {
        return fail(req, 409, "Trop d'appareils : libère un PC depuis ton compte.", "device_limit");
      }
      if (insErr.code !== "23505") return fail(req, 500, "Impossible d'activer ce PC pour le moment.");
    }
  }
  const { count } = await db.from("devices").select("id", { count: "exact", head: true }).eq("license_id", lic.id);

  const now = Math.floor(Date.now() / 1000);
  const isTrial = lic.status === "trial";
  const exp = isTrial ? Math.min(now + CERT_DAYS * 86400, trialEnd) : now + CERT_DAYS * 86400;
  let certificate: string;
  try {
    certificate = await sign({
      v: 1, lic: lic.id, sub: user.id, email: user.email ?? "", dev: deviceHash, iat: now, exp,
      ...(isTrial ? { trial: true, trial_ends: trialEnd } : {}),
    });
  } catch (_err) {
    return fail(req, 500, "Le serveur de licences n'est pas encore configuré.", "signing");
  }
  return json(req, 200, {
    ok: true,
    certificate,
    license: publicLicense(lic),
    devices: count ?? 1,
  });
});
