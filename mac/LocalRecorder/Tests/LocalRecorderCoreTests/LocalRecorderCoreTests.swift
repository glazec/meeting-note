import Foundation
import Testing
@testable import LocalRecorderCore

@Test func permissionChecklistRequiresRecordingAndNotifications() {
    let ready = PermissionChecklist(
        microphone: .granted,
        screenCapture: .granted,
        notifications: .granted,
        startAtLogin: .denied
    )
    let blocked = PermissionChecklist(
        microphone: .granted,
        screenCapture: .denied,
        notifications: .granted,
        startAtLogin: .granted
    )

    #expect(ready.canMonitor)
    #expect(!blocked.canMonitor)
    #expect(ready.setupState == .degraded)
}

@Test func missedMeetingRequestIncludesBearerTokenAndDeviceId() throws {
    let client = LocalRecorderAPIClient(
        serverURL: URL(string: "https://app.example.com")!,
        bearerToken: "token_123",
        deviceId: "device_123"
    )
    let request = try client.missedMeetingsRequest()

    #expect(request.url?.absoluteString == "https://app.example.com/api/local-recorder/missed-meetings")
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer token_123")
    #expect(request.value(forHTTPHeaderField: "x-local-recorder-device-id") == "device_123")
}

@Test func decodesMissedMeetingResponse() throws {
    let data = """
    {
      "meetings": [
        {
          "fallbackIntentId": "intent_123",
          "title": "Weekly sync",
          "expiresAt": "2026-06-30T13:15:00.000Z",
          "displayTimeWindow": {
            "startsAt": "2026-06-30T12:00:00.000Z",
            "endsAt": "2026-06-30T13:00:00.000Z"
          }
        }
      ]
    }
    """.data(using: .utf8)!

    let response = try JSONDecoder.localRecorder.decode(MissedMeetingsResponse.self, from: data)

    #expect(response.meetings.first?.fallbackIntentId == "intent_123")
    #expect(response.meetings.first?.title == "Weekly sync")
}

@Test func recordingManifestKeepsSeparateTrackMetadata() throws {
    let manifest = RecordingManifest(
        appVersion: "0.1.0",
        computerAudio: .init(
            captureStartedAt: Date(timeIntervalSince1970: 10),
            captureStoppedAt: Date(timeIntervalSince1970: 20),
            sampleRate: 48_000,
            channelCount: 2,
            codec: "pcm_s16le",
            container: "wav",
            firstSampleTime: 0
        ),
        microphoneAudio: .init(
            captureStartedAt: Date(timeIntervalSince1970: 11),
            captureStoppedAt: Date(timeIntervalSince1970: 20),
            sampleRate: 48_000,
            channelCount: 1,
            codec: "pcm_s16le",
            container: "wav",
            firstSampleTime: 0
        )
    )
    let data = try JSONEncoder.localRecorder.encode(manifest)
    let decoded = try JSONDecoder.localRecorder.decode(RecordingManifest.self, from: data)

    #expect(decoded.computerAudio.channelCount == 2)
    #expect(decoded.microphoneAudio.channelCount == 1)
}

