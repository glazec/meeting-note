import Foundation

public enum PermissionGrant: Sendable {
    case unknown
    case granted
    case denied
}

public enum PermissionSetupState: Sendable {
    case ready
    case blocked
    case degraded
}

public struct PermissionChecklist: Sendable, Equatable {
    public var microphone: PermissionGrant
    public var screenCapture: PermissionGrant
    public var notifications: PermissionGrant
    public var startAtLogin: PermissionGrant

    public init(
        microphone: PermissionGrant,
        screenCapture: PermissionGrant,
        notifications: PermissionGrant,
        startAtLogin: PermissionGrant
    ) {
        self.microphone = microphone
        self.screenCapture = screenCapture
        self.notifications = notifications
        self.startAtLogin = startAtLogin
    }

    public var canMonitor: Bool {
        microphone == .granted &&
            screenCapture == .granted &&
            notifications == .granted
    }

    public var setupState: PermissionSetupState {
        if !canMonitor {
            return .blocked
        }

        return startAtLogin == .granted ? .ready : .degraded
    }
}

public struct LocalRecorderAPIClient: Sendable {
    public var serverURL: URL
    public var bearerToken: String
    public var deviceId: String

    public init(serverURL: URL, bearerToken: String, deviceId: String) {
        self.serverURL = serverURL
        self.bearerToken = bearerToken
        self.deviceId = deviceId
    }

    public func missedMeetingsRequest() throws -> URLRequest {
        var request = URLRequest(
            url: serverURL.appending(path: "/api/local-recorder/missed-meetings")
        )
        request.httpMethod = "GET"
        applyRecorderHeaders(to: &request)
        return request
    }

    public func fetchMissedMeetings() async throws -> [MissedMeeting] {
        let (data, response) = try await URLSession.shared.data(
            for: missedMeetingsRequest()
        )
        try validateHTTPResponse(response)

        return try JSONDecoder.localRecorder
            .decode(MissedMeetingsResponse.self, from: data)
            .meetings
    }

    public func claimRequest(fallbackIntentId: String) throws -> URLRequest {
        var request = URLRequest(
            url: serverURL.appending(
                path: "/api/local-recorder/intents/\(fallbackIntentId)/start"
            )
        )
        request.httpMethod = "POST"
        applyRecorderHeaders(to: &request)
        return request
    }

    public func claimIntent(fallbackIntentId: String) async throws -> ClaimIntentResponse {
        let (data, response) = try await URLSession.shared.data(
            for: claimRequest(fallbackIntentId: fallbackIntentId)
        )
        try validateHTTPResponse(response)

        return try JSONDecoder.localRecorder.decode(ClaimIntentResponse.self, from: data)
    }

    private func applyRecorderHeaders(to request: inout URLRequest) {
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue(deviceId, forHTTPHeaderField: "x-local-recorder-device-id")
    }

    private func validateHTTPResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw LocalRecorderAPIError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw LocalRecorderAPIError.httpStatus(httpResponse.statusCode)
        }
    }
}

public enum LocalRecorderAPIError: Error, Equatable {
    case invalidResponse
    case httpStatus(Int)
}

public struct MissedMeetingsResponse: Codable, Equatable, Sendable {
    public var meetings: [MissedMeeting]
}

public struct MissedMeeting: Codable, Identifiable, Equatable, Sendable {
    public var fallbackIntentId: String
    public var title: String
    public var expiresAt: Date
    public var displayTimeWindow: DisplayTimeWindow

    public var id: String { fallbackIntentId }
}

public struct DisplayTimeWindow: Codable, Equatable, Sendable {
    public var startsAt: Date
    public var endsAt: Date?
}

public struct ClaimIntentResponse: Codable, Equatable, Sendable {
    public var claimed: Bool
    public var meetingTitle: String?
    public var reason: String?
}

public struct RecordingManifest: Codable, Equatable, Sendable {
    public var appVersion: String
    public var computerAudio: TrackMetadata
    public var microphoneAudio: TrackMetadata

    public init(
        appVersion: String,
        computerAudio: TrackMetadata,
        microphoneAudio: TrackMetadata
    ) {
        self.appVersion = appVersion
        self.computerAudio = computerAudio
        self.microphoneAudio = microphoneAudio
    }
}

public struct TrackMetadata: Codable, Equatable, Sendable {
    public var captureStartedAt: Date
    public var captureStoppedAt: Date
    public var sampleRate: Double
    public var channelCount: Int
    public var codec: String
    public var container: String
    public var firstSampleTime: Double

    public init(
        captureStartedAt: Date,
        captureStoppedAt: Date,
        sampleRate: Double,
        channelCount: Int,
        codec: String,
        container: String,
        firstSampleTime: Double
    ) {
        self.captureStartedAt = captureStartedAt
        self.captureStoppedAt = captureStoppedAt
        self.sampleRate = sampleRate
        self.channelCount = channelCount
        self.codec = codec
        self.container = container
        self.firstSampleTime = firstSampleTime
    }
}

public extension JSONEncoder {
    static var localRecorder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

public extension JSONDecoder {
    static var localRecorder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
