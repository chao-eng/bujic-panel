-- CreateTable
CREATE TABLE "user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "head_image" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "role" INTEGER NOT NULL DEFAULT 2,
    "mail" TEXT,
    "referral_code" TEXT,
    "token" TEXT
);

-- CreateTable
CREATE TABLE "system_setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "config_name" TEXT NOT NULL,
    "config_value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "item_icon" (
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

-- CreateTable
CREATE TABLE "item_icon_group" (
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

-- CreateTable
CREATE TABLE "module_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value_json" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "user_config" (
    "user_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "panel_json" TEXT NOT NULL,
    "search_engine_json" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "file" (
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

-- CreateTable
CREATE TABLE "notice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "display_type" INTEGER NOT NULL,
    "one_read" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT,
    "is_login" INTEGER NOT NULL DEFAULT 0,
    "user_id" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_token_key" ON "user"("token");

-- CreateIndex
CREATE INDEX "user_username_password_idx" ON "user"("username", "password");

-- CreateIndex
CREATE UNIQUE INDEX "system_setting_config_name_key" ON "system_setting"("config_name");

-- CreateIndex
CREATE INDEX "item_icon_url_user_id_idx" ON "item_icon"("url", "user_id");

-- CreateIndex
CREATE INDEX "item_icon_group_user_id_group_type_idx" ON "item_icon_group"("user_id", "group_type");

-- CreateIndex
CREATE UNIQUE INDEX "module_config_user_id_name_key" ON "module_config"("user_id", "name");

