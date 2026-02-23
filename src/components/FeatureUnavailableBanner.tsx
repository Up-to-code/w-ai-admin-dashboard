"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  message: string;
  className?: string;
};

export function FeatureUnavailableBanner({ message, className }: Props) {
  return (
    <div
      className={`rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-300 ${
        className ?? ""
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
