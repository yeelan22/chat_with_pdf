export const appwriteConfig = {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, 
    bucketID: process.env.NEXT_PUBLIC_APPWRITE_STORAGE_ID,
    adminKey: process.env.APPWRITE_API_KEY,
    pdfsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_ID,
    chatsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_CHATS_COLLECTION_ID,
    usersCollectionId: process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID,
    chatsDatabaseID: process.env.NEXT_PUBLIC_APPWRITE_CHATS_DATABASE_ID,
}