import PdfView from "@/components/PdfView";
import { auth } from "@clerk/nextjs/server";
import { getServerClients } from "@/lib/appwriteServer"
import { appwriteConfig } from "@/lib/appwriteConfig";
import Chat from "@/components/Chat";
import { Query } from "node-appwrite";
// import 'react-pdf/dist/esm/Page/TextLayer.css';
// import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

async function ChatToFilePage({params}: {params: Promise<{id: string}>}) {
    auth.protect();
    const { userId } = await auth();
    
     // Await params before accessing id
    const { id } = await params;
    
    // Now you can use id
    console.log(id);

    const { db, storage } = await getServerClients();
    const url = await storage.getFileView(appwriteConfig.bucketID!, id);
    console.log("File URL:", url);
    
    return <div className="grid lg:grid-cols-5 h-full overflow-hidden">
        <div className="col-span-5 lg:col-span-2 overflow-y-auto">
            {/* chat */}
            <Chat id={id} />
         </div>
        <div className="col-span-5 lg:col-span-3 bg-gray-100 border-r-2 lg:border-indigo-600 lg:-order-1 overflow-auto">
            {/* file preview */}
            <PdfView url={url}/>
        </div>
    </div>;
}

export default ChatToFilePage;