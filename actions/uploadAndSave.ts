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
 
  // 5️⃣ Prepare metadata
  const metadata = {
    userId,
    fileId,
    name: file.name,
    type: file.type,
    size: file.size,
    storagePath: `pdfs/${userId}/${fileId}`,  // or any path you want
    downloadUrl: storage.getFileView(appwriteConfig.bucketID!, fileId),
  };
  

  // 6️⃣ Validate metadata
  const validated = FileMetadataSchema.parse(metadata);

  // 7️⃣ Save metadata to DB with same permissions
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

  return {
    success:true,
    uploaded,
    metadata: savedDoc,
    fileId: metadata.fileId,
  };
}
