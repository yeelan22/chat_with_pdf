'use server'
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
export async function generateEmbeddings(docId: string) {
    //1-protect this route with clerck
   const { userId } = await auth();
   if (!userId) throw new Error("Not authenticated");
   //2-turn a pdf into embeddings
   await generateEmbeddingsInPineconeVectoreStore(docId);
    //3-idk anyway. this line is essentiel
   revalidatePath("/dashboard");
   return { completed: true };
}