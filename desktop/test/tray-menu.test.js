const assert = require("node:assert/strict");
const { test } = require("node:test");
const { toMenuTemplate, trayMenuTemplate } = require("../tray-menu.js");

test("the tray offers Open, one reminder switch and Quit", () => {
  const items = trayMenuTemplate();
  const actions = items.filter((item) => item.type !== "separator");
  assert.deepEqual(
    actions.map((item) => item.label),
    ["Open", "Snooze for an hour", "Quit"],
  );
  assert.equal(items.filter((item) => item.type === "separator").length, 1);
});

test("the reminder switch flips while snoozed", () => {
  const snoozed = trayMenuTemplate({ snoozed: true });
  assert.equal(snoozed[1].id, "resume");
  assert.equal(snoozed[1].label, "Resume reminders");
  assert.equal(snoozed.filter((item) => item.id === "snooze").length, 0);
});

test("no autostart item is offered yet", () => {
  const labels = trayMenuTemplate().map((item) => (item.label ?? "").toLowerCase());
  assert.equal(labels.some((label) => label.includes("windows")), false);
  assert.equal(labels.some((label) => label.includes("start")), false);
});

test("each item keeps its id and calls its own action", () => {
  const called = [];
  const template = toMenuTemplate(trayMenuTemplate(), {
    open: () => called.push("open"),
    quit: () => called.push("quit"),
  });
  assert.deepEqual(
    template.filter((item) => item.type !== "separator").map((item) => item.id),
    ["open", "snooze", "quit"],
  );
  assert.equal(template[2].type, "separator");
  template.find((item) => item.id === "quit").click();
  template.find((item) => item.id === "open").click();
  assert.deepEqual(called, ["quit", "open"]);
});

test("an unknown id has no handler to call", () => {
  const template = toMenuTemplate([{ id: "ghost", label: "Ghost" }], {
    open: () => assert.fail("must not fire"),
  });
  assert.doesNotThrow(() => template[0].click());
});

test("ids are unique so each action fires once", () => {
  const ids = trayMenuTemplate()
    .filter((item) => item.type !== "separator")
    .map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["open", "snooze", "quit"]);
});
