'use server'
import { appwriteConfig } from "@/lib/appwriteConfig";
import { getServerClients } from "@/lib/appwriteServer";
import { indexName } from "@/lib/langchain";
import pineconeClient from "@/lib/pinecone";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Query } from "node-appwrite";

export async function deleteDocument(docId: string) {
    auth.protect();

    const { userId } = await auth();

    if (!userId) {
        throw new Error("Unauthorized");
    }

    const { db, storage } = await getServerClients();

    // Step 1: FIND the document first
    const userDocs = await db.listDocuments(
        appwriteConfig.databaseId!,
        appwriteConfig.pdfsCollectionId!,
        [
            Query.equal("userId", userId),
            Query.equal("fileId", docId),
            Query.limit(1)
        ]
    );

    // Step 2: Check if document exists
    if (userDocs.documents.length === 0) {
        throw new Error("Document not found");
    }

    const document = userDocs.documents[0];

    // Step 3: Delete the document from the database
    await db.deleteDocument(
        appwriteConfig.databaseId!,
        appwriteConfig.pdfsCollectionId!,
        document.$id
    );

    // Step 4: Delete from storage
    try {
        await storage.deleteFile(
            appwriteConfig.bucketID!,
            document.fileId
        );
        console.log("✅ File deleted from storage");
    } catch (err: any) {
        // File might already be deleted
        if (err.code === 404) {
            console.log("⚠️ File not found in storage (already deleted)");
        } else {
            console.error("❌ Error deleting file from storage:", err);
        }
    }

    // Step 5: Delete embeddings from Pinecone
    try {
        const index = pineconeClient.index(indexName);
        
        // First, check if the namespace has any vectors
        const stats = await index.describeIndexStats();
        const namespaceExists = stats.namespaces && stats.namespaces[docId];
        
        if (namespaceExists) {
            await index.namespace(docId).deleteAll();
            console.log("✅ Embeddings deleted from Pinecone");
        } else {
            console.log("⚠️ Namespace not found in Pinecone (no embeddings to delete)");
        }
    } catch (err: any) {
        // Handle specific Pinecone errors
        if (err.name === 'PineconeNotFoundError' || err.message?.includes('404')) {
            console.log("⚠️ Pinecone namespace not found (already deleted or never created)");
        } else {
            console.error("❌ Error deleting from Pinecone:", err);
            // Don't throw - document is already deleted from DB
        }
    }

    // Step 6: Revalidate the dashboard
    revalidatePath("/dashboard");
    
    return { success: true, message: "Document deleted successfully" };
}