"use server";
import { UserDetails } from "@/app/dashboard/upgrade/page";
import { getServerClients } from "@/lib/appwriteServer";
import { appwriteConfig } from "@/lib/appwriteConfig";
import getBaseUrl from "@/lib/getBaseUrl";
import stripe from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";

export async function createCheckoutSession(userDetails: UserDetails) {
  console.log("🔵 [Checkout] Starting checkout session creation");
  console.log("🔵 [Checkout] User details:", userDetails);
  const { userId } = await auth();
  if (!userId) {
    console.error("❌ [Checkout] No userId found");
    throw new Error("User not found");
  }
  console.log("🔵 [Checkout] Clerk userId:", userId);

  // First check if the user already has a stripeCustomerId
  let stripeCustomerId: string | null = null;
  const { db } = await getServerClients();
  
  try {
    const user = await db.getDocument(
      appwriteConfig.databaseId!,
      appwriteConfig.usersCollectionId!,
      userId
    );
    
    stripeCustomerId = user.stripeCustomerId || null;
    console.log("🔵 [Checkout] Existing Stripe customer ID:", stripeCustomerId);
    console.log("🔵 [Checkout] Current hasActiveMembership:", user.hasActiveMembership);
  } catch (error: any) {
    // Document doesn't exist - this is fine, we'll create it below
    console.log("User document not found, will create new one");
  }

  if (!stripeCustomerId) {
    // Create a new stripe customer
    console.log("🔵 [Checkout] Creating new Stripe customer");
    const customer = await stripe.customers.create({
      email: userDetails.email,
      name: userDetails.name,
      metadata: {
        userId,
      },
    });
    console.log("✅ [Checkout] Created Stripe customer:", customer.id);
    // Try to update first, if fails then create
    try {
      await db.updateDocument(
        appwriteConfig.databaseId!,
        appwriteConfig.usersCollectionId!,
        userId,
        {
          stripeCustomerId: customer.id,
        }
      );
      console.log("✅ [Checkout] Updated existing document with Stripe ID");
    } catch (error) {
      console.log("⚠️ [Checkout] Document doesn't exist, creating new one");
      // Document doesn't exist, create it with all required fields
      await db.createDocument(
        appwriteConfig.databaseId!,
        appwriteConfig.usersCollectionId!,
        userId, // Use Clerk's userId as the document ID
        {
          userId: userId, // Add the required userId field
          stripeCustomerId: customer.id,
        }
      );
      console.log("✅ [Checkout] Created new user document");
    }

    stripeCustomerId = customer.id;
  }
  try {
    const baseUrl = getBaseUrl();
    console.log("Creating checkout session with baseUrl:", baseUrl);
  } catch {
    console.log("Failed to get base URL");
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,  
        quantity: 1,
      },
    ],
    mode: "subscription",
    customer: stripeCustomerId,
    success_url: `${getBaseUrl()}/dashboard?upgrade=true`,
    cancel_url: `${getBaseUrl()}/upgrade`,
  });

  console.log("✅ [Checkout] Checkout session created:", session.id);
  console.log("🔵 [Checkout] Session URL:", session.url);
  console.log("🔵 [Checkout] Stripe customer linked:", stripeCustomerId);

  return { url: session.url };
}