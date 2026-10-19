// `stripe-webhook`: turns a paid Stripe Checkout into an active licence on the buyer's account.
// Wired LAST (owner's decision); until then licences come from `admin-license`.
// Deploy with verify_jwt = false: Stripe authenticates with its own signature header instead.
import { serviceClient } from "../_shared/http.ts";

const TOLERANCE_S = 300;
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

async function verify(raw: string, header: string, secret: string): Promise<boolean> {
  let t = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s.trim());
    if (k === "t") t = v;
    else if (k === "v1" && v) v1.push(v);
  }
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S || v1.length === 0) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  return v1.some((sig) => safeEqual(sig, expected));
}

function ok(): Response {
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("Stripe-Signature") ?? "", secret))) {
    return new Response("Bad signature", { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const obj = event.data?.object ?? {};
  const db = serviceClient();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (obj.payment_status !== "paid") return ok();
    let userId = typeof obj.client_reference_id === "string" && UUID_RE.test(obj.client_reference_id)
      ? obj.client_reference_id : null;
    if (userId) {
      const { data } = await db.auth.admin.getUserById(userId);
      if (!data?.user) userId = null;
    }
    if (!userId) {
      // Fallback: attach the purchase to the account that uses the same e-mail.
      const email = String((obj.customer_details as Record<string, unknown> | undefined)?.email ?? obj.customer_email ?? "")
        .trim().toLowerCase();
      if (email) {
        const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
        userId = profile?.id ?? null;
      }
    }
    if (!userId) {
      console.error("stripe-webhook: paid session without a matching account", obj.id);
      return ok(); // The owner grants it by hand from the admin panel.
    }
    const { error } = await db.from("licenses").upsert({
      user_id: userId,
      status: "active",
      source: "stripe",
      stripe_session_id: String(obj.id ?? ""),
      stripe_payment_intent: typeof obj.payment_intent === "string" ? obj.payment_intent : null,
      amount_total: typeof obj.amount_total === "number" ? obj.amount_total : null,
      currency: typeof obj.currency === "string" ? obj.currency : null,
      revoked_at: null,
    }, { onConflict: "user_id" });
    if (error) {
      console.error("stripe-webhook: licence upsert failed", error.message);
      return new Response("Retry later", { status: 500 }); // Stripe retries.
    }
    return ok();
  }

  if (event.type === "charge.refunded" && obj.refunded === true && typeof obj.payment_intent === "string") {
    await db.from("licenses").update({ status: "refunded", revoked_at: new Date().toISOString() })
      .eq("stripe_payment_intent", obj.payment_intent);
    return ok();
  }

  return ok();
});
