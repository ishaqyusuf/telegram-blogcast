import { zodResolver } from "@hookform/resolvers/zod";
import {
  type FieldValues,
  type UseFormProps,
  useForm,
  type Resolver,
} from "react-hook-form";
import type { z } from "zod";

export const useZodForm = <T extends z.ZodTypeAny>(
  schema: T,
  options?: Omit<UseFormProps<z.infer<T> & FieldValues>, "resolver">
) => {
  return useForm<z.infer<T> & FieldValues>({
    resolver: zodResolver(schema as any) as Resolver<
      z.infer<T> & FieldValues,
      any,
      z.infer<T> & FieldValues
    >,
    ...options,
  });
};
