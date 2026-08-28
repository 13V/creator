"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal, on the native `<dialog>` element.
 *
 * `showModal()` brings a focus trap, Esc-to-close, inertness for the rest of
 * the page and a top-layer stacking context that no z-index can lose a fight
 * with. Every one of those is a thing hand-rolled modals get wrong, so this
 * wraps the element rather than reimplementing it.
 *
 * The dialog is kept mounted but its children are not: `children` is only
 * passed in while open, so a heavy form inside does not run its effects — or
 * its network lookups — on every page that renders the shell.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // showModal() throws if the dialog is already open, and close() fires a
    // close event, so both are guarded on the element's own state rather than
    // on the prop.
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  /*
   * The page behind a modal should not scroll under it. `inert` handles focus
   * and pointers, but not the scroll wheel, so the body is pinned for as long
   * as the dialog is up.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      // Esc and the browser's own dismissal both arrive here.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // A click landing on the dialog itself rather than on the panel inside
      // it is a click on the backdrop.
      onMouseDown={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-panel">
        <div className="modal-head">
          <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="modal-x"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="modal-body">{open ? children : null}</div>
      </div>
    </dialog>
  );
}
