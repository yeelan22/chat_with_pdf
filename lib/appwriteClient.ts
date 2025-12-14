import { Client, Account, Databases } from 'appwrite';
import { appwriteConfig } from './appwriteConfig';

export const client = new Client()
    .setEndpoint(appwriteConfig.endpoint!)
    .setProject(appwriteConfig.projectId!);

export const account = new Account(client);
export const databases = new Databases(client);

