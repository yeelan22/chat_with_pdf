"use server";

import { getServerClients } from "@/lib/appwriteServer";
import { FileMetadataSchema } from "@/schemas/fileSchema";
import { ID, Permission, Role } from "node-appwrite";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { auth } from "@clerk/nextjs/server";

export async function uploadFile(file: File) {

  // 1️⃣ Get current Clerk user
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  // 2️⃣ Get Appwrite admin clients
  const { db, storage } = await getServerClients();

  // 3️⃣ Generate unique file ID
  const fileId = ID.unique();
//   const filePath = `pdfs/${userId}/${fileId}`;

  // 4️⃣ Upload file to Appwrite Storage
  try {
    console.log("🔵 Attempting operation:", {
      operation: "createFile",
      file: "uploadAndSave.ts",
      bucketId: appwriteConfig.bucketID,
      fileId: fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: userId,
      permissions: [`read(user:${userId})`, `update(user:${userId})`, `delete(user:${userId})`]
    });

    const uploaded = await storage.createFile(
      appwriteConfig.bucketID!,
      fileId,
      file,
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );

    console.log("✅ Success - createFile:", {
      operation: "createFile",
      file: "uploadAndSave.ts",
      fileId: uploaded.$id,
      bucketId: uploaded.bucketId
    });
 
    // 5️⃣ Prepare metadata
    const downloadUrl = `${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.bucketID}/files/${fileId}/view?project=${appwriteConfig.projectId}`;
    const metadata = {
      userId,
      fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      storagePath: `pdfs/${userId}/${fileId}`,  // or any path you want
      downloadUrl,
    };
    

    // 6️⃣ Validate metadata
    const validated = FileMetadataSchema.parse(metadata);

    // 7️⃣ Save metadata to DB with same permissions
    console.log("🔵 Attempting operation:", {
      operation: "createDocument",
      file: "uploadAndSave.ts",
      documentType: "fileMetadata",
      database: appwriteConfig.databaseId,
      collection: appwriteConfig.pdfsCollectionId,
      userId: userId,
      fileId: fileId,
      permissions: [`read(user:${userId})`, `update(user:${userId})`, `delete(user:${userId})`]
    });

    const savedDoc = await db.createDocument(
      appwriteConfig.databaseId!,
      appwriteConfig.pdfsCollectionId!,
      ID.unique(),
      validated,
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );

    console.log("✅ Success - createDocument (fileMetadata):", {
      operation: "createDocument",
      file: "uploadAndSave.ts",
      documentType: "fileMetadata",
      documentId: savedDoc.$id
    });

    return {
      success:true,
      uploaded,
      metadata: savedDoc,
      fileId: metadata.fileId,
    };
  } catch (error: any) {
    console.error("❌ Failed - Appwrite operation error:", {
      file: "uploadAndSave.ts",
      message: error.message,
      code: error.code,
      type: error.type,
      response: error.response,
      stack: error.stack,
      userId: userId,
      fileId: fileId
    });
    throw error;
  }
}
