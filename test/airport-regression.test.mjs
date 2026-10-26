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
const u57Dir = path.join(root, "test/audits/2026-10-26-airport-57");
const u57Catalog = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(u57Dir, "catalog.json.gz"))).toString("utf8"),
);
const u57Config = JSON.parse(fs.readFileSync(path.join(u57Dir, "trial-config.json"), "utf8"));

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
  const featurePassword = search(u55Catalog, "密码输入框", 5, u55Config.vocabulary, false, false, "feature");
  assert.equal(featurePassword.layer, "feature");
  assert.equal(featurePassword.items[0].id, "auth.PasswordInput");
  assert.ok(featurePassword.items.every((item) => item.layer === "feature"));
  const sharedButton = search(u55Catalog, "UiButton", 5, u55Config.vocabulary, false, false, "feature");
  assert.equal(sharedButton.items.length, 0);
  const autoPassword = search(u55Catalog, "密码输入框", 5, u55Config.vocabulary, false, false, "auto");
  assert.equal(autoPassword.layerSource, "auto");
  assert.equal(autoPassword.layer, "feature");
  assert.equal(autoPassword.items[0].id, "auth.PasswordInput");
  const autoSearchBar = search(u55Catalog, "搜索栏", 5, u55Config.vocabulary, false, false, "auto");
  assert.equal(autoSearchBar.layer, "shared-ui");
  assert.equal(autoSearchBar.items[0].id, "business.SearchBar");
  const perLayer = search(u55Catalog, "预订列表 搜索栏 筛选面板", 5, u55Config.vocabulary, false, false, null, false, 3);
  assert.equal(perLayer.perLayer, 3);
  assert.ok(perLayer.layers.includes("feature"));
  assert.ok(perLayer.layers.includes("shared-ui"));
  const perLayerIds = perLayer.items.map((item) => item.id);
  assert.ok(perLayerIds.includes("business.SearchBar"));
  assert.ok(perLayerIds.includes("business.FilterSheet"));
  const spacedList = search(u55Catalog, "航班延误 补偿 列表", 5, u55Config.vocabulary, false, false, null, false, 3);
  assert.equal(spacedList.items[0].id, "flight-delay.FlightDelayCompensationListScreen");
  const mixedNav = search(u55Catalog, "登录页 顶部导航栏 login page navbar header", 5, u55Config.vocabulary, false, false, null, false, 3);
  const mixedIds = mixedNav.items.map((item) => item.id);
  assert.ok(mixedIds.includes("auth.SignInPage"));
  assert.ok(mixedIds.includes("ui.UiNavBar"));
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
  const featurePassword = search(u55Catalog, "密码输入框", 5, u55Config.vocabulary, false, false, "feature");
  assert.equal(featurePassword.layer, "feature");
  assert.equal(featurePassword.items[0].id, "auth.PasswordInput");
  assert.ok(featurePassword.items.every((item) => item.layer === "feature"));
  const sharedButton = search(u55Catalog, "UiButton", 5, u55Config.vocabulary, false, false, "feature");
  assert.equal(sharedButton.items.length, 0);
  const autoPassword = search(u55Catalog, "密码输入框", 5, u55Config.vocabulary, false, false, "auto");
  assert.equal(autoPassword.layerSource, "auto");
  assert.equal(autoPassword.layer, "feature");
  assert.equal(autoPassword.items[0].id, "auth.PasswordInput");
  const autoSearchBar = search(u55Catalog, "搜索栏", 5, u55Config.vocabulary, false, false, "auto");
  assert.equal(autoSearchBar.layer, "shared-ui");
  assert.equal(autoSearchBar.items[0].id, "business.SearchBar");
  const perLayer = search(u55Catalog, "预订列表 搜索栏 筛选面板", 5, u55Config.vocabulary, false, false, null, false, 3);
  assert.equal(perLayer.perLayer, 3);
  assert.ok(perLayer.layers.includes("feature"));
  assert.ok(perLayer.layers.includes("shared-ui"));
  const perLayerIds = perLayer.items.map((item) => item.id);
  assert.ok(perLayerIds.includes("business.SearchBar"));
  assert.ok(perLayerIds.includes("business.FilterSheet"));
  const spacedList = search(u55Catalog, "航班延误 补偿 列表", 5, u55Config.vocabulary, false, false, null, false, 3);
  assert.equal(spacedList.items[0].id, "flight-delay.FlightDelayCompensationListScreen");
  const mixedNav = search(u55Catalog, "登录页 顶部导航栏 login page navbar header", 5, u55Config.vocabulary, false, false, null, false, 3);
  const mixedIds = mixedNav.items.map((item) => item.id);
  assert.ok(mixedIds.includes("auth.SignInPage"));
  assert.ok(mixedIds.includes("ui.UiNavBar"));
});

test("57-entry catalog closes the status-tag and image-viewer gaps", () => {
  assert.equal(u57Catalog.components.length, 57);
  const ids = (query) =>
    search(u57Catalog, query, 5, u57Config.vocabulary, false, false, null, false, 3).items.map(
      (item) => item.id,
    );
  assert.equal(ids("status tag")[0], "ui.UiStatusTag");
  assert.equal(ids("image viewer")[0], "ui.UiImageViewer");
  const mixed = ids("login page navigation bar");
  assert.ok(mixed.includes("auth.SignInPage"));
  assert.ok(mixed.includes("ui.UiNavBar"));
  assert.equal(ids("航班延误补偿列表页面")[0], "flight-delay.FlightDelayCompensationListScreen");
});
