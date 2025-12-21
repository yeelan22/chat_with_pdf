"use server";

import { appwriteConfig } from "@/lib/appwriteConfig";
import { getServerClients } from "@/lib/appwriteServer";
import getBaseUrl from "@/lib/getBaseUrl";
import stripe from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";

export async function createStripePortal() {
  auth.protect();

  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not found");
  }

  //   get customer ID from firebase
  const { db } = await getServerClients();
  const user = await db.getDocument(
    appwriteConfig.databaseId!,
    appwriteConfig.usersCollectionId!,
    userId
  )
  const stripeCustomerId = user?.stripeCustomerId;

  if (!stripeCustomerId) {
    throw new Error("Stripe customer not found");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${getBaseUrl()}/dashboard`,
  });

  return session.url;
}