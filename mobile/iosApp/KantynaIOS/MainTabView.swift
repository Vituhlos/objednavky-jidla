import SwiftUI

private enum MainTab: String, CaseIterable, Identifiable {
    case obed = "Oběd"
    case jidelnicek = "Jídelníček"
    case historie = "Historie"
    case profil = "Profil"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .obed: return "fork.knife"
        case .jidelnicek: return "list.bullet.rectangle"
        case .historie: return "clock"
        case .profil: return "person"
        }
    }
}

struct MainTabView: View {
    var onLogout: () -> Void

    @State private var selectedTab: MainTab = .obed

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(MainTab.allCases) { tab in
                tabContent(for: tab)
                    .tabItem {
                        Label(tab.rawValue, systemImage: tab.systemImage)
                    }
                    .tag(tab)
            }
        }
        .tint(Color.brandAccent)
    }

    @ViewBuilder
    private func tabContent(for tab: MainTab) -> some View {
        switch tab {
        case .obed:
            TabPlaceholderView(
                title: tab.rawValue,
                subtitle: "Dnešní oběd a objednávka — napojí se na Shared API."
            )
        case .jidelnicek:
            TabPlaceholderView(
                title: tab.rawValue,
                subtitle: "Týdenní jídelníček — napojí se na Shared MenuRepository."
            )
        case .historie:
            TabPlaceholderView(
                title: tab.rawValue,
                subtitle: "Historie objednávek — napojí se na Shared HistoryRepository."
            )
        case .profil:
            ProfileTabPlaceholderView(onLogout: onLogout)
        }
    }
}

private struct TabPlaceholderView: View {
    let title: String
    let subtitle: String

    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label(title, systemImage: "tray")
            } description: {
                Text(subtitle)
            }
            .navigationTitle(title)
        }
    }
}

private struct ProfileTabPlaceholderView: View {
    var onLogout: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Účet", value: "Placeholder")
                    LabeledContent("E-mail", value: "user@example.com")
                }
                Section {
                    Button("Odhlásit se", role: .destructive, action: onLogout)
                }
            }
            .navigationTitle("Profil")
        }
    }
}

#Preview {
    MainTabView(onLogout: {})
}
