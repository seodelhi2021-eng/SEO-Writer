interface Props {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: Props) {
  return (
    <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-4 py-3 text-sm flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="font-medium mb-1">Error</div>
        <div>{message}</div>
      </div>
      <div className="flex gap-2 shrink-0">
        {onRetry && (
          <button onClick={onRetry} className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700">
            Retry
          </button>
        )}
        <button onClick={onDismiss} className="px-3 py-1 rounded border border-red-300 text-xs hover:bg-red-100">
          Dismiss
        </button>
      </div>
    </div>
  );
}
