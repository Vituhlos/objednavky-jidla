package cz.pbas.kantyna.mobile.db

import app.cash.sqldelight.db.SqlDriver

expect class DatabaseDriverFactory {
    fun createDriver(): SqlDriver
}

fun createDatabase(driverFactory: DatabaseDriverFactory): KantynaDatabase {
    return KantynaDatabase(driverFactory.createDriver())
}
