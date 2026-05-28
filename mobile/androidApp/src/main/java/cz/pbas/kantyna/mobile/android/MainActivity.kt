package cz.pbas.kantyna.mobile.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import cz.pbas.kantyna.mobile.android.ui.KantynaApp
import cz.pbas.kantyna.mobile.android.ui.theme.KantynaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KantynaTheme {
                KantynaApp()
            }
        }
    }
}
