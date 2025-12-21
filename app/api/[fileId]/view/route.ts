// app/api/files/[fileId]/view/route.ts
import { getServerClients } from "@/lib/appwriteServer";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";

export async function GET(
    request: NextRequest,
    { params }: { params: { fileId: string } }
) {
    try {
        const { userId } = await auth();
        
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { fileId } = params;
        const { storage, db } = await getServerClients();

        // Verify user owns this file
        const docs = await db.listDocuments(
            appwriteConfig.databaseId!,
            appwriteConfig.pdfsCollectionId!,
            [
                Query.equal("fileId", fileId),
                Query.equal("userId", userId),
                Query.limit(1)
            ]
        );

        if (docs.documents.length === 0) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // getFileView returns ArrayBuffer
        const fileBuffer = await storage.getFileView(
            appwriteConfig.bucketID!,
            fileId
        );

        // Convert ArrayBuffer to Buffer for NextResponse
        const buffer = Buffer.from(fileBuffer);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${docs.documents[0].name || fileId}.pdf"`,
            },
        });
    } catch (error) {
        console.error("File view error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}