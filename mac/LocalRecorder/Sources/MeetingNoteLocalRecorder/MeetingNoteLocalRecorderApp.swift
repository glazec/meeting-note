import AppKit
import AVFoundation
import Foundation
import LocalRecorderCore
import ServiceManagement
import SwiftUI
import UserNotifications

@main
struct MeetingNoteLocalRecorderApp: App {
    @StateObject private var model = RecorderAppModel()

    var body: some Scene {
        MenuBarExtra("Meeting Note Recorder", systemImage: model.menuBarImage) {
            RecorderMenuView(model: model)
                .onOpenURL { url in
                    model.handleLoginCallback(url)
                }
        }
        .menuBarExtraStyle(.window)
    }
}

@MainActor
final class RecorderAppModel: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    private static let defaultServerURLText = "https://meeting-note-swart.vercel.app"

    @Published var permissionChecklist = PermissionChecklist(
        microphone: .unknown,
        screenCapture: .unknown,
        notifications: .unknown,
        startAtLogin: .unknown
    )
    @Published var statusText = "Sign in to start monitoring"
    @Published var serverURLText: String
    @Published var bearerToken: String
    @Published var isRecording = false
    @Published var pendingMeetings: [MissedMeeting] = []

    private let appVersion = "0.1.0"
    private let captureController = LocalRecordingCaptureController()
    private let credentialStore: LocalRecorderKeychainCredentialStore
    private let deviceIdStore = DeviceIdStore()
    private let notificationCenter = UNUserNotificationCenter.current()
    private let uploadQueue: LocalRecordingUploadQueue
    private var activeClient: LocalRecorderAPIClient?
    private var isUploadingQueuedRecordings = false
    private var monitoringTimer: Timer?

    override init() {
        let credentialStore = LocalRecorderKeychainCredentialStore()
        let credentials = try? credentialStore.load()
        self.credentialStore = credentialStore
        self.uploadQueue = LocalRecordingUploadQueue(
            directoryURL: LocalRecorderFileLocations.uploadQueueDirectoryURL()
        )
        self.serverURLText = credentials?.serverURLText ?? Self.defaultServerURLText
        self.bearerToken = credentials?.bearerToken ?? ""
        super.init()
        notificationCenter.delegate = self
        if !bearerToken.isEmpty {
            statusText = "Grant permissions to start monitoring"
            Task {
                await retryQueuedUploadsIfPossible()
            }
        }
    }

    var menuBarImage: String {
        isRecording ? "record.circle.fill" : "waveform"
    }

    var canMonitor: Bool {
        !bearerToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            permissionChecklist.canMonitor
    }

    func signIn() {
        guard let serverURL = URL(string: serverURLText) else {
            statusText = "Enter a valid server URL"
            return
        }

        var components = URLComponents(
            url: serverURL.appending(path: "/api/local-recorder/device-login"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "deviceId", value: deviceIdStore.deviceId),
            URLQueryItem(name: "callbackUrl", value: "meetingnote-local-recorder://login"),
        ]

        if let url = components?.url {
            NSWorkspace.shared.open(url)
            statusText = "Complete login in your browser"
        }
    }

    func handleLoginCallback(_ url: URL) {
        do {
            let callback = try LocalRecorderLoginCallback(url: url)
            serverURLText = callback.serverURL.absoluteString
            bearerToken = callback.token
            try credentialStore.save(
                LocalRecorderCredentials(
                    serverURLText: callback.serverURL.absoluteString,
                    bearerToken: callback.token
                )
            )
            statusText = "Grant permissions to start monitoring"
            requestPermissions()
        } catch {
            statusText = "Could not finish login"
        }
    }

    private func makeClient() -> LocalRecorderAPIClient? {
        guard let serverURL = URL(string: serverURLText) else {
            return nil
        }

        return LocalRecorderAPIClient(
            serverURL: serverURL,
            bearerToken: bearerToken,
            deviceId: deviceIdStore.deviceId
        )
    }

    private func retryQueuedUploadsIfPossible() async {
        guard let client = makeClient() else {
            return
        }

        await uploadQueuedRecordings(client: client)
    }

    private func uploadQueuedRecordings(client: LocalRecorderAPIClient) async {
        guard !isUploadingQueuedRecordings else {
            return
        }

        let queuedPayloads: [LocalRecordingUploadPayload]
        do {
            queuedPayloads = try uploadQueue.load()
        } catch {
            statusText = "Could not read saved recordings"
            return
        }

        guard !queuedPayloads.isEmpty else {
            return
        }

        isUploadingQueuedRecordings = true
        defer {
            isUploadingQueuedRecordings = false
        }

        statusText = "Uploading saved recordings"
        for payload in queuedPayloads {
            do {
                try await uploadWithRetry(client: client, payload: payload)
                try uploadQueue.remove(clientRecordingId: payload.clientRecordingId)
                cleanupRecordingFiles(for: payload)
            } catch {
                statusText = "Could not upload saved recording"
                return
            }
        }

        statusText = "Saved recordings uploaded"
    }

    private func cleanupRecordingFiles(for payload: LocalRecordingUploadPayload) {
        try? FileManager.default.removeItem(
            at: payload.computerAudioURL.deletingLastPathComponent()
        )
    }

    func requestPermissions() {
        Task {
            let microphone = await requestMicrophonePermission()
            let notifications = await requestNotificationPermission()
            let screenCapture = requestScreenCapturePermission()

            permissionChecklist = PermissionChecklist(
                microphone: microphone,
                screenCapture: screenCapture,
                notifications: notifications,
                startAtLogin: configureStartAtLogin()
            )
            if permissionChecklist.canMonitor {
                startMonitoring()
            } else {
                statusText = "Permissions needed before monitoring"
            }
        }
    }

    func startRecording() {
        startRecording(fallbackIntentId: nil)
    }

    func startRecording(fallbackIntentId: String?) {
        let meeting = fallbackIntentId
            .flatMap { intentId in
                pendingMeetings.first { $0.fallbackIntentId == intentId }
            } ?? pendingMeetings.first
        guard let intentId = fallbackIntentId ?? meeting?.fallbackIntentId else {
            statusText = "No pending fallback meeting"
            return
        }
        let title = meeting?.title ?? "meeting"

        Task {
            await claimAndStart(fallbackIntentId: intentId, title: title)
        }
    }

    func checkNow() {
        guard canMonitor else {
            statusText = "Login and permissions are needed first"
            return
        }

        guard let serverURL = URL(string: serverURLText) else {
            statusText = "Enter a valid server URL"
            return
        }

        Task {
            do {
                let client = LocalRecorderAPIClient(
                    serverURL: serverURL,
                    bearerToken: bearerToken,
                    deviceId: deviceIdStore.deviceId
                )
                await uploadQueuedRecordings(client: client)
                pendingMeetings = try await client.fetchMissedMeetings()
                statusText = pendingMeetings.isEmpty
                    ? "No missed bot meetings"
                    : "Fallback recording available"
                if let first = pendingMeetings.first {
                    try await notify(meeting: first)
                }
            } catch {
                statusText = "Could not check missed meetings"
            }
        }
    }

    private func startMonitoring() {
        monitoringTimer?.invalidate()
        statusText = "Monitoring missed bot joins"
        checkNow()
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkNow()
            }
        }
    }

    private func claimAndStart(fallbackIntentId: String, title: String) async {
        guard let serverURL = URL(string: serverURLText) else {
            statusText = "Enter a valid server URL"
            return
        }

        do {
            let client = LocalRecorderAPIClient(
                serverURL: serverURL,
                bearerToken: bearerToken,
                deviceId: deviceIdStore.deviceId
            )
            let claim = try await client.claimIntent(fallbackIntentId: fallbackIntentId)

            guard claim.claimed else {
                statusText = claimFailureStatus(reason: claim.reason)
                return
            }

            do {
                try await captureController.start(
                    fallbackIntentId: fallbackIntentId,
                    appVersion: appVersion
                )
            } catch {
                try? await client.failIntent(
                    fallbackIntentId: fallbackIntentId,
                    errorMessage: error.localizedDescription
                )
                statusText = "Could not start recording"
                return
            }
            activeClient = client
            isRecording = true
            statusText = "Recording \(claim.meetingTitle ?? title)"
        } catch {
            statusText = "Could not start recording"
        }
    }

    private func notify(meeting: MissedMeeting) async throws {
        let content = UNMutableNotificationContent()
        content.title = "Bot did not join"
        content.body = "Start local recording for \(meeting.title)?"
        content.sound = .default
        content.userInfo = ["fallbackIntentId": meeting.fallbackIntentId]
        let request = UNNotificationRequest(
            identifier: meeting.fallbackIntentId,
            content: content,
            trigger: nil
        )

        try await notificationCenter.add(request)
    }

    func stopRecording() {
        guard isRecording else {
            statusText = "No active recording"
            return
        }

        statusText = "Stopping recording"
        Task {
            do {
                let result = try await captureController.stop()
                isRecording = false
                statusText = "Uploading recording"
                guard let client = activeClient else {
                    throw LocalRecorderAPIError.invalidResponse
                }

                try uploadQueue.save(result.payload)
                try await uploadWithRetry(
                    client: client,
                    payload: result.payload
                )
                try uploadQueue.remove(clientRecordingId: result.payload.clientRecordingId)
                try? FileManager.default.removeItem(at: result.cleanupDirectoryURL)
                activeClient = nil
                statusText = "Recording uploaded"
            } catch {
                isRecording = false
                activeClient = nil
                statusText = "Could not upload recording. Files kept locally."
            }
        }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let fallbackIntentId = response.notification.request.content
            .userInfo["fallbackIntentId"] as? String

        Task { @MainActor in
            self.startRecording(fallbackIntentId: fallbackIntentId)
        }
        completionHandler()
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }

    private func claimFailureStatus(reason: String?) -> String {
        switch reason {
        case "already_recording":
            return "Another user is already recording"
        case "no_longer_eligible":
            return "Bot recording is available"
        case "expired_or_missing":
            return "Recording window expired"
        default:
            return "Could not start recording"
        }
    }

    private func requestMicrophonePermission() async -> PermissionGrant {
        await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted ? .granted : .denied)
            }
        }
    }

    private func requestNotificationPermission() async -> PermissionGrant {
        do {
            let granted = try await notificationCenter.requestAuthorization(options: [.alert, .sound])
            return granted ? .granted : .denied
        } catch {
            return .denied
        }
    }

    private func requestScreenCapturePermission() -> PermissionGrant {
        if CGPreflightScreenCaptureAccess() {
            return .granted
        }

        return CGRequestScreenCaptureAccess() ? .granted : .denied
    }

    private func configureStartAtLogin() -> PermissionGrant {
        do {
            try SMAppService.mainApp.register()
            return .granted
        } catch {
            return .denied
        }
    }

    private func uploadWithRetry(
        client: LocalRecorderAPIClient,
        payload: LocalRecordingUploadPayload
    ) async throws {
        var payload = payload
        var lastError: Error?

        for attempt in 1...3 {
            do {
                payload = try await uploadOnce(client: client, payload: payload)
                return
            } catch {
                lastError = error
                if attempt < 3 {
                    try await Task.sleep(for: .seconds(5))
                }
            }
        }

        throw lastError ?? LocalRecorderAPIError.invalidResponse
    }

    private func uploadOnce(
        client: LocalRecorderAPIClient,
        payload: LocalRecordingUploadPayload
    ) async throws -> LocalRecordingUploadPayload {
        var payload = payload

        if payload.uploadAssets != nil {
            do {
                _ = try await client.completeRecordingUpload(payload: payload)
                return payload
            } catch LocalRecorderAPIError.httpStatus(409) {
                payload.uploadAssets = nil
                try uploadQueue.save(payload)
            }
        }

        let preparedUpload = try await client.prepareRecordingUpload(payload: payload)
        payload.uploadAssets = preparedUpload.assets.assetIds
        try uploadQueue.save(payload)
        try await client.uploadPreparedRecordingAssets(
            payload: payload,
            preparedUpload: preparedUpload
        )

        do {
            _ = try await client.completeRecordingUpload(payload: payload)
            return payload
        } catch LocalRecorderAPIError.httpStatus(409) {
            payload.uploadAssets = nil
            try uploadQueue.save(payload)
            throw LocalRecorderAPIError.httpStatus(409)
        }
    }
}

