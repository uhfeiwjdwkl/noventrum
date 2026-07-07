import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <Card className={cn("p-10 flex flex-col items-center text-center gap-3", className)}>
      {icon && (
        <div className="h-12 w-12 rounded-full bg-muted grid place-items-center text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="font-semibold text-lg">{title}</div>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </Card>
  );
}
