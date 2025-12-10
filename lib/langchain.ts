import { ChatMistralAI } from "@langchain/mistralai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {recursiveCharacterTextSplitter} from "langchain/text_splitter";
import { pipeline } from "@xenova/transformers";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents"
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/histpry_aware_retriever";
import { HumanMessage, AIMessage } from "@langchain/core/messages"
import { Embeddings } from "@langchain/core/embeddings";
import pinconeClient from "./pinecone"
import { PineconeStore } from "@langchain/pinecone";
import { PineconeConflictError } from "@pinecone-database/pinecone/dist/errors";
import { Index, RecordMetadata } from "@pinecone-database/pinecone"
import { auth } from "@clerk/nextjs/server";
//import admin from appwrite
import { appwriteConfig } from "./appwriteConfig";
import { getServerClients } from "./appwriteServerClients";

//Initialize the Mistral AI model
const model = new ChatMistralAI({
    apiKey: process.env.MISTRALAI_API_KEY,
    modelName: "mistral-7b-instruct-v0.1",
});
//Initialize the Xenova pipeline for embeddings
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
        const embeddings = await Promise.all(
            texts.map(async (text) => {
                const output = await extractor(text, {
                    pooling: "mean",
                    normalize: true,
                });
                return Array.from(output.data) as number[];
            })
        );
        return embeddings;
    }

    async embedQuery(text: string): Promise<number[]> {
        const output = await extractor(text, {
            pooling: "mean",
            normalize: true,
        });
        return Array.from(output.data) as number[];
    }
}

const embeddings = new XenovaEmbeddings();

export const indexName = "papafam";

async function nameSpaceExists(index: Index<RecordMetadata>, namespace: string) {
    if (namespace === null) throw new Error("no namespace value provided");
    //index.describeIndexStats() returns metadata about the index, including all namespaces.
    const { namespaces } = await index.describeIndexStats();
    return namespaces?.[namespace] !== undefined;

}
async function generateDocs(docId: string) {
    //verify user auth state
    const { userId } = await auth();
    if (!userId) throw new Error("User Not Found");
    console.log("fetching the download URL from appwrite");

    //fetch pdf download URL from appwrite
    const { db } = await getServerClients();

    const { downloadUrl } = await db.getDocument(
        appwriteConfig.databaseId!,
        appwriteConfig.pdfsCollectionId!,
        docId
    )
    
  if (!downloadUrl) throw new Error("downloadUrl not found");
  console.log("Download URL:", downloadUrl);
    
    //Load the PDF document into a PDFDocument object
    const response = await fetch(downloadUrl);
    const data = await response.blob();

   //Load the PDF document the specified path
   console.log("___ Loading PDF document ...___");
   const loader = new PDFLoader(data);
   const docs = await loader.load();

   //Split the document into smaller chunks
   console.log("___ Splitting document into smaller chunks ...___");
   const splitter = new recursiveCharacterTextSplitter();
   const splitDocs = await splitter.splitDocuments(docs);
   console.log(`Split into ${splitDocs.length} chunks.`);
   return splitDocs;
}

export async function generateEmbeddingsInPineconeVectoreStore(docId: string) {
    //1-get the user auth state
    const { userId } = await auth();
    if (!userId) throw new Error("User Not Found");
    console.log("User ID:", userId);

    //2-Generate Embeddings ( numerical representations) for the split doocuments
    let pinconeVectoreStore;
   

    // console.log("___ Generating embeddings for the split documents ...___");
    // const embeddings = new Pipeline("Xenova/embeddings-all-mpnet-base-v2", "text", {
    //     quantized: true,
    // }); 

    //3-Connect to Pinecone
    const index = await pinconeClient.Index(indexName);
    //this is useful because we want to generate embeddings only once
    const namespaceAlreadyExists = await nameSpaceExists(index, docId);

    if (namespaceAlreadyExists) {
        //return a retrieval interface for your RAG chain.
        console.log(`Namespace ${docId} already exists. Skipping embedding generation.`);
        
        pinconeVectoreStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            namespace: docId,
        });

        return pinconeVectoreStore;
    } else {
            // If the namespace does not exist, download the PDF from firestore via the stored Download URL & generate the embeddings and store them in the Pinecone vector store
             const splitDocs = await generateDocs(docId);
             console.log(
                `--- Storing the embeddings in namespace ${docId} in the ${indexName} Pinecone vector store... ---`
              );
              const vectors = [];
              for(const doc of splitDocs) {
                const values = await embeddings.embedQuery(doc.pageContent);
                console.log("pageContent:", doc.pageContent);
                vectors.push({
                    id: crypto.randomUUID(),
                    values,
                    metadata: {text: doc.pageContent, ...doc.metadata},
                })
                await index.namespace(docId).upsert(vectors);
              }

    }
}