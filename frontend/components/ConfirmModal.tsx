"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

type ConfirmState = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

/**
 * Hook that replaces native `confirm()` with a themed modal.
 *
 * Usage:
 *   const [modal, ask] = useConfirm();
 *   // later:
 *   if (await ask("Delete this?")) { … }
 *   // render:
 *   return <>{modal}<main>…</main></>
 */
export function useConfirm(): [ReactNode, (msg: string, opts?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean }) => Promise<boolean>] {
  const [state, setState] = useState<ConfirmState | null>(null);

  const ask = useCallback(
    (msg: string, opts?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean }) =>
      new Promise<boolean>((resolve) => {
        setState({ message: msg, ...opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      state?.resolve(ok);
      setState(null);
    },
    [state],
  );

  const modal = state ? (
    <ConfirmModal
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      destructive={state.destructive}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return [modal, ask];
}

function ConfirmModal({
  message,
  confirmLabel = "Ya",
  cancelLabel = "Batal",
  destructive,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 animate-fadeIn"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div
        className="life-card p-6 max-w-sm w-[90%] text-center animate-riseIn"
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
      >
        <p className="text-[15px] text-life-heading font-semibold leading-snug mb-5">
          {message}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-life-body hover:text-life-heading rounded-full border border-life-blue/15 hover:border-life-blue/40 px-4 py-2 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-4 py-2 transition ${
              destructive
                ? "bg-life-neg text-white hover:brightness-110"
                : "btn-life"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
