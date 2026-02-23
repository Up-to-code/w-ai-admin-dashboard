"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Catches render errors in products tab (e.g. React #310) and shows a fallback instead of crashing the app. */
export class ProductsTabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ProductsTabErrorBoundary]", error.message, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6" dir="rtl">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-bold mb-2">حدث خطأ</h2>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm">
            تعذر تحميل المنتجات. حاول التحديث أو عد لاحقاً.
          </p>
          <Button variant="outline" onClick={this.reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
