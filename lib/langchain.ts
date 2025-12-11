import { ChatMistralAI } from "@langchain/mistralai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pipeline } from "@xenova/transformers";
import { Embeddings } from "@langchain/core/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { auth } from "@clerk/nextjs/server";
import pinconeClient from "./pinecone";

import { appwriteConfig } from "./appwriteConfig";
import { getServerClients } from "./appwriteServer";
import { Index, RecordMetadata } from "@pinecone-database/pinecone";

export const indexName = "papafam";

/* -------------------------------------------------------
   Embeddings Class (Xenova)
------------------------------------------------------- */
const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
  { quantized: true }
);

class XenovaEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(
      texts.map(async (text) => {
        const output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        return Array.from(output.data);
      })
    );
  }

  async embedQuery(text: string): Promise<number[]> {
    const output = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }
}

const embeddings = new XenovaEmbeddings();

/* -------------------------------------------------------
   Check if Pinecone namespace exists
------------------------------------------------------- */
async function namespaceExists(
  index: Index<RecordMetadata>,
  namespace: string
) {
  if (!namespace) throw new Error("Missing namespace");
  const { namespaces } = await index.describeIndexStats();
  return namespaces?.[namespace] !== undefined;
}

/* -------------------------------------------------------
   Load + Split PDF into chunks
------------------------------------------------------- */
async function generateDocs(docId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  console.log("✅ User authenticated:", userId);

  console.log("📄 Fetching PDF metadata from Appwrite...");
  const { db, storage } = await getServerClients();

  // 1️⃣ Get document metadata
  const doc = await db.getDocument(
    appwriteConfig.databaseId!,
    appwriteConfig.pdfsCollectionId!,
    docId
  );
  console.log("Document fetched from DB:", doc);

  const { fileId } = doc;
  if (!fileId) throw new Error("No fileId found in document");

  console.log("📥 Fetching PDF content from Appwrite Storage...");
  // 2️⃣ Get file as ArrayBuffer (server-side)
  const fileBuffer = await storage.getFileView(appwriteConfig.bucketID!, fileId);
  console.log("✅ File fetched, size:", fileBuffer.byteLength, "bytes");

  // 3️⃣ Convert ArrayBuffer to Blob for PDFLoader
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  console.log("✅ Converted to Blob, size:", blob.size, "bytes");

  // 4️⃣ Load PDF
  try {
    console.log("📄 Loading PDF into PDFLoader...");
    const loader = new PDFLoader(blob);
    const docs = await loader.load();
    console.log("PDF loaded successfully. Total pages:", docs.length);

    // 5️⃣ Split chunks
    console.log("✂ Splitting PDF text into chunks...");
    const splitter = new RecursiveCharacterTextSplitter();
    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`PDF split into ${splitDocs.length} chunks`);

    return splitDocs;
  } catch (error) {
    console.error("❌ Failed to load PDF:", error);
    throw error; // re-throw for upstream handling
  }
}



/* -------------------------------------------------------
   Main: Generate Embeddings in Pinecone (Safe Version)
------------------------------------------------------- */
export async function generateEmbeddingsInPineconeVectoreStore(docId: string) {
  // 1. Auth
  const { userId } = await auth();
  if (!userId) throw new Error("User not authenticated");
  console.log("User:", userId);

  // 2. Connect to Pinecone
  const index = pinconeClient.Index(indexName);
  const exists = await namespaceExists(index, docId);

  /* ------------------------------------------------------------------
     CASE 1 — Namespace exists → return retriever interface only
     ------------------------------------------------------------------ */
  if (exists) {
    console.log(`✔ Namespace ${docId} already exists — Skipping creation`);

    // This does NOT load documents — it only constructs a retriever wrapper
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: docId,
    });

    // Return only the store (small object)
    return { success: true, exists: true, vectorStore };
  }

  /* ------------------------------------------------------------------
     CASE 2 — Namespace does NOT exist → Load PDF → Split → Embed → Store
     ------------------------------------------------------------------ */
  console.log(`⬇ Namespace ${docId} missing — Generating documents`);
  const splitDocs = await generateDocs(docId);

  console.log(
    `📥 Storing ${splitDocs.length} chunks in Pinecone namespace: ${docId}`
  );

  // PineconeStore.fromDocuments() handles:
  // - embedding each chunk
  // - building vectors
  // - storing them with metadata
  const vectorStore = await PineconeStore.fromDocuments(splitDocs, embeddings, {
    pineconeIndex: index,
    namespace: docId,
  });

  console.log("✔ Embeddings stored successfully.");

  return { success: true, created: true, vectorStore };
}
