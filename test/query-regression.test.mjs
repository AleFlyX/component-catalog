import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { search } from "../skills/component-catalog/scripts/lib/query.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const baseline = path.join(root, "test/baselines/bulletproof-react-2026-10-25");
const catalog = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(baseline, "catalog.json.gz"))).toString("utf8"),
);
const config = JSON.parse(
  fs.readFileSync(
    path.join(root, "test/audits/2026-10-25-ai-detail/trial-config.json"),
    "utf8",
  ),
);

const ids = (query, limit = 5) => search(catalog, query, limit, config.vocabulary).items.map((item) => item.id);
const expectInTop = (query, expected, limit = 5) => {
  const found = ids(query, limit);
  assert.ok(found.includes(expected), `${query}: expected ${expected} in top ${limit}; got ${found.join(", ")}`);
  return found;
};

test("trial query regression set keeps the intended entrypoints in the top results", () => {
  const cases = [
    ["按钮", "ui.button.Button"],
    ["加载中", "ui.spinner.Spinner"],
    ["确认框", "ui.dialog.confirmation-dialog.ConfirmationDialog"],
    ["抽屉", "ui.drawer.DrawerContent"],
    ["下拉菜单", "ui.dropdown.DropdownMenuContent"],
    ["表格", "ui.table.Table"],
    ["分页", "ui.table.TablePagination"],
    ["输入框", "ui.form.Input"],
    ["登录", "auth.LoginForm"],
    ["评论", "comments.CommentsList"],
    ["创建讨论", "discussions.CreateDiscussion"],
    ["用户列表", "users.UsersList"],
    ["markdown 预览", "ui.md-preview.MDPreview"],
    ["delete discussion", "discussions.DeleteDiscussion"],
    ["confirmation dialog", "ui.dialog.confirmation-dialog.ConfirmationDialog"],
    ["create discussion", "discussions.CreateDiscussion"],
    ["login form input", "ui.form.Input"],
    ["input", "ui.form.Input"],
    ["table pagination", "ui.table.TablePagination"],
    ["表格分页", "ui.table.TablePagination"],
    ["分页控件", "ui.table.TablePagination"],
    ["pagination control", "ui.table.TablePagination"],
    ["markdown body", "ui.md-preview.MDPreview"],
    ["user list", "users.UsersList"],
    ["update profile", "users.UpdateProfile"],
  ];
  for (const [query, expected] of cases) expectInTop(query, expected);

  // Entrypoints that must lead, not merely appear: these are the mistakes the
  // AI behavior audit found in task 2 and task 3.
  assert.equal(ids("login form input")[0], "ui.form.Input");
  assert.equal(ids("input")[0], "ui.form.Input");
  assert.equal(ids("confirmation dialog")[0], "ui.dialog.confirmation-dialog.ConfirmationDialog");
  assert.equal(ids("表格分页")[0], "ui.table.TablePagination");
  assert.equal(ids("pagination control")[0], "ui.table.TablePagination");
});

test("search reports limit omissions separately from byte truncation", () => {
  const limited = search(catalog, "评论", 2, config.vocabulary);
  assert.equal(limited.truncated, false);
  assert.ok(limited.omitted.byLimit >= 1);
  assert.equal(limited.omitted.byBytes, 0);

  const brief = search(catalog, "分页", 10, config.vocabulary, true);
  assert.equal(brief.brief, true);
  assert.ok(brief.items.length >= 5);
  assert.equal(brief.items[0].summary, undefined);
  assert.equal(brief.items[0].importPath, "@/components/ui/table/pagination");
});
