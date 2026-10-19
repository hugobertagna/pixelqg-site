// `lemonsqueezy-webhook`: turns a paid Lemon Squeezy order into an active licence (upgrading a trial).
// Lemon Squeezy is the merchant of record, so it handles EU VAT. Wired LAST (owner's decision).
// Deploy with verify_jwt = false: Lemon Squeezy authenticates with its X-Signature HMAC header.
import { serviceClient } from "../_shared/http.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSignature(raw: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  return safeEqual(signature.trim().toLowerCase(), expected);
}

function ok(): Response {
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("X-Signature") ?? "", secret))) {
    return new Response("Bad signature", { status: 400 });
  }

  let body: { meta?: { event_name?: string; custom_data?: Record<string, unknown> }; data?: { id?: string; attributes?: Record<string, unknown> } };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const event = body.meta?.event_name ?? req.headers.get("X-Event-Name") ?? "";
  const attrs = body.data?.attributes ?? {};
  const orderId = String(body.data?.id ?? "");
  const db = serviceClient();

  if (event === "order_created") {
    if (attrs.status !== "paid") return ok();
    const custom = body.meta?.custom_data ?? {};
    let userId = typeof custom.user_id === "string" && UUID_RE.test(custom.user_id) ? custom.user_id : null;
    if (userId) {
      const { data } = await db.auth.admin.getUserById(userId);
      if (!data?.user) userId = null;
    }
    if (!userId) {
      // Fallback: attach the order to the account that uses the same e-mail.
      const email = String(attrs.user_email ?? "").trim().toLowerCase();
      if (email) {
        const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
        userId = profile?.id ?? null;
      }
    }
    if (!userId) {
      console.error("lemonsqueezy-webhook: paid order without a matching account", orderId);
      return ok(); // The owner grants it by hand from the admin panel.
    }
    const { error } = await db.from("licenses").upsert({
      user_id: userId,
      status: "active",
      source: "lemonsqueezy",
      provider_order_id: orderId || null,
      amount_total: typeof attrs.total === "number" ? attrs.total : null,
      currency: typeof attrs.currency === "string" ? attrs.currency.toLowerCase() : null,
      trial_ends_at: null,
      revoked_at: null,
    }, { onConflict: "user_id" });
    if (error) {
      console.error("lemonsqueezy-webhook: licence upsert failed", error.message);
      return new Response("Retry later", { status: 500 });
    }
    return ok();
  }

  if (event === "order_refunded" && orderId) {
    await db.from("licenses").update({ status: "refunded", revoked_at: new Date().toISOString() })
      .eq("provider_order_id", orderId);
    return ok();
  }

  return ok();
});
