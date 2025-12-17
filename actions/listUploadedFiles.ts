'use server';

import { getServerClients } from "@/lib/appwriteServer";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { Query } from "node-appwrite";

export async function getUserDocuments(userId: string) {
  try {
    console.log("🔵 Fetching documents for user:", userId);
    
    const { storage, db } = await getServerClients();
    
    // Step 1: Get file records from database (filtered by userId)
    const fileRecords = await db.listDocuments(
      appwriteConfig.databaseId!,
      appwriteConfig.pdfsCollectionId!, // Your files/PDFs collection
      [
        Query.equal("userId", userId), // Filter by user
        Query.limit(50),
        Query.orderDesc("$createdAt"),
      ]
    );

    console.log(`✅ Found ${fileRecords.documents.length} file records for user`);

    // Step 2: Get actual file details from storage for each record
    const documents = await Promise.all(
      fileRecords.documents.map(async (record) => {
        try {
          // Get file metadata from storage
          const file = await storage.getFile(
            appwriteConfig.bucketID!,
            record.fileId
          );

          return {
            $id: record.$id, // Database document ID
            fileId: record.fileId, // Storage file ID
            name: record.name || file.name,
            fileName: file.name,
            sizeOriginal: file.sizeOriginal,
            mimeType: file.mimeType,
            $createdAt: record.$createdAt,
            $updatedAt: record.$updatedAt,
            userId: record.userId,
            downloadUrl: `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${appwriteConfig.bucketID}/files/${record.fileId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`,
          };
        } catch (error: any) {
          console.warn(`⚠️ File ${record.fileId} not found in storage, skipping`);
          return null;
        }
      })
    );

    // Filter out any null values (deleted files)
    const validDocuments = documents.filter((doc) => doc !== null);

    console.log(`✅ Returning ${validDocuments.length} valid documents`);
    return validDocuments;

  } catch (error: any) {
    console.error("❌ Error fetching user documents:", {
      error: error.message,
      code: error.code,
      type: error.type,
    });
    return [];
  }
}