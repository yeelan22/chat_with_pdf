"use server";
import { Permission, Role } from "node-appwrite";
import { getServerClients } from "@/lib/appwriteServer";
import { FileMetadataSchema } from "@/schemas/fileSchema";
import { ID } from "node-appwrite";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { auth } from "@clerk/nextjs/server";
export async function saveFileMetadata(metadata: any) {
  const { db } = await getServerClients();
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }
  const validated = FileMetadataSchema.parse(metadata);

  return await db.createDocument(
    appwriteConfig.databaseId!,
    appwriteConfig.pdfsCollectionId!,
    ID.unique(),
    validated,
    [ Permission.read(Role.user(userId)) ]
  );
}