struct RecorderMenuView: View {
    @ObservedObject var model: RecorderAppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Meeting Note Recorder")
                .font(.headline)

            Text(model.statusText)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            TextField("Server URL", text: $model.serverURLText)
                .textFieldStyle(.roundedBorder)

            SecureField("Device token", text: $model.bearerToken)
                .textFieldStyle(.roundedBorder)

            HStack {
                Button("Sign in", action: model.signIn)
                Button("Permissions", action: model.requestPermissions)
                Button("Check", action: model.checkNow)
            }

            Divider()

            if model.isRecording {
                Button("Stop recording", action: model.stopRecording)
            } else {
                Button("Start recording", action: model.startRecording)
                    .disabled(!model.canMonitor)
            }

            if !model.pendingMeetings.isEmpty {
                Divider()
                ForEach(model.pendingMeetings) { meeting in
                    Text(meeting.title)
                        .font(.subheadline)
                }
            }

            PermissionList(checklist: model.permissionChecklist)
        }
        .frame(width: 320)
        .padding(16)
    }
}

struct PermissionList: View {
    var checklist: PermissionChecklist

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
            PermissionRow(title: "Microphone", grant: checklist.microphone)
            PermissionRow(title: "Screen audio", grant: checklist.screenCapture)
            PermissionRow(title: "Notifications", grant: checklist.notifications)
            PermissionRow(title: "Start at login", grant: checklist.startAtLogin)
        }
    }
}

struct PermissionRow: View {
    var title: String
    var grant: PermissionGrant

    var body: some View {
        GridRow {
            Text(title)
            Text(label)
                .foregroundStyle(grant == .granted ? .green : .secondary)
        }
    }

    private var label: String {
        switch grant {
        case .unknown:
            return "Not checked"
        case .granted:
            return "Ready"
        case .denied:
            return "Needed"
        }
    }
}

struct DeviceIdStore {
    private let defaultsKey = "meeting-note-local-recorder-device-id"

    var deviceId: String {
        if let existing = UserDefaults.standard.string(forKey: defaultsKey) {
            return existing
        }

        let value = UUID().uuidString
        UserDefaults.standard.set(value, forKey: defaultsKey)
        return value
    }
}
