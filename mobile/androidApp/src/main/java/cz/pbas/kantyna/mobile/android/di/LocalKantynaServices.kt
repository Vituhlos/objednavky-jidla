package cz.pbas.kantyna.mobile.android.di

import androidx.compose.runtime.staticCompositionLocalOf
import cz.pbas.kantyna.mobile.KantynaServices

val LocalKantynaServices = staticCompositionLocalOf<KantynaServices> {
    error("KantynaServices not provided")
}
