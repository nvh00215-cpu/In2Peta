"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-heading group-[.toaster]:border-border-gray group-[.toaster]:shadow-card group-[.toaster]:rounded-card-sm",
          description: "group-[.toast]:text-body",
          actionButton:
            "group-[.toast]:bg-terracotta group-[.toast]:text-white group-[.toast]:rounded-pill",
          cancelButton:
            "group-[.toast]:bg-light-gray group-[.toast]:text-body group-[.toast]:rounded-pill",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
