import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";

export function BlogCardShell({ blogId, children, className = "" }) {
  return (
    <Pressable
      href={`/blog-view-2/${blogId}`}
      className={cn("bg-card rounded-2xl p-4 border border-border", className)}
    >
      {children}
    </Pressable>
  );
}
