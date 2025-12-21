// actions/getUrlFromAppwrite.ts
'use server'

import { appwriteConfig } from "@/lib/appwriteConfig";
import { getServerClients } from "@/lib/appwriteServer";

export async function getUrlFromAppwrite(fileId: string){
    const { storage } = await getServerClients();

    // getFileView returns a URL string (not a promise)
    const url = storage.getFileView(
        appwriteConfig.bucketID!,
        fileId
    );

    return url;
}