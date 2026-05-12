import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metodo non consentito"
    });
  }

  try {

    const session = await stripe.checkout.sessions.create({

      mode: "subscription",

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],

      success_url:
        process.env.SITE_URL + "/?success=true",

      cancel_url:
        process.env.SITE_URL + "/?canceled=true"

    });

    return res.status(200).json({
      url: session.url
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Errore Stripe"
    });
  }
}
  }
}
