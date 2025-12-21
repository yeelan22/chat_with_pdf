'use client';
import { PlusCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {useRouter} from "next/navigation";
import  useSubscription from "@/hooks/useSubscription"
import { FrownIcon } from "lucide-react";
function PlaceholderDocument () {

    const { isOverFileLimit } = useSubscription();    const router = useRouter();
    const handleClick = () => {
        //check if user is Free tier and if theyre over the file limit, push
        //to the upgrade page
       if (isOverFileLimit) {
          router.push("/dashboard/upgrade")
       } else {
          router.push('/dashboard/upload');
       }
        
    }

    return (
        <Button
        onClick={handleClick}
        className="flex flex-col items-center w-64 h-80 rounded-xl bg-gray-200 drop-shadow-md text-gray-400"
      >
        {isOverFileLimit ? (
          <FrownIcon className="h-16 w-16" />
        ) : (
          <PlusCircleIcon className="h-16 w-16" />
        )}
  
        <p className="font-semibold">
          {isOverFileLimit ? "Upgrade to add more documents" : "Add a document"}
        </p>
      </Button>
    )
}

export default PlaceholderDocument;