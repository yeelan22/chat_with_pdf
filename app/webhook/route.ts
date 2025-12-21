import { appwriteConfig } from "@/lib/appwriteConfig";
import { getServerClients } from "@/lib/appwriteServer";
import stripe from "@/lib/stripe";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  console.log("🟢 [Webhook] Received webhook request");

  const headersList = await headers();
  const body = await req.text(); // important: must be req.text() not req.json()
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("❌ [Webhook] No signature found");
    return new Response("No signature", { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.log("⚠️ Stripe webhook secret is not set.");
    return new NextResponse("Stripe webhook secret is not set", {
      status: 400,
    });
  }

  let event: Stripe.Event;

  const { db } = await getServerClients();
  const getUserDetails = async (customerId: string) => {
    console.log("Looking for customer ID:", customerId);
    console.log("Customer ID type:", typeof customerId);  
     // Check if customerId is valid
  if (!customerId || customerId === 'null' || customerId === 'undefined') {
    console.error("Invalid customer ID");
    return null;
  }
    try {
    const userDoc = await db.listDocuments(
        appwriteConfig.databaseId!,
        appwriteConfig.usersCollectionId!,
        [
            Query.equal("stripeCustomerId", customerId),
            Query.limit(1)
        ]
    )
    
    if (userDoc.documents.length === 0) {
        throw new Error("User not found")
      }
  
      return userDoc.documents[0];
    } catch (err: any) {
      console.error("Error querying user:", err);
      return null;
    }
  }
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("✅ [Webhook] Signature verified");
    console.log("🟢 [Webhook] Event type:", event.type);
    console.log("🟢 [Webhook] Event ID:", event.id);
  } catch (err) {
    console.error(`Webhook Error: ${err}`);
    return new NextResponse(`Webhook Error: ${err}`, { status: 400 });
  }

  switch(event.type) {
    case "checkout.session.completed":
    case "payment_intent.succeeded":{     
        console.log("🟢 [Webhook] Processing checkout.session.completed");   
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        console.log("🟢 [Webhook] Session ID:", invoice.id);
        console.log("🟢 [Webhook] Customer ID:", customerId);
        console.log("🟢 [Webhook] Payment status:");
        const userDetails = await getUserDetails(customerId);
        if (!userDetails?.$id) {
            return new NextResponse("user not found", { status: 404})
        }

        //Update the user's subscription status
        await db.updateDocument(
            appwriteConfig.databaseId!,
            appwriteConfig.usersCollectionId!,
            userDetails?.$id,
            {
                hasActiveMembership: true
            }
        );

        console.log("✅ [Webhook] Successfully updated membership to TRUE");
        
        // Verify the update
        const updatedUser = await db.getDocument(
          appwriteConfig.databaseId!,
          appwriteConfig.usersCollectionId!,
          userDetails.$id
        );
        console.log("🟢 [Webhook] Verified membership status:", updatedUser.hasActiveMembership);

        break;
    }
    case "customer.subscription.deleted":
    case "subscription_schedule.canceled": {
          console.log("🟢 [Webhook] Processing subscription cancellation");
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
    
          console.log("🟢 [Webhook] Subscription ID:", subscription.id);
          console.log("🟢 [Webhook] Customer ID:", customerId);

          const userDetails = await getUserDetails(customerId);
          if (!userDetails?.$id) {
            return new NextResponse("User not found", { status: 404 });
          }
    
          //Update the user's subscription status
          await db.updateDocument(
            appwriteConfig.databaseId!,
            appwriteConfig.usersCollectionId!,
            userDetails?.$id,
            {
                hasActiveMembership: false
            }
        );
        console.log("✅ [Webhook] Subscription cancelled, membership updated to FALSE");

        break;
    }
    default: {
        console.log("Unhandled event type", event.type);
    }
  }
    
  return NextResponse.json({ message: "Webhook received" });
}