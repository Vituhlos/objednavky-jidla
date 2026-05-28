import SwiftUI

struct LoginView: View {
    var onLoginSuccess: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            Text("Kantýna")
                .font(.largeTitle.bold())
                .foregroundStyle(Color.brandAccent)

            Text("Přihlaste se e-mailem a heslem")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.top, 8)

            VStack(spacing: 12) {
                TextField("E-mail", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                SecureField("Heslo", text: $password)
                    .textContentType(.password)
                    .padding(12)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .padding(.top, 32)

            Button {
                loginStub()
            } label: {
                Group {
                    if isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Přihlásit se")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.brandAccent)
            .disabled(isLoading)
            .padding(.top, 24)

            Button("QR přihlášení — brzy") {
                // Placeholder — deep link pairing in a later milestone.
            }
            .buttonStyle(.bordered)
            .disabled(isLoading)
            .padding(.top, 12)

            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private func loginStub() {
        isLoading = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            isLoading = false
            onLoginSuccess()
        }
    }
}

#Preview {
    LoginView(onLoginSuccess: {})
}