@Test func prepareUploadRequestBuildsJSONBodyForThreeAudioAssets() throws {
    let temporaryDirectory = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    try FileManager.default.createDirectory(
        at: temporaryDirectory,
        withIntermediateDirectories: true
    )
    defer {
        try? FileManager.default.removeItem(at: temporaryDirectory)
    }

    let computerAudioURL = temporaryDirectory.appending(path: "computer.wav")
    let microphoneAudioURL = temporaryDirectory.appending(path: "microphone.wav")
    let synthesizedAudioURL = temporaryDirectory.appending(path: "synthesized.wav")
    try Data("computer".utf8).write(to: computerAudioURL)
    try Data("microphone".utf8).write(to: microphoneAudioURL)
    try Data("synthesized".utf8).write(to: synthesizedAudioURL)

    let payload = LocalRecordingUploadPayload(
        fallbackIntentId: "intent_123",
        clientRecordingId: "recording_123",
        recordingStartedAt: Date(timeIntervalSince1970: 10),
        recordingStoppedAt: Date(timeIntervalSince1970: 20),
        computerAudioURL: computerAudioURL,
        microphoneAudioURL: microphoneAudioURL,
        synthesizedAudioURL: synthesizedAudioURL,
        manifest: RecordingManifest(
            appVersion: "0.1.0",
            computerAudio: .init(
                captureStartedAt: Date(timeIntervalSince1970: 10),
                captureStoppedAt: Date(timeIntervalSince1970: 20),
                sampleRate: 48_000,
                channelCount: 2,
                codec: "pcm_s16le",
                container: "wav",
                firstSampleTime: 0
            ),
            microphoneAudio: .init(
                captureStartedAt: Date(timeIntervalSince1970: 10),
                captureStoppedAt: Date(timeIntervalSince1970: 20),
                sampleRate: 48_000,
                channelCount: 1,
                codec: "pcm_s16le",
                container: "wav",
                firstSampleTime: 0
            )
        )
    )
    let client = LocalRecorderAPIClient(
        serverURL: URL(string: "https://app.example.com")!,
        bearerToken: "token_123",
        deviceId: "device_123"
    )
    let request = try client.prepareUploadRequest(payload: payload)
    let body = try #require(request.httpBody)
    let json = try JSONSerialization.jsonObject(with: body) as? [String: Any]

    #expect(request.url?.absoluteString == "https://app.example.com/api/local-recorder/recordings/prepare")
    #expect(request.httpMethod == "POST")
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer token_123")
    #expect(request.value(forHTTPHeaderField: "x-local-recorder-device-id") == "device_123")
    #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
    #expect(json?["fallbackIntentId"] as? String == "intent_123")
    #expect(json?["clientRecordingId"] as? String == "recording_123")
    #expect((json?["manifest"] as? [String: Any])?["appVersion"] as? String == "0.1.0")
}

@Test func completeUploadRequestIncludesPreparedAssetIds() throws {
    let payload = makeUploadPayload(
        clientRecordingId: "recording_123",
        recordingStartedAt: Date(timeIntervalSince1970: 10),
        directoryURL: FileManager.default.temporaryDirectory,
        uploadAssets: LocalRecordingUploadAssetIds(
            computerAudioAssetId: "asset_computer",
            microphoneAudioAssetId: "asset_microphone",
            synthesizedAudioAssetId: "asset_synthesized"
        )
    )
    let client = LocalRecorderAPIClient(
        serverURL: URL(string: "https://app.example.com")!,
        bearerToken: "token_123",
        deviceId: "device_123"
    )
    let request = try client.completeUploadRequest(payload: payload)
    let body = try #require(request.httpBody)
    let json = try JSONSerialization.jsonObject(with: body) as? [String: Any]
    let assets = json?["assets"] as? [String: String]

    #expect(request.url?.absoluteString == "https://app.example.com/api/local-recorder/recordings/complete")
    #expect(request.httpMethod == "POST")
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer token_123")
    #expect(request.value(forHTTPHeaderField: "x-local-recorder-device-id") == "device_123")
    #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
    #expect(assets?["computerAudioAssetId"] == "asset_computer")
    #expect(assets?["microphoneAudioAssetId"] == "asset_microphone")
    #expect(assets?["synthesizedAudioAssetId"] == "asset_synthesized")
}

@Test func loginCallbackParsesTokenAndServerURL() throws {
    let callback = try LocalRecorderLoginCallback(
        url: URL(
            string: "meetingnote-local-recorder://login?token=token_123&server=https%3A%2F%2Fapp.example.com"
        )!
    )

    #expect(callback.token == "token_123")
    #expect(callback.serverURL.absoluteString == "https://app.example.com")
}

@Test func loginCallbackRejectsUnexpectedScheme() {
    #expect(throws: LocalRecorderLoginCallbackError.self) {
        _ = try LocalRecorderLoginCallback(
            url: URL(string: "https://app.example.com/login?token=token_123")!
        )
    }
}

@Test func failIntentRequestIncludesRecorderHeadersAndReason() throws {
    let client = LocalRecorderAPIClient(
        serverURL: URL(string: "https://app.example.com")!,
        bearerToken: "token_123",
        deviceId: "device_123"
    )
    let request = try client.failIntentRequest(
        fallbackIntentId: "intent_123",
        errorMessage: "Screen recording denied"
    )
    let body = String(decoding: request.httpBody ?? Data(), as: UTF8.self)

    #expect(request.url?.absoluteString == "https://app.example.com/api/local-recorder/intents/intent_123/fail")
    #expect(request.httpMethod == "POST")
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer token_123")
    #expect(request.value(forHTTPHeaderField: "x-local-recorder-device-id") == "device_123")
    #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
    #expect(body.contains("Screen recording denied"))
}

