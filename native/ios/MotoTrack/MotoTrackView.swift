import SwiftUI
import WebKit
import UIKit

private let appOrigin = URL(string: "https://moto-track.net")!
private var english: Bool { Locale.current.language.languageCode?.identifier == "en" }
private func copy(_ pt: String, _ en: String) -> String { english ? en : pt }

@MainActor
final class BrowserState: NSObject, ObservableObject {
    @Published var failed = false
    @Published var canGoBack = false
    let webView: WKWebView

    private var historyObservation: NSKeyValueObservation?

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "MotoTrackNative/iOS"
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        historyObservation = webView.observe(\.canGoBack, options: [.initial, .new]) { [weak self] view, _ in
            Task { @MainActor in self?.canGoBack = view.canGoBack }
        }
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(reload), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
    }

    @objc func reload() {
        failed = false
        let current = webView.url.flatMap { url in
            url.scheme == "https" && url.host == appOrigin.host && (url.port == nil || url.port == 443) ? url : nil
        }
        webView.load(URLRequest(url: current ?? appOrigin.appendingPathComponent("dashboard")))
    }
}

@MainActor
struct MotoTrackView: View {
    @StateObject private var state = BrowserState()
    @State private var sharing = false

    var body: some View {
        NavigationStack {
            ZStack {
                WebContainer(state: state).opacity(state.failed ? 0 : 1)
                if state.failed {
                    ContentUnavailableView {
                        Label(copy("Sem conexão", "Couldn't connect"), systemImage: "wifi.slash")
                    } description: {
                        Text(copy("Confira sua conexão e tente novamente. Seus registros na nuvem não foram apagados.", "Check your connection and retry. Your cloud records have not been deleted."))
                    } actions: {
                        Button(copy("Tentar novamente", "Retry")) { state.reload() }.buttonStyle(.borderedProminent)
                    }
                }
            }
            .navigationTitle("Moto Track")
            .navigationBarTitleDisplayMode(.inline)
            .tint(.red)
            .toolbar {
                ToolbarItemGroup(placement: .bottomBar) {
                    Button(action: { state.failed = false; state.webView.goBack() }) {
                        Label(copy("Voltar", "Back"), systemImage: "chevron.left")
                    }.disabled(!state.canGoBack)
                    Spacer()
                    Button(action: { state.reload() }) {
                        Label(copy("Atualizar", "Reload"), systemImage: "arrow.clockwise")
                    }
                    Spacer()
                    Button(action: { sharing = true }) {
                        Label(copy("Compartilhar app", "Share app"), systemImage: "square.and.arrow.up")
                    }
                }
            }
            .sheet(isPresented: $sharing) { ShareSheet(items: ["Moto Track", appOrigin]) }
        }
    }
}

@MainActor
private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

@MainActor
private struct WebContainer: UIViewRepresentable {
    @ObservedObject var state: BrowserState
    func makeCoordinator() -> Coordinator { Coordinator(state) }
    func makeUIView(context: Context) -> WKWebView {
        state.webView.navigationDelegate = context.coordinator
        state.webView.uiDelegate = context.coordinator
        state.reload()
        return state.webView
    }
    func updateUIView(_ view: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        let state: BrowserState
        var downloads: [ObjectIdentifier: URL] = [:]
        init(_ state: BrowserState) { self.state = state }

        private func owned(_ url: URL) -> Bool {
            url.scheme == "https" && url.host == appOrigin.host && (url.port == nil || url.port == 443)
        }
        private func restricted(_ url: URL) -> Bool {
            let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            return ["precos", "billing", "billing/checkout", "billing/portal"].contains(path)
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if owned(url) {
                if restricted(url) {
                    decisionHandler(.cancel)
                    webView.load(URLRequest(url: appOrigin.appendingPathComponent("app-info")))
                } else if action.shouldPerformDownload {
                    decisionHandler(.download)
                } else if action.targetFrame == nil {
                    decisionHandler(.cancel)
                    webView.load(action.request)
                } else { decisionHandler(.allow) }
            } else {
                decisionHandler(.cancel)
                if action.navigationType == .linkActivated && ["https", "mailto"].contains(url.scheme ?? "") {
                    UIApplication.shared.open(url)
                }
            }
        }
        func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            decisionHandler(response.canShowMIMEType ? .allow : .download)
        }
        private func presenter() -> UIViewController? {
            guard var root = state.webView.window?.rootViewController else { return nil }
            while let next = root.presentedViewController { root = next }
            return root
        }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            guard frame.securityOrigin.host == appOrigin.host, let root = presenter() else { completionHandler(); return }
            let alert = UIAlertController(title: "Moto Track", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            root.present(alert, animated: true)
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            guard frame.securityOrigin.host == appOrigin.host, let root = presenter() else { completionHandler(false); return }
            let alert = UIAlertController(title: "Moto Track", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: copy("Cancelar", "Cancel"), style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: copy("Confirmar", "Confirm"), style: .default) { _ in completionHandler(true) })
            root.present(alert, animated: true)
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            state.canGoBack = webView.canGoBack
            webView.scrollView.refreshControl?.endRefreshing()
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failure(error) }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failure(error) }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { state.failed = true }
        private func failure(_ error: Error) {
            if (error as NSError).code != NSURLErrorCancelled { state.failed = true }
            state.webView.scrollView.refreshControl?.endRefreshing()
        }
        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            guard let url = response.url, owned(url) else { completionHandler(nil); return }
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let basename = (suggestedFilename as NSString).lastPathComponent
                let filename = basename.isEmpty || basename == "." || basename == ".." ? "moto-track-download" : basename
                let target = folder.appendingPathComponent(filename)
                downloads[ObjectIdentifier(download)] = target
                completionHandler(target)
            } catch { completionHandler(nil) }
        }
        func downloadDidFinish(_ download: WKDownload) {
            guard let url = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
            let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            controller.completionWithItemsHandler = { _, _, _, _ in
                try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            }
            guard let root = state.webView.window?.rootViewController else {
                try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
                return
            }
            var presenter = root
            while let next = presenter.presentedViewController { presenter = next }
            controller.popoverPresentationController?.sourceView = presenter.view
            controller.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
            presenter.present(controller, animated: true)
        }
        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            if let url = downloads.removeValue(forKey: ObjectIdentifier(download)) {
                try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            }
        }
    }
}
