import PlaceholderDocument from "./PlaceholderDocument";
import { auth } from "@clerk/nextjs/server";
import Document from "./Document";
import { getUserDocuments } from "@/actions/listUploadedFiles";

// Define the document type based on what getUserDocuments returns
interface DocumentData {
  $id: string;
  name?: string;
  fileName?: string; // Sometimes Appwrite uses fileName instead of name
  sizeOriginal: number;
  downloadUrl?: string;
  [key: string]: any; // Allow other properties
}

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
        documents.map((doc) => {
          // Determine the display name
          const displayName = doc.name || doc.$id;
          
          return (
            <Document
              key={doc.$id}
              id={doc.$id}
              name={displayName}
              size={doc.sizeOriginal}
              downloadUrl={ ""}
            />
          );
        })
      )}
      <PlaceholderDocument />
    </div>
  );
}

export default Documents;