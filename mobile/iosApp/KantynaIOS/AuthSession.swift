import Foundation
import Observation

/// Placeholder auth gate until `Shared` `AuthRepository` is wired on macOS.
@Observable
final class AuthSession {
    static let tokenKey = "kantyna.authToken"

    private(set) var isAuthenticated: Bool

    init() {
        isAuthenticated = UserDefaults.standard.string(forKey: Self.tokenKey) != nil
    }

    func loginStub() {
        UserDefaults.standard.set("stub-token", forKey: Self.tokenKey)
        isAuthenticated = true
    }

    func logout() {
        UserDefaults.standard.removeObject(forKey: Self.tokenKey)
        isAuthenticated = false
    }
}
