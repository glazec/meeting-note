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
