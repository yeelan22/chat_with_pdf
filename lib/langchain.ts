import { ChatGroq } from "@langchain/groq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { pipeline } from "@xenova/transformers";
import { Embeddings } from "@langchain/core/embeddings";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createHistoryAwareRetriever } from "@langchain/classic/chains/history_aware_retriever";
import { createStuffDocumentsChain } from "@langchain/classic/chains/combine_documents";
import { createRetrievalChain } from "@langchain/classic/chains/retrieval";
import { PineconeStore } from "@langchain/pinecone";
import { auth } from "@clerk/nextjs/server";
import pinconeClient from "./pinecone";
import { appwriteConfig } from "./appwriteConfig";
import { getServerClients } from "./appwriteServer";
import { Query } from "node-appwrite";
import { Index, RecordMetadata } from "@pinecone-database/pinecone";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

export const indexName = "pdf-chat";

/* -------------------------------------------------------
   Language Model (Mistral AI)
------------------------------------------------------- */
const model = new ChatGroq({
  model: "llama-3.3-70b-versatile", // Free and very capable
  temperature: 0.7,
  maxTokens: 1000,
  apiKey: process.env.GROQ_API_KEY,
});

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
        if(!text || !text.trim()) {
          throw new Error ("Attempted to embed empty text");
        }
        const output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        return Array.from(output.data);
      })
    );
  }

  async embedQuery(text: string): Promise<number[]> {
    if (!text || !text.trim()) {
      throw new Error("❌ Attempted to embed empty query");
    }
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
  try {
    console.log("🔵 Checking if namespace exists...", {
      file: "langchain.ts",
      function: "namespaceExists",
      namespace: namespace
    });
    
    if (!namespace) {
      console.error("❌ Missing namespace parameter", {
        file: "langchain.ts",
        function: "namespaceExists"
      });
      throw new Error("Missing namespace");
    }
    
    const stats = await index.describeIndexStats();
    const exists = stats.namespaces?.[namespace] !== undefined;
    
    console.log(exists ? "✅ Namespace exists" : "❌ Namespace does not exist", {
      file: "langchain.ts",
      function: "namespaceExists",
      namespace: namespace,
      availableNamespaces: Object.keys(stats.namespaces || {})
    });
    
    return exists;
  } catch (error: any) {
    console.error("❌ Failed to check namespace existence", {
      file: "langchain.ts",
      function: "namespaceExists",
      namespace: namespace,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    throw error;
  }
}

/* -------------------------------------------------------
   Load + Split PDF into chunks
------------------------------------------------------- */
async function generateDocs(docId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { db, storage } = await getServerClients();

  // docId is actually a fileId - search by fileId field, not document ID
  const result = await db.listDocuments(
    appwriteConfig.databaseId!,
    appwriteConfig.pdfsCollectionId!,
    [
      Query.equal("fileId", docId),
    ]
  );

  if (!result.documents || result.documents.length === 0) {
    throw new Error(`PDF document with fileId "${docId}" not found`);
  }

  const doc = result.documents[0];
  const { fileId } = doc;
  if (!fileId) throw new Error("No fileId found in document");

  // Get file as ArrayBuffer (server-side)
  const fileBuffer = await storage.getFileView(appwriteConfig.bucketID!, fileId);

  // Convert ArrayBuffer to Blob for PDFLoader
  const blob = new Blob([fileBuffer], { type: "application/pdf" });

  // Load PDF
  const loader = new PDFLoader(blob);
  const docs = await loader.load();

  // Split chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100,
  });
  const splitDocs = await splitter.splitDocuments(docs);
  const cleanDocs = splitDocs.filter(
    (d) => typeof d.pageContent === "string" && d.pageContent.trim().length > 0
  );

  if (!cleanDocs.length) {
    throw new Error("❌ No valid text extracted from PDF");
  }

  console.log("✅ Clean PDF chunks", {
    total: splitDocs.length,
    kept: cleanDocs.length,
  });

  return cleanDocs
}

