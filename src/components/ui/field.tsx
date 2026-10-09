import * as React from "react"
import { cn } from "@/lib/utils"

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("flex w-full flex-col gap-5", className)} {...props} />
}

function Field({ className, orientation = "vertical", ...props }: React.ComponentProps<"div"> & { orientation?: "vertical" | "horizontal" }) {
  return <div role="group" data-slot="field" data-orientation={orientation} className={cn("flex w-full gap-2", orientation === "horizontal" ? "flex-row items-start" : "flex-col", className)} {...props} />
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="field-label" className={cn("text-sm font-medium leading-snug", className)} {...props} />
}

export { FieldGroup, Field, FieldLabel }
