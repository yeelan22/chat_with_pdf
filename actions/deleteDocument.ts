'use server'
import { appwriteConfig } from "@/lib/appwriteConfig";
import { getServerClients } from "@/lib/appwriteServer";
import { indexName } from "@/lib/langchain";
import pineconeClient from "@/lib/pinecone";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function deleteDocument(docId: string) {
    auth.protect();

    const { userId } = await auth();

    // Delete the document from the database
    const { db, storage } = await getServerClients();
    await db.deleteDocument(
        appwriteConfig.databaseId!,
        appwriteConfig.pdfsCollectionId!,
        userId!,
    )

    // Delete from the storage
    await storage.deleteFile(
        appwriteConfig.bucketID!,
        docId
    )

    //Delete all embeddings associated with the document

    const index = await pineconeClient.index(indexName);
    await index.namespace(docId).deleteAll();

    //revalidate the dashboard to insure the docs are up to date
    revalidatePath("/dashboard");
}