@Test func keychainCredentialStoreSavesLoadsReplacesAndDeletes() throws {
    let store = LocalRecorderKeychainCredentialStore(
        service: "tech.inevitable.meeting-note.local-recorder.tests.\(UUID().uuidString)",
        account: "device-session"
    )
    defer {
        try? store.delete()
    }

    try store.save(
        LocalRecorderCredentials(
            serverURLText: "https://app.example.com",
            bearerToken: "token_123"
        )
    )
    #expect(
        try store.load() == LocalRecorderCredentials(
            serverURLText: "https://app.example.com",
            bearerToken: "token_123"
        )
    )

    try store.save(
        LocalRecorderCredentials(
            serverURLText: "https://app.example.com",
            bearerToken: "token_456"
        )
    )
    #expect(try store.load()?.bearerToken == "token_456")

    try store.delete()
    #expect(try store.load() == nil)
}

@Test func uploadQueuePersistsPayloadsOldestFirstAndRemovesThem() throws {
    let temporaryDirectory = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let queueDirectory = temporaryDirectory.appending(path: "queue", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(
        at: temporaryDirectory,
        withIntermediateDirectories: true
    )
    defer {
        try? FileManager.default.removeItem(at: temporaryDirectory)
    }

    let queue = LocalRecordingUploadQueue(directoryURL: queueDirectory)
    let newerPayload = makeUploadPayload(
        clientRecordingId: "recording_new",
        recordingStartedAt: Date(timeIntervalSince1970: 20),
        directoryURL: temporaryDirectory.appending(path: "new", directoryHint: .isDirectory)
    )
    let olderPayload = makeUploadPayload(
        clientRecordingId: "recording_old",
        recordingStartedAt: Date(timeIntervalSince1970: 10),
        directoryURL: temporaryDirectory.appending(path: "old", directoryHint: .isDirectory)
    )

    try queue.save(newerPayload)
    try queue.save(olderPayload)

    let queued = try queue.load()
    #expect(queued.map(\.clientRecordingId) == ["recording_old", "recording_new"])
    #expect(queued.first?.computerAudioURL == olderPayload.computerAudioURL)
    #expect(queued.first?.uploadAssets?.computerAudioAssetId == "asset_recording_old_computer")

    try queue.remove(clientRecordingId: "recording_old")
    #expect(try queue.load().map(\.clientRecordingId) == ["recording_new"])
}

private func makeUploadPayload(
    clientRecordingId: String,
    recordingStartedAt: Date,
    directoryURL: URL,
    uploadAssets: LocalRecordingUploadAssetIds? = nil
) -> LocalRecordingUploadPayload {
    LocalRecordingUploadPayload(
        fallbackIntentId: "intent_123",
        clientRecordingId: clientRecordingId,
        recordingStartedAt: recordingStartedAt,
        recordingStoppedAt: recordingStartedAt.addingTimeInterval(60),
        computerAudioURL: directoryURL.appending(path: "computer.wav"),
        microphoneAudioURL: directoryURL.appending(path: "microphone.wav"),
        synthesizedAudioURL: directoryURL.appending(path: "synthesized.wav"),
        uploadAssets: uploadAssets ?? LocalRecordingUploadAssetIds(
            computerAudioAssetId: "asset_\(clientRecordingId)_computer",
            microphoneAudioAssetId: "asset_\(clientRecordingId)_microphone",
            synthesizedAudioAssetId: "asset_\(clientRecordingId)_synthesized"
        ),
        manifest: RecordingManifest(
            appVersion: "0.1.0",
            computerAudio: .init(
                captureStartedAt: recordingStartedAt,
                captureStoppedAt: recordingStartedAt.addingTimeInterval(60),
                sampleRate: 48_000,
                channelCount: 2,
                codec: "pcm_s16le",
                container: "wav",
                firstSampleTime: 0
            ),
            microphoneAudio: .init(
                captureStartedAt: recordingStartedAt,
                captureStoppedAt: recordingStartedAt.addingTimeInterval(60),
                sampleRate: 48_000,
                channelCount: 1,
                codec: "pcm_s16le",
                container: "wav",
                firstSampleTime: 0
            )
        )
    )
}
