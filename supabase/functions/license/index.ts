// `license`: activates a PC for the caller's licence and returns a signed certificate
// (docs/ACCOUNTS.md §1 "Certificate format"). Actions: activate | release | status.
import { callerOf, fail, json, preflight, readJson, serviceClient } from "../_shared/http.ts";

const CERT_DAYS = 14;
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

  const { data: lic, error: licErr } = await db
    .from("licenses").select("id, status, created_at").eq("user_id", user.id).maybeSingle();
  if (licErr) return fail(req, 500, "Impossible de lire ta licence pour le moment.");

  if (action === "status") {
    let devices: unknown[] = [];
    if (lic) {
      const { data } = await db.from("devices").select("name, first_seen, last_seen")
        .eq("license_id", lic.id).order("last_seen", { ascending: false });
      devices = data ?? [];
    }
    return json(req, 200, { ok: true, license: lic ? { status: lic.status, created_at: lic.created_at } : null, devices });
  }

  if (!DEVICE_RE.test(deviceHash)) return fail(req, 400, "Identifiant de PC invalide.", "device");

  if (action === "release") {
    if (lic) await db.from("devices").delete().eq("license_id", lic.id).eq("device_hash", deviceHash);
    return json(req, 200, { ok: true });
  }

  if (action !== "activate") return fail(req, 400, "Action inconnue.");
  if (!lic || lic.status !== "active") {
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
  let certificate: string;
  try {
    certificate = await sign({
      v: 1, lic: lic.id, sub: user.id, email: user.email ?? "", dev: deviceHash, iat: now, exp: now + CERT_DAYS * 86400,
    });
  } catch (_err) {
    return fail(req, 500, "Le serveur de licences n'est pas encore configuré.", "signing");
  }
  return json(req, 200, {
    ok: true,
    certificate,
    license: { status: lic.status, created_at: lic.created_at },
    devices: count ?? 1,
  });
});
