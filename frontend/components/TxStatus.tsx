'use client';

import type { TxState } from '@/hooks/useTransaction';

const MESSAGES: Record<string, string> = {
  signing: 'Waiting for signature...',
  pending: 'Transaction pending...',
  confirmed: 'Transaction confirmed!',
};

export function TxStatus({ state, onDismiss }: { state: TxState; onDismiss: () => void }) {
  if (state.status === 'idle') return null;

  const isError = state.status === 'error';
  const isConfirmed = state.status === 'confirmed';

  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm
      ${isError ? 'bg-red-50 border border-red-200 text-red-800' :
        isConfirmed ? 'bg-green-50 border border-green-200 text-green-800' :
        'bg-blue-50 border border-blue-200 text-blue-800'}`}>
      {(state.status === 'signing' || state.status === 'pending') && (
        <svg className="animate-spin h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      )}
      <span className="flex-1">
        {isError ? state.error : MESSAGES[state.status]}
        {state.hash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${state.hash}`}
            target="_blank"
            rel="noreferrer"
            className="ml-2 underline opacity-75"
          >
            View
          </a>
        )}
      </span>
      {(isError || isConfirmed) && (
        <button onClick={onDismiss} className="text-current opacity-50 hover:opacity-100">✕</button>
      )}
    </div>
  );
}
