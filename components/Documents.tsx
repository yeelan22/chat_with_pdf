
import PlaceholderDocument from "./PlaceholderDocument";
import { auth } from "@clerk/nextjs/server";
import Document from "./Document";
import { getUserDocuments } from "@/actions/listUploadedFiles";

async function Documents() {
    auth.protect();

    const { userId } = await auth();

    if (!userId) {
        throw new Error("User not found");
    }

    const documents = await getUserDocuments(userId);

    return (
        <div className="flex flex-wrap p-5 bg-gray-100 justify-center lg:justify-start rounded-sm gap-5 max-w-7xl mx-auto">
            {documents.length === 0 ? (
                <div className="text-gray-500 text-center w-full py-10">
                    <p>No documents uploaded yet</p>
                </div>
            ) : (
                documents.map((doc) => (
                    <Document
                        key={doc.$id}
                        fileId={doc.fileId}
                        name={doc.name || doc.$id}
                        size={doc.sizeOriginal}
                        // No downloadUrl prop needed - component uses API route
                    />
                ))
            )}
            <PlaceholderDocument />
        </div>
    );
}

export default Documents;