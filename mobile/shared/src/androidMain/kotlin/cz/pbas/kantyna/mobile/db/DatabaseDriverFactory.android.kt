package cz.pbas.kantyna.mobile.db

import android.content.Context
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import cz.pbas.kantyna.mobile.db.KantynaDatabase

actual class DatabaseDriverFactory(
    private val context: Context,
) {
    actual fun createDriver(): SqlDriver =
        AndroidSqliteDriver(KantynaDatabase.Schema, context, "kantyna.db")
}
