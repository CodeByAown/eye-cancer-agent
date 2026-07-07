"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type Side = "left" | "right";

const sideClasses: Record<Side, string> = {
  left: "left-0 top-0 h-full w-72 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  right:
    "right-0 top-0 h-full w-72 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
};

export const SheetContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: Side }
>(({ className, children, side = "left", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "bg-surface/95 border-border fixed z-50 shadow-2xl backdrop-blur-xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        sideClasses[side],
        side === "left" ? "border-r" : "border-l",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Close"
        className="text-muted-foreground hover:text-foreground absolute right-4 top-4 transition-colors"
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

/** Radix requires an accessible title; use this visually-hidden one when needed. */
export const SheetTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("sr-only", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";
