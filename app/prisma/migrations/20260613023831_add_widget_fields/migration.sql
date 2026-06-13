-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_file" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "src" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "method" INTEGER NOT NULL DEFAULT 1,
    "ext" TEXT NOT NULL,
    "file_type" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_file" ("created_at", "ext", "file_name", "file_type", "id", "method", "src", "updated_at", "user_id") SELECT "created_at", "ext", "file_name", "file_type", "id", "method", "src", "updated_at", "user_id" FROM "file";
DROP TABLE "file";
ALTER TABLE "new_file" RENAME TO "file";
CREATE TABLE "new_item_icon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "icon_json" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lan_url" TEXT,
    "description" TEXT,
    "open_method" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 9999,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "item_icon_group_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "widget_type" TEXT NOT NULL DEFAULT '',
    "widget_settings" TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO "new_item_icon" ("created_at", "description", "icon_json", "id", "item_icon_group_id", "lan_url", "open_method", "pinned", "sort", "title", "updated_at", "url", "user_id") SELECT "created_at", "description", "icon_json", "id", "item_icon_group_id", "lan_url", "open_method", "pinned", "sort", "title", "updated_at", "url", "user_id" FROM "item_icon";
DROP TABLE "item_icon";
ALTER TABLE "new_item_icon" RENAME TO "item_icon";
CREATE INDEX "item_icon_url_user_id_idx" ON "item_icon"("url", "user_id");
CREATE TABLE "new_item_icon_group" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 1,
    "group_type" TEXT NOT NULL DEFAULT 'website',
    "user_id" INTEGER NOT NULL
);
INSERT INTO "new_item_icon_group" ("created_at", "description", "group_type", "icon", "id", "sort", "title", "updated_at", "user_id") SELECT "created_at", "description", "group_type", "icon", "id", "sort", "title", "updated_at", "user_id" FROM "item_icon_group";
DROP TABLE "item_icon_group";
ALTER TABLE "new_item_icon_group" RENAME TO "item_icon_group";
CREATE INDEX "item_icon_group_user_id_group_type_idx" ON "item_icon_group"("user_id", "group_type");
CREATE TABLE "new_module_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value_json" TEXT NOT NULL
);
INSERT INTO "new_module_config" ("created_at", "id", "name", "updated_at", "user_id", "value_json") SELECT "created_at", "id", "name", "updated_at", "user_id", "value_json" FROM "module_config";
DROP TABLE "module_config";
ALTER TABLE "new_module_config" RENAME TO "module_config";
CREATE UNIQUE INDEX "module_config_user_id_name_key" ON "module_config"("user_id", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
