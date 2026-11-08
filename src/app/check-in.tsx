"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/copy";

// Browser side of the check-in. The server owns the schedule; this only makes a
// due prompt noticeable while another window has focus (PULSE-1). Interruption
// levels map to: in-page card only (gentle), card plus a soft chime and a
// notification (standard), or a full-screen prompt (firm).

type Props = {
  intervalMinutes: number;
  level: "gentle" | "standard" | "firm";
  nextDueAt: string | null;
  pending: boolean;
  paused: boolean;
};

export function CheckInWatcher({ intervalMinutes, level, nextDueAt, pending, paused }: Props) {
  const router = useRouter();
  const [overlay, setOverlay] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const chimePlayed = useRef(false);

  // A soft two-note chime, generated locally: no audio files, no network.
  function chime(): void {
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      [660, 880].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        gain.gain.value = 0.06;
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + index * 0.16);
        oscillator.stop(context.currentTime + index * 0.16 + 0.14);
      });
      setTimeout(() => void context.close(), 1200);
    } catch {
      // Audio is a nicety; a blocked context must never break the prompt.
    }
  }

  function notify(): void {
    if (level === "gentle") return;
    chime();
    if (level === "firm") {
      setOverlay(true);
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(COPY.home.title, { body: COPY.checkin.question });
      } catch {
        // Some browsers only allow notifications from a service worker.
      }
    }
  }

  useEffect(() => {
    if (paused || !nextDueAt) {
      setRemaining(null);
      return;
    }
    const due = new Date(nextDueAt.replace(" ", "T")).getTime();
    const tick = (): void => {
      const left = due - Date.now();
      setRemaining(left);
      if (left <= 0 && !chimePlayed.current) {
        chimePlayed.current = true;
        notify();
        router.refresh(); // pull the server-rendered prompt
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextDueAt, paused, level]);

  useEffect(() => {
    if (pending) {
      chimePlayed.current = false;
    }
  }, [pending]);

  // Ask once, on the first click, so the browser allows notifications later.
  useEffect(() => {
    if (level === "gentle") return;
    const ask = (): void => {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    };
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, [level]);

  if (overlay && level === "firm" && pending) {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-label={COPY.checkin.heading}>
        <div className="overlay-card">
          <h2>{COPY.checkin.question}</h2>
          <p>{COPY.checkin.notePlaceholder}</p>
          <button className="button" type="button" onClick={() => setOverlay(false)}>
            {COPY.checkin.heading}
          </button>
        </div>
      </div>
    );
  }

  if (remaining === null || paused || pending) {
    return null;
  }

  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  return (
    <p className="hint small">
      {COPY.checkin.nextIn} · {minutes} min · {COPY.checkin.every} {intervalMinutes} min
    </p>
  );
}
