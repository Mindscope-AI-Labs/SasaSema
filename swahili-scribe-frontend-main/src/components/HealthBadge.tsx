import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const HealthBadge = () => {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let active = true;
    getHealth()
      .then(() => active && setStatus("ok"))
      .catch(() => active && setStatus("down"));
    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking API
      </Badge>
    );
  }
  if (status === "ok") {
    return <Badge className="bg-primary text-primary-foreground">API Live</Badge>;
  }
  return <Badge variant="destructive">API Down</Badge>;
};

export default HealthBadge;
