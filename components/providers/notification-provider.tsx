"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NoticeType = "notice" | "success" | "error";

type NotificationContextValue = {
  show: (type: NoticeType, message: string, opts?: { durationMs?: number }) => void;
  notice: (message: string, opts?: { durationMs?: number }) => void;
  success: (message: string, opts?: { durationMs?: number }) => void;
  error: (message: string, opts?: { durationMs?: number }) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NoticeType>("notice");
  const timerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const unmountTimerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearUnmountTimer = () => {
    if (unmountTimerRef.current) {
      window.clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
  };

  const show = useCallback((t: NoticeType, msg: string, opts?: { durationMs?: number }) => {
    clearTimer();
    clearUnmountTimer();
    setType(t);
    setMessage(msg);
    setMounted(true);
    setOpen(true);
    const duration = opts?.durationMs ?? 5000;
    timerRef.current = window.setTimeout(() => setOpen(false), duration) as unknown as number;
  }, []);

  const notice = useCallback((msg: string, opts?: { durationMs?: number }) => show("notice", msg, opts), [show]);
  const success = useCallback((msg: string, opts?: { durationMs?: number }) => show("success", msg, opts), [show]);
  const error = useCallback((msg: string, opts?: { durationMs?: number }) => show("error", msg, opts), [show]);

  const close = useCallback(() => {
    setOpen(false);
    clearTimer();
    clearUnmountTimer();
    unmountTimerRef.current = window.setTimeout(() => setMounted(false), 300) as unknown as number;
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      clearUnmountTimer();
    },
    []
  );

  const value = useMemo<NotificationContextValue>(() => ({ show, notice, success, error }), [show, notice, success, error]);

  const styles = {
    success: {
      bg: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-800",
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    error: {
      bg: "bg-rose-50 border-rose-200",
      text: "text-rose-800",
      icon: (
        <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    notice: {
      bg: "bg-indigo-50 border-indigo-200",
      text: "text-indigo-800",
      icon: (
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const currentStyle = styles[type];

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {mounted && (
        <div
          className={`fixed right-4 top-20 z-[1000] min-w-[280px] max-w-[400px] border rounded-lg px-4 py-3 shadow-md flex items-start gap-3 transition-all duration-300 ${currentStyle.bg} ${
            open ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
          }`}
          role="status"
        >
          <div className="flex-shrink-0 mt-0.5">{currentStyle.icon}</div>
          <p className={`flex-1 text-sm font-medium ${currentStyle.text}`}>{message}</p>
          <button
            onClick={close}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors ${currentStyle.text}`}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
