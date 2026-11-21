// Single source of truth for paid patient access. Fail closed on Stripe/Supabase errors.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const normal = value => String(value || "").trim().toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validSession = value => /^cs_(test_|live_)[A-Za-z0-9]+$/.test(value);

export async function verifyConsultAccess({ email, paymentSessionId = "", bearer = "", unusedOnly = false }) {
  const requestedEmail = normal(email);
  if (!validEmail(requestedEmail)) return { allowed: false, reason: "email_invalid" };
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe not configured");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Paid one-time €30 consultation: match price, product and buyer email.
  if (paymentSessionId && validSession(paymentSessionId)) {
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(paymentSessionId);
    } catch (error) {
      return { allowed: false, reason: "session_invalid" };
    }
    const payerEmail = normal(session.customer_details?.email || session.customer_email);
    const correctPayment = session.id === paymentSessionId &&
      session.mode === "payment" && session.payment_status === "paid" &&
      session.amount_total === 3000 && session.currency === "eur" &&
      session.metadata?.servizio === "consulto_singolo_30" &&
      normal(session.metadata?.email_paziente) === requestedEmail &&
      payerEmail === requestedEmail;
    if (correctPayment) {
      if (unusedOnly) {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error("Consultation registry not configured");
        }
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { count, error } = await supabase.from("consults")
          .select("id", { count: "exact", head: true })
          .ilike("clinical_data", "%Pagamento Stripe: " + paymentSessionId + "%");
        if (error) throw error;
        if (count) return { allowed: false, reason: "already_used" };
      }
      return { allowed: true, access: "single", email: requestedEmail };
    }
  }

  // Existing annual customers must log in with their own Supabase identity.
  // Possession of someone's email address never grants access.
  const token = String(bearer).startsWith("Bearer ") ? String(bearer).slice(7) : "";
  if (token && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user && normal(data.user.email) === requestedEmail) {
      const customers = await stripe.customers.list({ email: requestedEmail, limit: 10 });
      for (const customer of customers.data) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id, status: "active", limit: 10
        });
        for (const sub of subscriptions.data) {
          if (!sub.latest_invoice) continue;
          const invoice = typeof sub.latest_invoice === "string"
            ? await stripe.invoices.retrieve(sub.latest_invoice)
            : sub.latest_invoice;
          if (invoice.status === "paid" && invoice.amount_paid > 0) {
            return { allowed: true, access: "legacy_annual", email: requestedEmail };
          }
        }
      }
    }
  }
  return { allowed: false, reason: "payment_required" };
}
