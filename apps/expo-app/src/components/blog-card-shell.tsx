import { cn } from "@/lib/utils";
import { PressableLink } from "./pressable-link";

export function BlogCardShell({ blogId, children, className = "" }) {
  return (
    <PressableLink
      href={`/blog-view-2/${blogId}`}
      className={cn("bg-card rounded-2xl p-4 border border-border", className)}
    >
      {children}
    </PressableLink>
  );
}
