'use server';

import { auth } from "@clerk/nextjs/server";
import { Permission, Query, Role } from "node-appwrite";
import { getServerClients } from "@/lib/appwriteServer";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { generateLangchainCompletion } from "@/lib/langchain";

const FREE_LIMIT = 2;
const PRO_LIMIT = 100;

export async function askQuestion(
  id: string,
  question: string
): Promise<{ success: boolean; message: string | null }> {
  console.log("🔵 [askQuestion] Starting with fileId:", id);
  console.log("🔵 [askQuestion] Question:", question);

  auth.protect();
  const { userId } = await auth();

  if (!userId) {
    console.error("❌ [askQuestion] No userId");
    return { success: false, message: "User not authenticated" };
  }

  console.log("🔵 [askQuestion] userId:", userId);

  let db;
  try {
    const clients = await getServerClients();
    db = clients.db;
    console.log("✅ [askQuestion] Got Appwrite client");
  } catch (error: any) {
    console.error("❌ [askQuestion] Failed to get Appwrite client", error);
    return { success: false, message: "Failed to get Appwrite client" };
  }

  // ─────────────────────────────────────────────
  // Step 1: Check user membership and message limits
  // ─────────────────────────────────────────────
  let hasActiveMembership = false;
  
  try {
    console.log("🔵 [askQuestion] Fetching user document...");
    const userRef = await db.getDocument(
      appwriteConfig.databaseId!,
      appwriteConfig.usersCollectionId!,
      userId
    );
    
    hasActiveMembership = userRef?.hasActiveMembership || false;
    console.log("✅ [askQuestion] User membership status:", hasActiveMembership);
  } catch (error: any) {
    console.error("⚠️ [askQuestion] User document not found, treating as free user");
    hasActiveMembership = false;
  }

  // ─────────────────────────────────────────────
  // Step 2: Count previous human messages for THIS document
  // ─────────────────────────────────────────────
  let messageCount = 0;
  
  try {
    console.log("🔵 [askQuestion] Counting previous messages for fileId:", id);
    
    const history = await db.listDocuments(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      [
        Query.equal("fileId", id),
        Query.equal("role", "human"),
      ]
    );
    
    messageCount = history.total;
    console.log("✅ [askQuestion] Found", messageCount, "previous human messages");
  } catch (error: any) {
    console.error("❌ [askQuestion] Failed to fetch message history", error);
    // Continue anyway - we'll allow the question
    messageCount = 0;
  }

  // ─────────────────────────────────────────────
  // Step 3: Check limits BEFORE creating the message
  // ─────────────────────────────────────────────
  const currentLimit = hasActiveMembership ? PRO_LIMIT : FREE_LIMIT;
  console.log("🔵 [askQuestion] Current limit:", currentLimit);
  console.log("🔵 [askQuestion] Message count:", messageCount);
  
  if (!hasActiveMembership && messageCount >= FREE_LIMIT) {
    console.log("🚫 [askQuestion] FREE user hit limit");
    return {
      success: false,
      message: `You've reached the free limit of ${FREE_LIMIT} questions per document. Upgrade to PRO to ask up to ${PRO_LIMIT} questions!`
    };
  }

  if (hasActiveMembership && messageCount >= PRO_LIMIT) {
    console.log("🚫 [askQuestion] PRO user hit limit");
    return {
      success: false,
      message: `You've reached the PRO limit of ${PRO_LIMIT} questions per document!`,
    };
  }

  console.log("✅ [askQuestion] Limit check passed, proceeding...");

  // ─────────────────────────────────────────────
  // Step 4: Create USER message
  // ─────────────────────────────────────────────
  try {
    console.log("🔵 [askQuestion] Creating user message...");
    await db.createDocument(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      "unique()",
      {
        message: question,
        role: "human",
        fileId: id,
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
    console.log("✅ [askQuestion] Created user message");
  } catch (error: any) {
    console.error("❌ [askQuestion] Failed to create USER message", error);
    return { success: false, message: "Failed to create user message" };
  }

  // ─────────────────────────────────────────────
  // Step 5: Generate AI response
  // ─────────────────────────────────────────────
  let reply: string;
  try {
    console.log("🔵 [askQuestion] Generating AI response...");
    reply = await generateLangchainCompletion(id, question);
    console.log("✅ [askQuestion] AI response generated, length:", reply.length);
  } catch (error: any) {
    console.error("❌ [askQuestion] Failed to generate AI response", error);
    return { success: false, message: "Failed to generate AI response. Please try again." };
  }

  // ─────────────────────────────────────────────
  // Step 6: Create AI message
  // ─────────────────────────────────────────────
  try {
    console.log("🔵 [askQuestion] Creating AI message...");
    await db.createDocument(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      "unique()",
      {
        message: reply,
        role: "ai",
        fileId: id,
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
    console.log("✅ [askQuestion] Created AI message");
  } catch (error: any) {
    console.error("❌ [askQuestion] Failed to create AI message", error);
    return { success: false, message: "Failed to save AI response" };
  }

  console.log("✅ [askQuestion] Question answered successfully");
  return { success: true, message: null };
}