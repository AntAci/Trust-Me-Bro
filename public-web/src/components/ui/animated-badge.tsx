import { useEffect, useState } from "react";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AnimatedBadgeProps extends BadgeProps {
  pulse?: boolean;
  children: React.ReactNode;
}

export function AnimatedBadge({ 
  pulse = false, 
  children, 
  className,
  ...props 
}: AnimatedBadgeProps) {
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (pulse) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 200);
      return () => clearTimeout(timer);
    }
  }, [pulse, children]);

  return (
    <Badge 
      className={cn(
        "transition-all",
        isPulsing && "animate-pulse-once",
        className
      )} 
      {...props}
    >
      {children}
    </Badge>
  );
}
