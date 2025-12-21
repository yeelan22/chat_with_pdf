import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if(!stripeSecretKey) {
    throw new Error('⚠️ STRIPE_SECRET_KEY is not set. Stripe cannot be initialized.');
}

const stripe = new Stripe(stripeSecretKey);

export default stripe;