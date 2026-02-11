import { CheckCircle, XCircle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl border ${
      type === 'success' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      )}
      <p className={`font-medium ${type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
        {message}
      </p>
      <button
        onClick={onClose}
        className="ml-4 p-1 hover:bg-muted rounded transition-colors cursor-pointer text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
