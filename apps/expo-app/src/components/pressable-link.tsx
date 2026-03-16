import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";
import { LinkProps } from "expo-router";

interface Props {
  href: LinkProps["href"];
  children?;
  className?;
}
export function PressableLink({ children, className, href }: Props) {
  return (
    <Pressable className={cn(className)} href={href}>
      {children}
    </Pressable>
  );
}
