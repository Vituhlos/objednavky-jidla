package cz.pbas.kantyna.mobile.android

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import cz.pbas.kantyna.mobile.android.push.PushDeepLinkHolder
import cz.pbas.kantyna.mobile.android.ui.KantynaApp
import cz.pbas.kantyna.mobile.android.ui.theme.KantynaTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handlePushDeepLink(intent)
        val services = (application as KantynaApplication).services
        enableEdgeToEdge()
        setContent {
            KantynaTheme {
                KantynaApp(services = services)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePushDeepLink(intent)
    }

    private fun handlePushDeepLink(intent: Intent?) {
        val url = intent?.getStringExtra(EXTRA_PUSH_URL)
            ?: intent?.extras?.getString("url")
        if (!url.isNullOrBlank()) {
            PushDeepLinkHolder.requestObedTab()
            intent?.removeExtra(EXTRA_PUSH_URL)
        }
    }

    companion object {
        const val EXTRA_PUSH_URL = "push_url"

        fun createLaunchIntent(context: Context, url: String?): Intent =
            Intent(context, MainActivity::class.java).apply {
                if (!url.isNullOrBlank()) {
                    putExtra(EXTRA_PUSH_URL, url)
                }
            }
    }
}
