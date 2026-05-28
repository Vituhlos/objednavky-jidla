import SwiftUI

private enum Tab: String, CaseIterable, Identifiable {
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

struct ContentView: View {
    var body: some View {
        TabView {
            ForEach(Tab.allCases) { tab in
                PlaceholderScreen(title: tab.rawValue)
                    .tabItem {
                        Label(tab.rawValue, systemImage: tab.systemImage)
                    }
                    .tag(tab)
            }
        }
        .tint(Color(red: 234 / 255, green: 88 / 255, blue: 12 / 255)) // #EA580C
    }
}

private struct PlaceholderScreen: View {
    let title: String

    var body: some View {
        NavigationStack {
            VStack {
                Text(title)
                    .font(.title2)
                Text("Placeholder — wire up Shared framework on Mac")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
            }
            .navigationTitle(title)
        }
    }
}

#Preview {
    ContentView()
}
