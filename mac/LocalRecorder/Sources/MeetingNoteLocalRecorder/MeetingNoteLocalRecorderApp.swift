import AppKit
import AVFoundation
import Foundation
import LocalRecorderCore
import ServiceManagement
import SwiftUI
import UserNotifications

@MainActor
private let externalURLDispatcher = LocalRecorderExternalURLDispatcher()

private final class LocalRecorderAppDelegate: NSObject, NSApplicationDelegate {
    func application(_ application: NSApplication, open urls: [URL]) {
        Task { @MainActor in
            externalURLDispatcher.openURLs(urls)
        }
    }
}

enum RecorderPermissionStep {
    case microphone
    case systemAudio
    case alerts

    var actionTitle: String {
        switch self {
        case .microphone:
            return "Grant microphone"
        case .systemAudio:
            return "Enable system audio"
        case .alerts:
            return "Allow alerts"
        }
    }

    var statusTitle: String {
        switch self {
        case .microphone:
            return "Microphone needed"
        case .systemAudio:
            return "System audio needed"
        case .alerts:
            return "Alerts needed"
        }
    }

    var statusDetail: String {
        switch self {
        case .microphone:
            return "Step 1 of 3"
        case .alerts:
            return "Step 2 of 3"
        case .systemAudio:
            return "Step 3 of 3"
        }
    }

    var systemImage: String {
        switch self {
        case .microphone:
            return "mic.badge.plus"
        case .systemAudio:
            return "speaker.wave.2"
        case .alerts:
            return "bell.badge"
        }
    }
}

@main
struct MeetingNoteLocalRecorderApp: App {
    @NSApplicationDelegateAdaptor(LocalRecorderAppDelegate.self) private var appDelegate
    @StateObject private var model = RecorderAppModel()

    var body: some Scene {
        MenuBarExtra("Meeting Note Recorder", systemImage: model.menuBarImage) {
            RecorderMenuView(model: model)
        }
        .menuBarExtraStyle(.window)
    }
}

