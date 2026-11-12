"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COPY } from "@/copy";
import { isQuiet } from "@/game/pulses";
import { checkinShortcutFromEvent, type ShortcutTarget } from "@/game/shortcuts";
import { answerCheckin } from "./actions";
import { ClockIcon, Mascot } from "./ui/sprites";

// Browser side of the check-in. The server owns the schedule; this makes a due
// prompt noticeable while another window has focus (PULSE-1), at the level the
// user chose:
//   gentle   -> the server-rendered card only
//   standard -> card, plus a locally generated chime and a browser notification
//   firm     -> card, plus a full-screen prompt that stays until it is answered
// Quiet hours never escalate, whatever the level.

type Level = "gentle" | "standard" | "firm";

type Props = {
  intervalMinutes: number;
  level: Level;
  nextDueAt: string | null;
  pending: boolean;
  pendingId: number | null;
  pendingQuiet: boolean;
  paused: boolean;
  quietStart: string | null;
  quietEnd: string | null;
};

export function CheckInWatcher({
  intervalMinutes,
  level,
  nextDueAt,
  pending,
  pendingId,
  pendingQuiet,
  paused,
  quietStart,
  quietEnd,
}: Props) {
  const router = useRouter();
  const [overlay, setOverlay] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const notifiedPending = useRef<number | null>(null);
  const timerFired = useRef(false);
  const timerFiredAt = useRef(0);
  const quickForm = useRef<HTMLFormElement>(null);
  const quickResponse = useRef<HTMLInputElement>(null);

  // A soft two-note chime, generated locally: no audio files, no network.
  function chime(): void {
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      if (context.state === "suspended") {
        void context.resume();
      }
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

  function notify(quietNow: boolean): void {
    if (level === "gentle" || quietNow) {
      return;
    }
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

  // Firm is a gate, not a toast: any loud pending prompt opens it, including one
  // that came due while the page was closed.
  useEffect(() => {
    if (!pending) {
      setOverlay(false);
      return;
    }
    if (level === "firm" && !pendingQuiet) {
      setOverlay(true);
    }
  }, [pending, pendingQuiet, level]);

  // A prompt that was already waiting still gets one chime/notification.
  useEffect(() => {
    if (!pending || !pendingId || pendingQuiet || paused) {
      return;
    }
    if (notifiedPending.current === pendingId) {
      return;
    }
    notifiedPending.current = pendingId;
    // The timer already chimed for this prompt a moment ago; refresh() then
    // mounts it as pending, and escalating again would double the interruption.
    if (Date.now() - timerFiredAt.current < 10_000) {
      return;
    }
    notify(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, pendingId, pendingQuiet, paused, level]);

  useEffect(() => {
    timerFired.current = false;
  }, [nextDueAt]);

  useEffect(() => {
    if (paused || !nextDueAt) {
      setRemaining(null);
      return;
    }
    const due = new Date(nextDueAt.replace(" ", "T"));
    const tick = (): void => {
      const left = due.getTime() - Date.now();
      setRemaining(left);
      if (left <= 0 && !timerFired.current) {
        timerFired.current = true;
        timerFiredAt.current = Date.now();
        notify(isQuiet(due, quietStart, quietEnd));
        router.refresh(); // pull the server-rendered prompt (and its quiet flag)
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextDueAt, paused, level, quietStart, quietEnd, router]);

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

  // O / P / D answer the inline prompt. They deliberately stay quiet while a
  // text field has focus or the firm overlay owns the page. The hidden form
  // submits through the same server action as the visible buttons.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!pending || pendingId === null || overlay) {
        return;
      }
      const modalOpen =
        overlay || document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
      const response = checkinShortcutFromEvent({
        key: event.key,
        target: event.target as ShortcutTarget,
        modalOpen,
        defaultPrevented: event.defaultPrevented,
        repeat: event.repeat,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });
      if (!response) {
        return;
      }
      const form = quickForm.current;
      const input = quickResponse.current;
      if (!form || !input) {
        return;
      }
      event.preventDefault();
      input.value = response;
      form.requestSubmit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlay, pending, pendingId]);

  if (overlay && level === "firm" && pending && pendingId !== null && !pendingQuiet) {
    return (
      <div
        className="overlay"
        role="dialog"
        aria-modal="true"
        aria-label={COPY.checkin.overlayHeading}
      >
        <div className="overlay-card">
          <Mascot className="overlay-mascot" />
          <p className="label">{COPY.checkin.overlayHeading}</p>
          <h2 className="checkin-question">{COPY.checkin.question}</h2>
          <form action={answerCheckin}>
            <input type="hidden" name="pulseId" value={pendingId} />
            <label className="field">
              <span>{COPY.checkin.noteLabel}</span>
              <input
                type="text"
                name="note"
                maxLength={280}
                placeholder={COPY.checkin.notePlaceholder}
              />
            </label>
            <div className="answer-row">
              <button className="button" type="submit" name="response" value="on_track">
                {COPY.checkin.onTrack}
              </button>
              <button className="button button-alt" type="submit" name="response" value="pivot">
                {COPY.checkin.pivot}
              </button>
              <button
                className="button button-quiet"
                type="submit"
                name="response"
                value="drifted"
              >
                {COPY.checkin.drifted}
              </button>
            </div>
          </form>
          <p className="hint small">{COPY.checkin.overlayHint}</p>
        </div>
      </div>
    );
  }

  if (remaining === null || paused || pending) {
    if (!pending || pendingId === null || overlay) {
      return null;
    }
    return (
      <form ref={quickForm} action={answerCheckin} hidden>
        <input type="hidden" name="pulseId" value={pendingId} />
        <input
          ref={quickResponse}
          type="hidden"
          name="response"
          defaultValue="on_track"
        />
      </form>
    );
  }

  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  const urgent = remaining <= 60_000;
  const ratio = Math.min(1, Math.max(0, remaining / (intervalMinutes * 60_000)));
  return (
    <div
      className={`timer-widget${urgent ? " timer--urgent" : ""}`}
      role="timer"
      aria-label={`${COPY.checkin.nextIn}: ${minutes} min`}
    >
      <ClockIcon className="timer-icon" />
      <div className="timer-copy">
        <span className="timer-label">{COPY.checkin.nextIn}</span>
        <span className="timer-value">{minutes} min</span>
        <span className="timer-every">
          {COPY.checkin.every} {intervalMinutes} min
        </span>
      </div>
      <div className="timer-track" aria-hidden="true">
        <span className="timer-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  );
}
