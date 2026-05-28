import SwiftUI

/// Root SwiftUI shell — mirrors Android `KantynaApp` auth gate + main tabs.
struct KantynaApp: View {
    @State private var authSession = AuthSession()

    var body: some View {
        Group {
            if authSession.isAuthenticated {
                MainTabView(onLogout: authSession.logout)
            } else {
                LoginView(onLoginSuccess: authSession.loginStub)
            }
        }
        .tint(Color.brandAccent)
    }
}

#Preview("Logged out") {
    KantynaApp()
}