@MainActor
final class RecorderAppModel: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    private static let audioLevelSampleCount = 36
    private static let defaultServerURLText = "https://meeting-note-swart.vercel.app"

    @Published var audioLevels = Array(repeating: Float(0), count: audioLevelSampleCount)
    @Published var activeRecordingTitle: String?
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
    @Published var isAdvancedExpanded = false
    @Published var nextScheduleMeeting: LocalRecorderMonitoringMeeting?
    @Published var pendingMeetings: [MissedMeeting] = []

    private let appVersion = "0.1.0"
    private let captureController = LocalRecordingCaptureController()
    private let credentialStore: LocalRecorderKeychainCredentialStore
    private let deviceIdStore = DeviceIdStore()
    private let notificationCenter = UNUserNotificationCenter.current()
    private let uploadQueue: LocalRecordingUploadQueue
    private var activeClient: LocalRecorderAPIClient?
    private var isUploadingQueuedRecordings = false
    private var isSilencePromptVisible = false
    private var appActivationObserver: NSObjectProtocol?
    private var monitoringTimer: Timer?
    private var permissionRefreshTask: Task<Void, Never>?
    private var silencePromptTracker = SilencePromptTracker()

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
        externalURLDispatcher.setHandler { [weak self] url in
            self?.handleLoginCallback(url)
        }
        notificationCenter.delegate = self
        appActivationObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                await self?.refreshPermissionsAndStartIfReady()
            }
        }
        if !bearerToken.isEmpty {
            statusText = "Grant permissions to start monitoring"
            Task {
                await refreshPermissionsAndStartIfReady()
                await retryQueuedUploadsIfPossible()
            }
        } else {
            Task {
                await refreshPermissions()
            }
        }
    }

    var menuBarImage: String {
        isRecording ? "record.circle.fill" : "waveform"
    }

    var isSignedIn: Bool {
        !bearerToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var hasRequiredPermissions: Bool {
        permissionChecklist.microphone == .granted &&
            permissionChecklist.screenCapture == .granted
    }

    var nextPermissionStep: RecorderPermissionStep? {
        if permissionChecklist.microphone != .granted {
            return .microphone
        }
        if permissionChecklist.notifications != .granted {
            return .alerts
        }
        if permissionChecklist.screenCapture != .granted {
            return .systemAudio
        }
        return nil
    }

    var canMonitor: Bool {
        isSignedIn &&
            hasRequiredPermissions &&
            permissionChecklist.notifications == .granted
    }

    func signIn() {
        guard let serverURL = URL(string: serverURLText) else {
            statusText = "Enter a valid server URL"
            return
        }

        guard
            let url = makeLocalRecorderBrowserLoginURL(
                serverURL: serverURL,
                deviceId: deviceIdStore.deviceId
            )
        else {
            statusText = "Enter a valid server URL"
            return
        }

        NSWorkspace.shared.open(url)
        statusText = "Complete login in your browser"
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
            Task {
                await refreshPermissions()
                if canMonitor {
                    startMonitoring()
                }
            }
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
        requestNextPermission()
    }

    func requestNextPermission() {
        Task {
            await refreshPermissions()

            switch nextPermissionStep {
            case .microphone:
                let microphonePermission = await requestMicrophonePermission()
                permissionChecklist = PermissionChecklist(
                    microphone: microphonePermission,
                    screenCapture: permissionChecklist.screenCapture,
                    notifications: permissionChecklist.notifications,
                    startAtLogin: permissionChecklist.startAtLogin
                )
                statusText = microphonePermission == .granted
                    ? "Microphone ready"
                    : "Microphone access needed"
            case .systemAudio:
                let screenCapturePermission = requestScreenCapturePermission()
                permissionChecklist = PermissionChecklist(
                    microphone: permissionChecklist.microphone,
                    screenCapture: screenCapturePermission,
                    notifications: permissionChecklist.notifications,
                    startAtLogin: permissionChecklist.startAtLogin
                )
                statusText = screenCapturePermission == .granted
                    ? "System audio ready"
                    : "System audio access needed"
            case .alerts:
                if permissionChecklist.notifications == .denied {
                    openNotificationSettings()
                    statusText = "Enable alerts in Settings"
                } else {
                    let notificationPermission = await requestNotificationPermission()
                    permissionChecklist = PermissionChecklist(
                        microphone: permissionChecklist.microphone,
                        screenCapture: permissionChecklist.screenCapture,
                        notifications: notificationPermission,
                        startAtLogin: permissionChecklist.startAtLogin
                    )
                    statusText = notificationPermission == .granted
                        ? "Alerts ready"
                        : "Alerts access needed"
                }
            case nil:
                statusText = "Permissions ready"
            }

            await refreshPermissions()
            if canMonitor {
                startMonitoring()
            }
        }
    }

    func startRecording() {
        startRecording(fallbackIntentId: nil)
    }

    func startRecording(fallbackIntentId: String?) {
        guard canMonitor else {
            statusText = "Login and permissions are needed first"
            return
        }

        let meeting = fallbackIntentId
            .flatMap { intentId in
                pendingMeetings.first { $0.fallbackIntentId == intentId }
            } ?? pendingMeetings.first

        if let intentId = fallbackIntentId ?? meeting?.fallbackIntentId {
            let title = meeting?.title ?? "meeting"
            Task {
                await claimAndStart(fallbackIntentId: intentId, title: title)
            }
        } else {
            Task {
                await createManualIntentAndStart()
            }
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
                let monitoringStatus = try await client.fetchMonitoringStatus()
                nextScheduleMeeting = monitoringStatus.nextMeeting
                pendingMeetings = monitoringStatus.missedMeetings.isEmpty
                    ? pendingMeetings.filter { $0.expiresAt > Date() }
                    : monitoringStatus.missedMeetings
                statusText = nextScheduleMeeting == nil
                    ? "No upcoming meetings"
                    : "Monitoring schedule"
                if let first = pendingMeetings.first {
                    try await notify(meeting: first)
                }
            } catch {
                statusText = "Could not refresh schedule"
            }
        }
    }

    private func startMonitoring() {
        monitoringTimer?.invalidate()
        statusText = "Monitoring schedule"
        checkNow()
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: 60 * 60, repeats: true) { [weak self] _ in
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

            await startCapture(
                client: client,
                fallbackIntentId: fallbackIntentId,
                title: claim.meetingTitle ?? title
            )
        } catch {
            statusText = "Could not start recording"
        }
    }

    private func createManualIntentAndStart() async {
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
            let intent = try await client.createManualIntent()
            await startCapture(
                client: client,
                fallbackIntentId: intent.fallbackIntentId,
                title: intent.meetingTitle ?? "Manual recording"
            )
        } catch {
            statusText = "Could not start recording"
        }
    }

    private func startCapture(
        client: LocalRecorderAPIClient,
        fallbackIntentId: String,
        title: String
    ) async {
        do {
            silencePromptTracker = SilencePromptTracker()
            audioLevels = Array(repeating: 0, count: Self.audioLevelSampleCount)
            try await captureController.start(
                fallbackIntentId: fallbackIntentId,
                appVersion: appVersion,
                onAudioLevel: { [weak self] level in
                    Task { @MainActor in
                        self?.observeAudioLevel(level)
                    }
                }
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
        activeRecordingTitle = title
        isRecording = true
        statusText = "Recording \(title)"
    }

    private func observeAudioLevel(_ level: Float) {
        guard isRecording else {
            return
        }

        audioLevels.append(max(0, min(1, level * 16)))
        if audioLevels.count > Self.audioLevelSampleCount {
            audioLevels.removeFirst(audioLevels.count - Self.audioLevelSampleCount)
        }

        if silencePromptTracker.observe(level: level) == .prompt {
            showSilencePrompt()
        }
    }

    private func showSilencePrompt() {
        guard isRecording, !isSilencePromptVisible else {
            return
        }

        isSilencePromptVisible = true
        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "Meeting ended?"
        alert.informativeText = "The recording has been silent for 1 minute. End this meeting recording?"
        alert.addButton(withTitle: "End recording")
        alert.addButton(withTitle: "Keep recording")

        NSApp.activate(ignoringOtherApps: true)
        let response = alert.runModal()
        isSilencePromptVisible = false

        guard isRecording else {
            silencePromptTracker.finishAfterPrompt()
            return
        }

        if response == .alertFirstButtonReturn {
            silencePromptTracker.finishAfterPrompt()
            stopRecording()
        } else {
            silencePromptTracker.dismissPrompt()
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
        silencePromptTracker.finishAfterPrompt()
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
                activeRecordingTitle = nil
                audioLevels = Array(repeating: 0, count: Self.audioLevelSampleCount)
                statusText = "Recording uploaded"
            } catch {
                isRecording = false
                activeClient = nil
                activeRecordingTitle = nil
                audioLevels = Array(repeating: 0, count: Self.audioLevelSampleCount)
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

    func checkForUpdates() {
        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "No updater configured"
        alert.informativeText = "This local recorder build is version \(appVersion)."
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    func signOut() {
        guard canCloseApp() else {
            return
        }

        monitoringTimer?.invalidate()
        monitoringTimer = nil
        permissionRefreshTask?.cancel()
        permissionRefreshTask = nil
        activeClient = nil
        activeRecordingTitle = nil
        audioLevels = Array(repeating: 0, count: Self.audioLevelSampleCount)
        nextScheduleMeeting = nil
        pendingMeetings = []
        bearerToken = ""
        try? credentialStore.delete()
        statusText = "Signed out"
    }

    func restartApp() {
        guard canCloseApp() else {
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        process.arguments = ["-n", Bundle.main.bundleURL.path]
        try? process.run()
        NSApp.terminate(nil)
    }

    func exitApp() {
        guard canCloseApp() else {
            return
        }

        NSApp.terminate(nil)
    }

    private func canCloseApp() -> Bool {
        guard !isRecording else {
            let alert = NSAlert()
            alert.alertStyle = .warning
            alert.messageText = "Recording is active"
            alert.informativeText = "Stop recording before closing the recorder."
            alert.addButton(withTitle: "OK")
            alert.runModal()
            return false
        }

        return true
    }

    private func refreshPermissions() async {
        permissionChecklist = PermissionChecklist(
            microphone: currentMicrophonePermission(),
            screenCapture: currentScreenCapturePermission(),
            notifications: await currentNotificationPermission(),
            startAtLogin: currentStartAtLoginPermission()
        )
    }

    private func refreshPermissionsAndStartIfReady() async {
        await refreshPermissions()
        if canMonitor {
            startMonitoring()
        }
    }

    private func requestMicrophonePermission() async -> PermissionGrant {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            return .granted
        case .denied, .restricted:
            return .denied
        case .notDetermined:
            break
        @unknown default:
            return .denied
        }

        return await withCheckedContinuation { (continuation: CheckedContinuation<PermissionGrant, Never>) in
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
        if currentScreenCapturePermission() == .granted {
            return .granted
        }

        return CGRequestScreenCaptureAccess() ? .granted : currentScreenCapturePermission()
    }

    private func openNotificationSettings() {
        let urls = [
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
            "x-apple.systempreferences:com.apple.preference.notifications",
        ]

        for value in urls {
            guard let url = URL(string: value) else {
                continue
            }

            if NSWorkspace.shared.open(url) {
                refreshPermissionsAfterSettingsOpen()
                return
            }
        }
    }

    private func refreshPermissionsAfterSettingsOpen() {
        permissionRefreshTask?.cancel()
        permissionRefreshTask = Task { @MainActor in
            for _ in 0..<30 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else {
                    return
                }

                await refreshPermissionsAndStartIfReady()
                if permissionChecklist.notifications == .granted {
                    return
                }
            }
        }
    }

    private func currentScreenCapturePermission() -> PermissionGrant {
        CGPreflightScreenCaptureAccess() ? .granted : .denied
    }

    private func currentMicrophonePermission() -> PermissionGrant {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            return .granted
        case .notDetermined:
            return .unknown
        case .denied, .restricted:
            return .denied
        @unknown default:
            return .denied
        }
    }

    private func currentNotificationPermission() async -> PermissionGrant {
        let settings = await notificationCenter.notificationSettings()

        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return .granted
        case .notDetermined:
            return .unknown
        case .denied:
            return .denied
        @unknown default:
            return .denied
        }
    }

    private func currentStartAtLoginPermission() -> PermissionGrant {
        switch SMAppService.mainApp.status {
        case .enabled:
            return .granted
        case .notRegistered:
            return .unknown
        case .requiresApproval, .notFound:
            return .denied
        @unknown default:
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
            header
            statusPanel

            if model.isRecording {
                RecordingWaveformView(
                    samples: model.audioLevels,
                    title: model.activeRecordingTitle ?? "Recording"
                )
            }

            Button(action: performPrimaryAction) {
                Label(primaryActionTitle, systemImage: primaryActionIcon)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            advancedSection
        }
        .frame(width: 360)
        .padding(16)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Meeting Note")
                    .font(.headline)
                Text("Local recorder")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Circle()
                .fill(statusColor)
                .frame(width: 10, height: 10)
                .accessibilityLabel(headlineStatus)
        }
    }

    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(headlineStatus)
                    .font(.title3.weight(.semibold))
                Spacer()
                if isSignedIn, model.nextPermissionStep == nil {
                    Button(action: model.checkNow) {
                        Image(systemName: "arrow.clockwise")
                            .frame(width: 18, height: 18)
                    }
                    .buttonStyle(.plain)
                    .disabled(!model.canMonitor)
                    .help("Refresh schedule")
                }
            }

            if let meeting = model.nextScheduleMeeting,
               model.nextPermissionStep == nil,
               isSignedIn {
                MonitoringMeetingView(meeting: meeting)
            } else {
                Text(supportingStatus)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
    }

    private var advancedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: { model.isAdvancedExpanded.toggle() }) {
                HStack(spacing: 6) {
                    Image(systemName: model.isAdvancedExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption)
                        .frame(width: 12)
                    Text("Advanced")
                    Spacer()
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if model.isAdvancedExpanded {
                advancedContent
            }
        }
    }

    private var advancedContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button("Permissions", action: model.requestNextPermission)
                .controlSize(.small)

            PermissionList(checklist: model.permissionChecklist)

            Divider()

            VStack(alignment: .leading, spacing: 12) {
                TextField("Server", text: $model.serverURLText)
                    .textFieldStyle(.roundedBorder)
                SecureField("Token", text: $model.bearerToken)
                    .textFieldStyle(.roundedBorder)
                if isSignedIn {
                    Button("Sign out", role: .destructive, action: model.signOut)
                        .controlSize(.small)
                }
            }

            Divider()

            HStack(spacing: 8) {
                Button("Check for Updates", action: model.checkForUpdates)
                Button("Restart", action: model.restartApp)
                Button("Exit", role: .destructive, action: model.exitApp)
            }
            .controlSize(.small)
        }
        .padding(.top, 2)
    }

    private var primaryMeeting: MissedMeeting? {
        model.pendingMeetings.first
    }

    private var isSignedIn: Bool {
        !model.bearerToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var headlineStatus: String {
        if model.isRecording {
            return "Recording"
        }
        if let nextPermissionStep = model.nextPermissionStep {
            return nextPermissionStep.statusTitle
        }
        if !isSignedIn {
            return "Signed out"
        }
        if primaryMeeting != nil {
            return "Monitoring"
        }
        if model.canMonitor {
            return "Monitoring"
        }
        if model.statusText.localizedCaseInsensitiveContains("upload") {
            return model.statusText.localizedCaseInsensitiveContains("could not") ? "Upload issue" : "Uploading"
        }
        return "Monitoring"
    }

    private var supportingStatus: String {
        if model.isRecording {
            return "Audio capture is active"
        }
        if let nextPermissionStep = model.nextPermissionStep {
            return nextPermissionStep.statusDetail
        }
        if !isSignedIn {
            return "Connect your account"
        }
        if primaryMeeting != nil {
            return "Missed meeting found"
        }
        if model.canMonitor {
            return model.statusText
        }
        if model.statusText == "No upcoming meetings" {
            return "No upcoming meetings"
        }
        return model.statusText
    }

    private var statusColor: Color {
        if model.isRecording {
            return .red
        }
        if model.nextPermissionStep != nil || !isSignedIn {
            return .orange
        }
        if primaryMeeting != nil {
            return .green
        }
        if model.canMonitor {
            return .green
        }
        return .secondary
    }

    private var primaryActionTitle: String {
        if model.isRecording {
            return "End recording"
        }
        if let nextPermissionStep = model.nextPermissionStep {
            if case .alerts = nextPermissionStep,
               model.permissionChecklist.notifications == .denied {
                return "Open Alerts Settings"
            }
            return nextPermissionStep.actionTitle
        }
        if !isSignedIn {
            return "Sign in"
        }
        return "Record"
    }

    private var primaryActionIcon: String {
        if model.isRecording {
            return "stop.fill"
        }
        if let nextPermissionStep = model.nextPermissionStep {
            return nextPermissionStep.systemImage
        }
        if !isSignedIn {
            return "person.crop.circle.badge.plus"
        }
        return "record.circle"
    }

    private func performPrimaryAction() {
        if model.isRecording {
            model.stopRecording()
        } else if model.nextPermissionStep != nil {
            model.requestNextPermission()
        } else if !isSignedIn {
            model.signIn()
        } else {
            model.startRecording()
        }
    }
}

