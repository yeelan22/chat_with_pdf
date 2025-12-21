import { getServerClients } from "@/lib/appwriteServer";
import { appwriteConfig } from "@/lib/appwriteConfig";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fileId: string }> }
) {
    try {
        const { userId } = await auth();
        console.log("1. User ID:", userId);
        
        if (!userId) {
            console.log("❌ No user ID");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { fileId } = await params;
        console.log("2. File ID:", fileId);

        const { storage, db } = await getServerClients();
        console.log("3. Got server clients");

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
        console.log("4. Found documents:", docs.documents.length);

        if (docs.documents.length === 0) {
            console.log("❌ No document found for this user");
            return new NextResponse("File not found", { status: 404 });
        }

        const fileName = docs.documents[0].name || `${fileId}.pdf`;
        console.log("5. File name:", fileName);

        // Get file as ArrayBuffer
        console.log("6. Fetching file from storage...");
        console.log("   Bucket ID:", appwriteConfig.bucketID);
        console.log("   File ID:", fileId);
        
        const fileArrayBuffer = await storage.getFileDownload(
            appwriteConfig.bucketID!,
            fileId
        );
        
        console.log("7. Got file, type:", typeof fileArrayBuffer);
        console.log("   Is ArrayBuffer:", fileArrayBuffer instanceof ArrayBuffer);
        console.log("   Byte length:", fileArrayBuffer.byteLength);

        if (!fileArrayBuffer || fileArrayBuffer.byteLength === 0) {
            console.log("❌ File is empty");
            return new NextResponse("File is empty", { status: 404 });
        }

        // Convert ArrayBuffer to Uint8Array
        const uint8Array = new Uint8Array(fileArrayBuffer);
        console.log("8. Converted to Uint8Array, length:", uint8Array.length);

        // Return the file
        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Length': String(uint8Array.length),
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });

    } catch (error: any) {
        console.error("❌ Download error:", error);
        console.error("   Error message:", error.message);
        console.error("   Error code:", error.code);
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}