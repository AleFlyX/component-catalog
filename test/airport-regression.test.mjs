import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { search } from "../skills/component-catalog/scripts/lib/query.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = path.join(root, "test/audits/2026-10-26-airport-mobile");
const catalog = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(dir, "catalog.json.gz"))).toString("utf8"),
);
const config = JSON.parse(fs.readFileSync(path.join(dir, "trial-config.json"), "utf8"));
const expandedDir = path.join(root, "test/audits/2026-10-26-airport-ui-expanded");
const expandedCatalog = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(expandedDir, "catalog.json.gz"))).toString("utf8"),
);
const expandedConfig = JSON.parse(fs.readFileSync(path.join(expandedDir, "trial-config.json"), "utf8"));
const u55Dir = path.join(root, "test/audits/2026-10-26-airport-ui55-expanded");
const u55Catalog = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(u55Dir, "catalog.json.gz"))).toString("utf8"),
);
const u55Config = JSON.parse(fs.readFileSync(path.join(u55Dir, "trial-config.json"), "utf8"));

const top = (query) =>
  search(catalog, query, 5, config.vocabulary).items.map((item) => item.id);

test("airport trial catalog keeps the business entrypoints discoverable", () => {
  assert.equal(catalog.components.length, 30);
  assert.equal(top("航班延误补偿批次")[0], "flight-delay.FlightDelayCompensationBatchScreen");
  assert.equal(top("特殊旅客预订列表")[0], "bookings.TravelerBookingListScreen");
  assert.equal(top("密码输入框")[0], "auth.PasswordInput");
  assert.equal(top("搜索栏")[0], "business.SearchBar");
  assert.equal(top("筛选面板")[0], "business.FilterSheet");
  assert.equal(top("认证恢复弹窗")[0], "common.AuthRecoveryDialog");
  assert.ok(top("预订列表").includes("bookings.TravelerBookingListScreen"));

  const detailed = search(catalog, "特殊旅客预订列表", 1, config.vocabulary, false, true);
  assert.equal(detailed.details, true);
  assert.deepEqual(detailed.items[0].requiredProps, ["navigate"]);
  assert.match(detailed.items[0].constraint, /initialStatus is optional/);
  assert.ok(detailed.items[0].usage.production >= 1);
});

test("expanded UI catalog exposes the core primitives without regressing business entrypoints", () => {
  assert.equal(expandedCatalog.components.length, 40);
  const top = (query) =>
    search(expandedCatalog, query, 5, expandedConfig.vocabulary).items.map((item) => item.id);
  assert.equal(top("UiButton")[0], "ui.UiButton");
  assert.equal(top("UiInput")[0], "ui.UiInput");
  assert.equal(top("UiDialog")[0], "ui.UiDialog");
  assert.equal(top("密码输入框")[0], "auth.PasswordInput");
  assert.equal(top("航班延误补偿批次")[0], "flight-delay.FlightDelayCompensationBatchScreen");
});

test("55-entry catalog covers the remaining UI queries without losing business entrypoints", () => {
  assert.equal(u55Catalog.components.length, 55);
  const top = (query) =>
    search(u55Catalog, query, 5, u55Config.vocabulary).items.map((item) => item.id);
  assert.equal(top("UiDatePicker")[0], "ui.UiDatePicker");
  assert.equal(top("UiEmptyState")[0], "ui.UiEmptyState");
  assert.equal(top("UiTabs")[0], "ui.UiTabs");
  assert.equal(top("UiCard")[0], "ui.UiCard");
  assert.equal(top("UiNavBar")[0], "ui.UiNavBar");
  assert.equal(top("密码输入框")[0], "auth.PasswordInput");
  assert.equal(top("航班延误补偿批次")[0], "flight-delay.FlightDelayCompensationBatchScreen");
});
