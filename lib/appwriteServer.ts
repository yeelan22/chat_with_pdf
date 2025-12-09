import { appwriteConfig } from "./appwriteConfig";
import { Client, Databases, Storage} from "node-appwrite";

// MUST be async because it's inside a "use server" dependency chain
export async function getServerClients() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint!)
    .setProject(appwriteConfig.projectId!)
    .setKey(appwriteConfig.adminKey!); // Admin Key

  const db = new Databases(client);
  const storage = new Storage(client);

  return { db, storage };
}
