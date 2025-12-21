'use server';

import { auth } from "@clerk/nextjs/server";
import { Permission, Query, Role } from "node-appwrite";
import { getServerClients } from "@/lib/appwriteServer";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { generateLangchainCompletion } from "@/lib/langchain";

const FREE_LIMIT = 2;
const PRO_LIMIT = 20;
export async function askQuestion(
  id: string,
  question: string
): Promise<{ success: boolean; message: string | null }> {

  auth.protect();
  const { userId } = await auth();

  if (!userId) {
    return { success: false, message: "User not authenticated" };
  }

  let db;
  try {
    const clients = await getServerClients();
    db = clients.db;
  } catch (error: any) {
    console.error("❌ Failed to get Appwrite client", error);
    return { success: false, message: "Failed to get Appwrite client" };
  }

  // ─────────────────────────────────────────────
  // Step 1: List previous human messages (FIXED - removed userId query)
  // ─────────────────────────────────────────────
  try {
    const history = await db.listDocuments(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      [
        Query.equal("fileId", id),
        Query.equal("role", "human"),
        Query.orderDesc("$createdAt"),
      ]
    );
    //check membership limits for messages in a document
    const userRef = await db.getDocument(
      appwriteConfig.databaseId!,
      appwriteConfig.usersCollectionId!,
      userId
    )
    //limit the PRO/FREE users
    if(!userRef?.hasActiveMembership){
      if(history.total >= FREE_LIMIT) {
        return {
          success: false,
          message: `You'll need to upgrade to PRO to ask more than ${FREE_LIMIT} questions!`
        }
      }
    }
    if (userRef?.hasActiveMembership) {
      console.log("Debug 4", history.total, PRO_LIMIT);
      if (history.total >= PRO_LIMIT) {
        return {
          success: false,
          message: `You've reached the PRO limit of ${PRO_LIMIT} questions per document! 😢`,
        };
      }
    }
    console.log(`✅ Found ${history.documents.length} previous messages`);
  } catch (error: any) {
    console.error("❌ Failed to fetch message history", error);
    // Continue anyway - history is optional
  }

  // ─────────────────────────────────────────────
  // Step 2: Create USER message (FIXED - removed userId)
  // ─────────────────────────────────────────────
  try {
    await db.createDocument(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      "unique()",
      {
        message: question,
        role: "human",
        fileId: id,
        $createdAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
    console.log("✅ Created user message");
  } catch (error: any) {
    console.error("❌ Failed to create USER message", error);
    return { success: false, message: "Failed to create user message" };
  }

  // ─────────────────────────────────────────────
  // Step 3: Generate AI response
  // ─────────────────────────────────────────────
  let reply: string;
  try {
    console.log("🔵 Generating AI response...");
    reply = await generateLangchainCompletion(id, question);
    console.log("✅ AI response generated");
  } catch (error: any) {
    console.error("❌ Failed to generate AI response", error);
    return { success: false, message: "Failed to generate AI response" };
  }

  // ─────────────────────────────────────────────
  // Step 4: Create AI message (FIXED - removed userId)
  // ─────────────────────────────────────────────
  try {
    await db.createDocument(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      "unique()",
      {
        message: reply,
        role: "ai",
        fileId: id,
        $createdAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
    console.log("✅ Created AI message");
  } catch (error: any) {
    console.error("❌ Failed to create AI message", error);
    return { success: false, message: "Failed to create AI message" };
  }

  return { success: true, message: null };
}

//user message dupication problem, fix state management.