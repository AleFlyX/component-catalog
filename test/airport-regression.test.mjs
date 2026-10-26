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
});
