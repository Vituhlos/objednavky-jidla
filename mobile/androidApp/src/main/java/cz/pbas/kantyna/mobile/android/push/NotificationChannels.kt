package cz.pbas.kantyna.mobile.android.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import cz.pbas.kantyna.mobile.android.R

object NotificationChannels {
    const val ORDER_REMINDERS = "order_reminders"

    fun ensureCreated(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            ORDER_REMINDERS,
            context.getString(R.string.notification_channel_order_reminders),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = context.getString(R.string.notification_channel_order_reminders_description)
        }

        val manager = context.getSystemService(NotificationManager::class.java)
        manager?.createNotificationChannel(channel)
    }
}
