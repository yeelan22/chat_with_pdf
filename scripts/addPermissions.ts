// scripts/addPermissions.ts
import { databases } from "@/lib/appwriteClient";
import { Permission, Role, Query } from "appwrite";
import { appwriteConfig } from "@/lib/appwriteConfig";

async function addPermissionsToExistingDocuments() {
  try {
    // Get all messages
    const response = await databases.listDocuments(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      [Query.limit(100)] // Adjust limit as needed
    );

    console.log(`Found ${response.documents.length} documents`);

    // Update each document with proper permissions
    for (const doc of response.documents) {
      await databases.updateDocument(
        appwriteConfig.chatsDatabaseID!,
        appwriteConfig.chatsCollectionId!,
        doc.$id,
        {}, // No data changes
        [
          Permission.read(Role.user(doc.userId)),
          Permission.update(Role.user(doc.userId)),
          Permission.delete(Role.user(doc.userId)),
        ]
      );
      console.log(`Updated permissions for document ${doc.$id}`);
    }

    console.log("✅ All documents updated!");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run it
addPermissionsToExistingDocuments();