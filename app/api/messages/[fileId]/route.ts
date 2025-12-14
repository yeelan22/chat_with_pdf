import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { auth } from "@clerk/nextjs/server";
import { getServerClients } from "@/lib/appwriteServer";
import { appwriteConfig } from "@/lib/appwriteConfig";


export async function GET (
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  console.log("fileId param received:", await context.params);
  try {
    // Authenticate the user
    const { userId } = await auth();
    console.log("🔐 Authenticated userId:", userId);
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", messages: [] },
        { status: 401 }
      );
      console.log("❌ Unauthorized access attempt to fetch messages");
    }

    const { fileId } = await context.params;

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required", messages: [] },
        { status: 400 }
      );
    }

    console.log("🔵 Fetching messages for fileId:", fileId);

    const { db } = await getServerClients();
    const databases = db;
    console.log("🗄️ Appwrite DB client initialized");

    // Fetch messages from Appwrite using server-side API key
    // Note: Removed userId query since it's not in schema
    const response = await databases.listDocuments(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      [
        Query.equal("fileId", fileId),
        Query.orderAsc("$createdAt"),
        Query.limit(100),
      ]
    );

    console.log(`✅ Fetched ${response.documents.length} messages`);

    // Transform documents to messages
    const messages = response.documents.map((doc) => ({
      id: doc.$id,
      role: doc.role,
      message: doc.message,
      createdAt: doc.createdAt || doc.$createdAt,
    }));

    return NextResponse.json({ 
      success: true,
      messages 
    });
  } catch (error: any) {
    console.error("❌ Error fetching messages:", {
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });

    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to fetch messages",
        messages: [] 
      },
      { status: 500 }
    );
  }
}