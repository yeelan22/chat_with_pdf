import { getServerClients } from "@/lib/appwriteServer";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { Query } from "node-appwrite";

const PRO_LIMIT = 20;
const FREE_LIMIT = 2;

export async function GET() {
    try {
        //check user authentication
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    
        //fetch user document
        const { db } = await getServerClients();
        let hasActiveMembership = false;
        try {
            const userDoc = await db.getDocument(
                appwriteConfig.databaseId!,
                appwriteConfig.usersCollectionId!,
                userId
            )
            hasActiveMembership = userDoc?.hasActiveMembership ?? false;
        } catch (error: any) {
            //User Document might not exist yet
            if(error.code !== 404) throw error;
        } 

        //fetch files count
        const files = await db.listDocuments(
            appwriteConfig.databaseId!,
            appwriteConfig.pdfsCollectionId!,
            [
                //filter by user
                Query.equal("userId", userId),
            ]
        );

        const fileCount = files.total;
        const userLimit = hasActiveMembership ? PRO_LIMIT : FREE_LIMIT;
        const isOverFileLimit = fileCount >= userLimit;

        return NextResponse.json({
            hasActiveMembership,
            isOverFileLimit,
            fileCount,
            userLimit
        });
    } catch (error) {
       console.log("Error in subscription route:", error);
       return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}