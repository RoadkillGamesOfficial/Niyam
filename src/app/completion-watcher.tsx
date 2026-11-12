"use client";

import { useEffect, useRef } from "react";
import { completionNotice } from "@/game/completions";

// The server only puts `?completed=<id>` on the redirect for the first time a
// task is finished. This keeps a reload of that URL quiet too, and never asks
// for permission itself: the check-in watcher already owns that prompt.

export function CompletionWatcher({ taskId }: { taskId: number | null }) {
  const notified = useRef(new Set<number>());

  useEffect(() => {
    if (!taskId || typeof Notification === "undefined") {
      return;
    }
    const key = `niyam.completion.${taskId}`;
    try {
      if (sessionStorage.getItem(key)) {
        notified.current.add(taskId);
        return;
      }
    } catch {
      // Storage can be blocked; the in-memory set still prevents a double render.
    }

    const notice = completionNotice(taskId, Notification.permission, notified.current);
    if (!notice) {
      return;
    }
    try {
      new Notification(notice.title, { body: notice.body });
      sessionStorage.setItem(key, "1");
    } catch {
      // Some browsers only allow notifications from a service worker.
    }
  }, [taskId]);

  return null;
}
