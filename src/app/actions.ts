"use server";

import { redirect } from "next/navigation";
import { CONFIG } from "@/config";
import { getOrCreateDayForDate } from "@/db/days";
import { getDatabase } from "@/db/index";
import { createTask, getTask, setTaskStatus } from "@/db/tasks";
import { localDateString } from "@/time";

// The only two ways the page changes data: add a task for today, and flip one
// task between open and done. The browser posts a plain form; the server writes
// SQLite, then redirects.
//
// Post/redirect/get matters here: without the redirect the browser sits on a
// POST result, and pressing refresh re-sends it, which used to add the same task
// twice. A redirect leaves the browser on a plain GET of the list.

export async function addTask(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();

  // The form marks the input required and caps its length; this is the same
  // check for anything that posts without the page.
  if (!title || title.length > CONFIG.tasks.maxTitleLength) {
    return;
  }

  const db = getDatabase();
  const day = getOrCreateDayForDate(db, localDateString());
  createTask(db, { dayId: day.id, title });

  redirect("/");
}

export async function toggleTask(formData: FormData): Promise<void> {
  const taskId = Number(formData.get("taskId"));
  if (!Number.isInteger(taskId)) {
    return;
  }

  const db = getDatabase();
  const task = getTask(db, taskId);
  if (!task) {
    return;
  }

  setTaskStatus(db, task.id, task.status === "done" ? "open" : "done");

  redirect("/");
}
