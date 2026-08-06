import { useEffect } from "react";
import { useKommenszlapfAuth } from "@/lib/kommenszlapfAuth";
import { startCloudSync, stopCloudSync } from "@/lib/finance/cloudSync";

/** Keeps Noventrum data in the shared Kommenszlapf cloud while signed in. */
export function CloudSync() {
  const { user } = useKommenszlapfAuth();
  useEffect(() => {
    if (!user) {
      stopCloudSync();
      return;
    }
    startCloudSync(user.id);
    return () => stopCloudSync();
  }, [user]);
  return null;
}