async function fetchMessagesFromDB(docId: string) {
  console.log("🔵 Starting fetchMessagesFromDB", {
    file: "langchain.ts",
    function: "fetchMessagesFromDB",
    docId: docId
  });

  let userId;
  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) {
      console.error("❌ User not authenticated", {
        file: "langchain.ts",
        function: "fetchMessagesFromDB"
      });
      throw new Error("Unauthorized");
    }
    console.log("✅ User authenticated", {
      file: "langchain.ts",
      userId: userId
    });
  } catch (error: any) {
    console.error("❌ Authentication failed in fetchMessagesFromDB", {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Authentication failed: ${error.message}`);
  }

  let db;
  try {
    console.log("🔵 Getting server clients...", {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      docId: docId
    });
    const clients = await getServerClients();
    db = clients.db;
    console.log("✅ Got server clients");
  } catch (error: any) {
    console.error("❌ Failed to get server clients", {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    throw new Error(`Failed to get server clients: ${error.message}`);
  }

  let messages;
  try {
    console.log("🔵 Fetching chat history from database...", {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      docId: docId,
      userId: userId,
      database: appwriteConfig.chatsDatabaseID,
      collection: appwriteConfig.chatsCollectionId
    });
    
    const result = await db.listDocuments(
      appwriteConfig.chatsDatabaseID!,
      appwriteConfig.chatsCollectionId!,
      [
        Query.equal("fileId", docId),
        Query.orderAsc("$createdAt"),
      ]
    );
    
    messages = result.documents;
    console.log("✅ Successfully fetched messages from database", {
      file: "langchain.ts",
      messageCount: messages.length
    });
  } catch (error: any) {
    console.error("❌ Failed to list documents from database", {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      docId: docId,
      userId: userId,
      database: appwriteConfig.chatsDatabaseID,
      collection: appwriteConfig.chatsCollectionId,
      error: error.message,
      code: error.code,
      type: error.type,
      response: error.response,
      stack: error.stack
    });
    throw new Error(`Failed to fetch messages from database: ${error.message}`);
  }
   
  let chatHistory;
  try {
    console.log("🔵 Converting messages to chat history...", {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      messageCount: messages.length
    });
    
    const validMessages: (HumanMessage | AIMessage)[] = [];
    for (const doc of messages) {
      if (!doc.role || !doc.message) {
        console.warn("⚠️ Message missing role or message field", {
          file: "langchain.ts",
          docId: doc.$id,
          doc: doc
        });
        continue;
      }
      if (doc.role === "human") {
        validMessages.push(new HumanMessage(doc.message));
      } else if (doc.role === "ai") {
        validMessages.push(new AIMessage(doc.message));
      }
    }
    
    chatHistory = validMessages;

    console.log(`✅ Successfully converted ${chatHistory.length} messages to chat history`, {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      originalCount: messages.length,
      convertedCount: chatHistory.length
    });
  } catch (error: any) {
    console.error("❌ Failed to convert messages to chat history", {
      file: "langchain.ts",
      function: "fetchMessagesFromDB",
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to convert messages: ${error.message}`);
  }
  
  return chatHistory;
}
/* -------------------------------------------------------
   Main: Generate Embeddings in Pinecone (Safe Version)
------------------------------------------------------- */
export async function generateEmbeddingsInPineconeVectoreStore(docId: string) {
  console.log("🔵 Starting generateEmbeddingsInPineconeVectoreStore", {
    file: "langchain.ts",
    function: "generateEmbeddingsInPineconeVectoreStore",
    docId: docId
  });

  // 1. Auth
  let userId;
  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) {
      console.error("❌ User not authenticated", {
        file: "langchain.ts",
        function: "generateEmbeddingsInPineconeVectoreStore"
      });
      throw new Error("User not authenticated");
    }
    console.log("✅ User authenticated", {
      file: "langchain.ts",
      userId: userId
    });
  } catch (error: any) {
    console.error("❌ Authentication failed", {
      file: "langchain.ts",
      function: "generateEmbeddingsInPineconeVectoreStore",
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Authentication failed: ${error.message}`);
  }

  // 2. Connect to Pinecone
  let index;
  try {
    console.log("🔵 Connecting to Pinecone index...", {
      file: "langchain.ts",
      indexName: indexName,
      docId: docId
    });
    index = pinconeClient.Index(indexName);
    console.log("✅ Connected to Pinecone index");
  } catch (error: any) {
    console.error("❌ Failed to connect to Pinecone index", {
      file: "langchain.ts",
      indexName: indexName,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    throw new Error(`Failed to connect to Pinecone: ${error.message}`);
  }

  // 3. Check if namespace exists
  let exists;
  try {
    exists = await namespaceExists(index, docId);
  } catch (error: any) {
    console.error("❌ Failed to check namespace existence", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to check namespace: ${error.message}`);
  }

  /* ------------------------------------------------------------------
     CASE 1 — Namespace exists → return retriever interface only
     ------------------------------------------------------------------ */
  if (exists) {
    console.log(`✅ Namespace ${docId} already exists — Skipping creation`, {
      file: "langchain.ts",
      docId: docId
    });

    try {
      // This does NOT load documents — it only constructs a retriever wrapper
      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        namespace: docId,
      });

      console.log("✅ Successfully created vector store from existing index", {
        file: "langchain.ts",
        docId: docId
      });

      // Return only the store (small object)
      return { success: true, exists: true, vectorStore };
    } catch (error: any) {
      console.error("❌ Failed to create vector store from existing index", {
        file: "langchain.ts",
        docId: docId,
        error: error.message,
        code: error.code,
        type: error.type,
        stack: error.stack
      });
      throw new Error(`Failed to create vector store from existing index: ${error.message}`);
    }
  }

  /* ------------------------------------------------------------------
     CASE 2 — Namespace does NOT exist → Load PDF → Split → Embed → Store
     ------------------------------------------------------------------ */
  console.log(`⬇ Namespace ${docId} missing — Generating documents`, {
    file: "langchain.ts",
    docId: docId
  });

  let splitDocs;
  try {
    splitDocs = await generateDocs(docId);
    console.log("✅ Successfully generated documents", {
      file: "langchain.ts",
      docId: docId,
      chunkCount: splitDocs.length
    });
  } catch (error: any) {
    console.error("❌ Failed to generate documents", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    throw new Error(`Failed to generate documents: ${error.message}`);
  }

  console.log(
    `📥 Storing ${splitDocs.length} chunks in Pinecone namespace: ${docId}`,
    {
      file: "langchain.ts",
      docId: docId,
      chunkCount: splitDocs.length
    }
  );

  let vectorStore;
  try {
    // PineconeStore.fromDocuments() handles:
    // - embedding each chunk
    // - building vectors
    // - storing them with metadata
    vectorStore = await PineconeStore.fromDocuments(splitDocs, embeddings, {
      pineconeIndex: index,
      namespace: docId,
    });

    console.log("✅ Embeddings stored successfully", {
      file: "langchain.ts",
      docId: docId,
      chunkCount: splitDocs.length
    });
  } catch (error: any) {
    console.error("❌ Failed to store embeddings in Pinecone", {
      file: "langchain.ts",
      docId: docId,
      chunkCount: splitDocs.length,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    throw new Error(`Failed to store embeddings: ${error.message}`);
  }

  return { success: true, created: true, vectorStore };
}

const generateLangchainCompletion = async (docId: string, question: string) => {
  console.log("🔵 Step 1: Starting generateLangchainCompletion", {
    file: "langchain.ts",
    function: "generateLangchainCompletion",
    docId: docId,
    questionLength: question.length,
  });

  // Step 1: Get Pinecone vector store
  let pineconeVectorStore;
  try {
    console.log("🔵 Step 1.1: Generating/retrieving Pinecone vector store...", {
      file: "langchain.ts",
      docId: docId,
    });
    pineconeVectorStore = await generateEmbeddingsInPineconeVectoreStore(docId);
    if (!pineconeVectorStore || !pineconeVectorStore.vectorStore) {
      console.error("❌ Step 1.1: Pinecone vector store is null or missing vectorStore", {
        file: "langchain.ts",
        docId: docId,
        pineconeVectorStore: pineconeVectorStore,
      });
      throw new Error("Pinecone vector store not found");
    }
    console.log("✅ Step 1.1: Successfully got Pinecone vector store", {
      file: "langchain.ts",
      docId: docId,
      exists: pineconeVectorStore.exists,
      created: pineconeVectorStore.created,
    });
  } catch (error: any) {
    console.error("❌ Step 1.1: Failed to generate/retrieve Pinecone vector store", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });
    throw new Error(`Failed to get Pinecone vector store: ${error.message}`);
  }

  // Step 2: Create retriever
  let retriever;
  try {
    console.log("🔵 Step 1.2: Creating retriever from vector store...", {
      file: "langchain.ts",
      docId: docId,
    });
    retriever = pineconeVectorStore.vectorStore.asRetriever();
    console.log("✅ Step 1.2: Successfully created retriever");
  } catch (error: any) {
    console.error("❌ Step 1.2: Failed to create retriever", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to create retriever: ${error.message}`);
  }

  // Step 3: Fetch chat history
  let chatHistory;
  try {
    console.log("🔵 Step 1.3: Fetching chat history from database...", {
      file: "langchain.ts",
      docId: docId,
    });
    chatHistory = await fetchMessagesFromDB(docId);
    console.log("✅ Step 1.3: Successfully fetched chat history", {
      file: "langchain.ts",
      messageCount: chatHistory.length,
    });
  } catch (error: any) {
    console.error("❌ Step 1.3: Failed to fetch chat history", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });
    throw new Error(`Failed to fetch chat history: ${error.message}`);
  }

  // Step 4-5: REMOVED history-aware retriever (was causing empty query error)
  console.log("ℹ️ Skipping history-aware retriever to avoid empty query errors");

  // Step 6: Define retrieval prompt (with history included directly)
  let answerPrompt;
  try {
    console.log("🔵 Step 1.6: Defining prompt template for answering questions...", {
      file: "langchain.ts",
      docId: docId,
    });
    answerPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful AI assistant. Answer the user's question based on the context from the PDF document.

Context from PDF:
{context}

Use the conversation history below to understand context and references, but base your answer on the PDF content provided above.`,
      ],
      ...chatHistory, // Include history directly in the prompt
      ["user", "{input}"],
    ]);
    console.log("✅ Step 1.6: Successfully defined retrieval prompt");
  } catch (error: any) {
    console.error("❌ Step 1.6: Failed to define retrieval prompt", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to define retrieval prompt: ${error.message}`);
  }

  // Step 7: Create document combining chain
  let combineDocsChain;
  try {
    console.log("🔵 Step 1.7: Creating document combining chain...", {
      file: "langchain.ts",
      docId: docId,
    });
    combineDocsChain = await createStuffDocumentsChain({
      llm: model,
      prompt: answerPrompt,
    });
    console.log("✅ Step 1.7: Successfully created document combining chain");
  } catch (error: any) {
    console.error("❌ Step 1.7: Failed to create document combining chain", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });
    throw new Error(`Failed to create document combining chain: ${error.message}`);
  }

  // Step 8: Create main retrieval chain (using direct retriever)
  let conversationalRetrievalChain;
  try {
    console.log("🔵 Step 1.8: Creating main retrieval chain...", {
      file: "langchain.ts",
      docId: docId,
    });
    conversationalRetrievalChain = await createRetrievalChain({
      retriever: retriever, // ✅ FIXED: Use direct retriever instead of history-aware
      combineDocsChain: combineDocsChain,
    });
    console.log("✅ Step 1.8: Successfully created main retrieval chain");
  } catch (error: any) {
    console.error("❌ Step 1.8: Failed to create main retrieval chain", {
      file: "langchain.ts",
      docId: docId,
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });
    throw new Error(`Failed to create main retrieval chain: ${error.message}`);
  }

  // Step 9: Invoke the chain
  let reply;
  try {
    console.log("🔵 Step 1.9: Invoking retrieval chain with question...", {
      file: "langchain.ts",
      docId: docId,
      question: question.substring(0, 100) + (question.length > 100 ? "..." : ""),
    });
    const sanitizedQuestion = question.trim();
    if (!sanitizedQuestion) {
      throw new Error("Cannot embed an empty question");
    }
    reply = await conversationalRetrievalChain.invoke({
      chat_history: chatHistory,
      input: sanitizedQuestion,
    });
    console.log("✅ Step 1.9: Successfully got reply from chain", {
      file: "langchain.ts",
      answerLength: reply.answer?.length || 0,
    });
  } catch (error: any) {
    console.error("❌ Step 1.9: Failed to invoke retrieval chain", {
      file: "langchain.ts",
      docId: docId,
      question: question.substring(0, 100),
      error: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });
    throw new Error(`Failed to generate AI response: ${error.message}`);
  }

  if (!reply || !reply.answer) {
    console.error("❌ Step 1.9: Reply is missing answer", {
      file: "langchain.ts",
      docId: docId,
      reply: reply,
    });
    throw new Error("AI response is missing answer field");
  }

  console.log("✅ All steps completed successfully in generateLangchainCompletion", {
    file: "langchain.ts",
    docId: docId,
    answerLength: reply.answer.length,
  });

  return reply.answer;
};

export { model, generateLangchainCompletion };