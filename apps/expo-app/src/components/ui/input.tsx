import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Platform, TextInput } from "react-native";

const Input = forwardRef<
  TextInput,
  React.ComponentPropsWithoutRef<typeof TextInput>
>(function Input({ className, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      className={cn(
        "border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9 dark:bg-input/30",
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({
              web: "disabled:pointer-events-none disabled:cursor-not-allowed",
            }),
          ),
        Platform.select({
          web: cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          ),
          native: "placeholder:text-muted-foreground/50",
        }),
        className,
      )}
      {...props}
    />
  );
});

export { Input };
