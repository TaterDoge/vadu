import { Collapsible as CollapsiblePrimitive } from "@animate-ui/react/primitives/base-ui/collapsible";
import { cn } from "cn";

const { Root } = CollapsiblePrimitive;

function Trigger({
  className,
  children,
  ...props
}: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        "-mx-1 flex w-full select-none items-center gap-1.5 rounded-lg px-1 py-1 text-left font-medium text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-50 data-panel-open:text-foreground",
        className
      )}
      data-slot="collapsible-trigger"
      {...props}
    >
      {children}
    </CollapsiblePrimitive.Trigger>
  );
}

function Panel({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      className={cn("flex flex-col gap-4", className)}
      data-slot="collapsible-panel"
      {...props}
    />
  );
}

export { Panel, Root, Trigger };