struct RecordingWaveformView: View {
    var samples: [Float]
    var title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Label("Recording", systemImage: "waveform")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.red)
                Spacer()
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            HStack(alignment: .center, spacing: 3) {
                ForEach(Array(samples.enumerated()), id: \.offset) { _, sample in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(.red.opacity(0.75))
                        .frame(
                            width: 6,
                            height: max(4, CGFloat(sample) * 44)
                        )
                }
            }
            .frame(maxWidth: .infinity, minHeight: 52, maxHeight: 52)
            .padding(.horizontal, 8)
            .background(.background, in: RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(.quaternary)
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct MonitoringMeetingView: View {
    var meeting: LocalRecorderMonitoringMeeting

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(meeting.title)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
                .truncationMode(.tail)

            HStack(spacing: 8) {
                Label(timeText, systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text(meeting.botStatusLabel)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(statusColor)
                    .lineLimit(1)
            }

            Text(meeting.botStatusDetail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var statusColor: Color {
        switch meeting.botStatus {
        case "joined", "recording":
            return .green
        case "in_meeting_room":
            return .blue
        case "failed", "cancelled", "not_planned":
            return .orange
        default:
            return .secondary
        }
    }

    private var timeText: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short

        let startsAt = formatter.string(from: meeting.startsAt)
        guard let endsAt = meeting.endsAt else {
            return startsAt
        }

        return "\(startsAt) to \(formatter.string(from: endsAt))"
    }
}

struct PermissionList: View {
    var checklist: PermissionChecklist

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            PermissionRow(title: "Microphone", detail: "Required", grant: checklist.microphone)
            PermissionRow(title: "System audio", detail: "Required", grant: checklist.screenCapture)
            PermissionRow(title: "Alerts", detail: "Recommended", grant: checklist.notifications)
            PermissionRow(title: "Start at login", detail: "Optional", grant: checklist.startAtLogin)
        }
    }
}

struct PermissionRow: View {
    var title: String
    var detail: String
    var grant: PermissionGrant

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: iconName)
                .foregroundStyle(iconColor)
                .frame(width: 16)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.subheadline)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(label)
                .font(.caption)
                .foregroundStyle(iconColor)
        }
    }

    private var iconName: String {
        switch grant {
        case .unknown:
            return "circle"
        case .granted:
            return "checkmark.circle.fill"
        case .denied:
            return "exclamationmark.circle.fill"
        }
    }

    private var iconColor: Color {
        switch grant {
        case .unknown:
            return .secondary
        case .granted:
            return .green
        case .denied:
            return .orange
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
