const assert = require("node:assert/strict");
const { test } = require("node:test");
const { trayMenuTemplate } = require("../tray-menu.js");

test("the tray offers exactly Open and Quit", () => {
  const items = trayMenuTemplate();
  const actions = items.filter((item) => item.type !== "separator");
  assert.deepEqual(
    actions.map((item) => item.label),
    ["Open", "Quit"],
  );
  assert.equal(items.filter((item) => item.type === "separator").length, 1);
});

test("no autostart item is offered yet", () => {
  const labels = trayMenuTemplate().map((item) => (item.label ?? "").toLowerCase());
  assert.equal(labels.some((label) => label.includes("windows")), false);
  assert.equal(labels.some((label) => label.includes("start")), false);
});

test("ids are unique so each action fires once", () => {
  const ids = trayMenuTemplate()
    .filter((item) => item.type !== "separator")
    .map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, ["open", "quit"]);
});
