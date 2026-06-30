import Foundation
import Security

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

    public func failIntentRequest(
        fallbackIntentId: String,
        errorMessage: String
    ) throws -> URLRequest {
        var request = URLRequest(
            url: serverURL.appending(
                path: "/api/local-recorder/intents/\(fallbackIntentId)/fail"
            )
        )
        request.httpMethod = "POST"
        applyRecorderHeaders(to: &request)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.localRecorder.encode(
            FailIntentRequest(errorMessage: errorMessage)
        )
        return request
    }

    public func failIntent(
        fallbackIntentId: String,
        errorMessage: String
    ) async throws {
        let request = try failIntentRequest(
            fallbackIntentId: fallbackIntentId,
            errorMessage: errorMessage
        )
        let (_, response) = try await URLSession.shared.data(for: request)
        try validateHTTPResponse(response)
    }

    public func uploadRecordingRequest(
        payload: LocalRecordingUploadPayload,
        boundary: String? = nil
    ) throws -> URLRequest {
        let boundary = boundary ?? MultipartForm.boundary()
        var request = URLRequest(
            url: serverURL.appending(path: "/api/local-recorder/recordings")
        )
        request.httpMethod = "POST"
        applyRecorderHeaders(to: &request)
        request.setValue(
            "multipart/form-data; boundary=\(boundary)",
            forHTTPHeaderField: "Content-Type"
        )
        request.httpBody = try MultipartForm(boundary: boundary)
            .addingField(name: "fallbackIntentId", value: payload.fallbackIntentId)
            .addingField(name: "clientRecordingId", value: payload.clientRecordingId)
            .addingField(name: "recordingStartedAt", value: payload.recordingStartedAt.localRecorderISOString)
            .addingField(name: "recordingStoppedAt", value: payload.recordingStoppedAt.localRecorderISOString)
            .addingField(
                name: "manifest",
                value: String(
                    decoding: JSONEncoder.localRecorder.encode(payload.manifest),
                    as: UTF8.self
                )
            )
            .addingFile(
                name: "computerAudio",
                fileURL: payload.computerAudioURL,
                contentType: "audio/wav"
            )
            .addingFile(
                name: "microphoneAudio",
                fileURL: payload.microphoneAudioURL,
                contentType: "audio/wav"
            )
            .data()
        return request
    }

    public func uploadRecording(
        payload: LocalRecordingUploadPayload
    ) async throws -> LocalRecordingUploadResponse {
        let request = try uploadRecordingRequest(payload: payload)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validateHTTPResponse(response)

        return try JSONDecoder.localRecorder.decode(
            LocalRecordingUploadResponse.self,
            from: data
        )
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

public enum LocalRecorderLoginCallbackError: Error, Equatable {
    case invalidCallback
}

public struct LocalRecorderLoginCallback: Equatable, Sendable {
    public var serverURL: URL
    public var token: String

    public init(url: URL) throws {
        guard
            url.scheme == "meetingnote-local-recorder",
            url.host == "login",
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            throw LocalRecorderLoginCallbackError.invalidCallback
        }

        let queryItems = components.queryItems ?? []
        let token = queryItems.first { $0.name == "token" }?.value?.trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        let server = queryItems.first { $0.name == "server" }?.value?.trimmingCharacters(
            in: .whitespacesAndNewlines
        )

        guard
            let token,
            !token.isEmpty,
            let server,
            let serverURL = URL(string: server),
            serverURL.scheme == "https"
        else {
            throw LocalRecorderLoginCallbackError.invalidCallback
        }

        self.serverURL = serverURL
        self.token = token
    }
}

public struct LocalRecorderCredentials: Codable, Equatable, Sendable {
    public var serverURLText: String
    public var bearerToken: String

    public init(serverURLText: String, bearerToken: String) {
        self.serverURLText = serverURLText
        self.bearerToken = bearerToken
    }
}

public enum LocalRecorderKeychainCredentialStoreError: Error, Equatable {
    case invalidKeychainData
    case keychainStatus(OSStatus)
}

public struct LocalRecorderKeychainCredentialStore: Sendable {
    public var service: String
    public var account: String

    public init(
        service: String = "tech.inevitable.meeting-note.local-recorder",
        account: String = "device-session"
    ) {
        self.service = service
        self.account = account
    }

    public func load() throws -> LocalRecorderCredentials? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw LocalRecorderKeychainCredentialStoreError.keychainStatus(status)
        }

        guard let data = item as? Data else {
            throw LocalRecorderKeychainCredentialStoreError.invalidKeychainData
        }

        do {
            return try JSONDecoder.localRecorder.decode(LocalRecorderCredentials.self, from: data)
        } catch {
            throw LocalRecorderKeychainCredentialStoreError.invalidKeychainData
        }
    }

    public func save(_ credentials: LocalRecorderCredentials) throws {
        let data = try JSONEncoder.localRecorder.encode(credentials)
        try delete()

        var attributes = baseQuery()
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        attributes[kSecValueData as String] = data

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw LocalRecorderKeychainCredentialStoreError.keychainStatus(status)
        }
    }

    public func delete() throws {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw LocalRecorderKeychainCredentialStoreError.keychainStatus(status)
        }
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
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

public struct LocalRecordingUploadPayload: Codable, Equatable, Sendable {
    public var fallbackIntentId: String
    public var clientRecordingId: String
    public var recordingStartedAt: Date
    public var recordingStoppedAt: Date
    public var computerAudioURL: URL
    public var microphoneAudioURL: URL
    public var manifest: RecordingManifest

    public init(
        fallbackIntentId: String,
        clientRecordingId: String,
        recordingStartedAt: Date,
        recordingStoppedAt: Date,
        computerAudioURL: URL,
        microphoneAudioURL: URL,
        manifest: RecordingManifest
    ) {
        self.fallbackIntentId = fallbackIntentId
        self.clientRecordingId = clientRecordingId
        self.recordingStartedAt = recordingStartedAt
        self.recordingStoppedAt = recordingStoppedAt
        self.computerAudioURL = computerAudioURL
        self.microphoneAudioURL = microphoneAudioURL
        self.manifest = manifest
    }
}

public struct LocalRecordingUploadQueue: Sendable {
    public var directoryURL: URL

    public init(directoryURL: URL) {
        self.directoryURL = directoryURL
    }

    public func save(_ payload: LocalRecordingUploadPayload) throws {
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        try JSONEncoder.localRecorder
            .encode(payload)
            .write(to: itemURL(clientRecordingId: payload.clientRecordingId), options: .atomic)
    }

    public func load() throws -> [LocalRecordingUploadPayload] {
        guard FileManager.default.fileExists(atPath: directoryURL.path()) else {
            return []
        }

        let itemURLs = try FileManager.default.contentsOfDirectory(
            at: directoryURL,
            includingPropertiesForKeys: nil
        )
        let payloads = try itemURLs
            .filter { $0.pathExtension == "json" }
            .map { url in
                try JSONDecoder.localRecorder.decode(
                    LocalRecordingUploadPayload.self,
                    from: Data(contentsOf: url)
                )
            }

        return payloads.sorted {
            $0.recordingStartedAt < $1.recordingStartedAt
        }
    }

    public func remove(clientRecordingId: String) throws {
        let url = itemURL(clientRecordingId: clientRecordingId)
        guard FileManager.default.fileExists(atPath: url.path()) else {
            return
        }

        try FileManager.default.removeItem(at: url)
    }

    private func itemURL(clientRecordingId: String) -> URL {
        let allowed = CharacterSet.alphanumerics.union(
            CharacterSet(charactersIn: "-_")
        )
        let filename = clientRecordingId.unicodeScalars
            .map { allowed.contains($0) ? String($0) : "_" }
            .joined()
        return directoryURL.appending(path: "\(filename.isEmpty ? "recording" : filename).json")
    }
}

public struct LocalRecordingUploadResponse: Codable, Equatable, Sendable {
    public var localRecordingId: String?
    public var meetingId: String
    public var queued: Bool
}

private struct FailIntentRequest: Codable {
    var errorMessage: String
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

private struct MultipartForm {
    private var body = Data()
    private let boundary: String

    init(boundary: String) {
        self.boundary = boundary
    }

    static func boundary() -> String {
        "meeting-note-\(UUID().uuidString)"
    }

    func addingField(name: String, value: String) -> MultipartForm {
        var copy = self
        copy.appendBoundary()
        copy.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
        copy.append(value)
        copy.append("\r\n")
        return copy
    }

    func addingFile(
        name: String,
        fileURL: URL,
        contentType: String
    ) throws -> MultipartForm {
        var copy = self
        let fileName = fileURL.lastPathComponent
        copy.appendBoundary()
        copy.append(
            "Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(fileName)\"\r\n"
        )
        copy.append("Content-Type: \(contentType)\r\n\r\n")
        copy.body.append(try Data(contentsOf: fileURL))
        copy.append("\r\n")
        return copy
    }

    func data() -> Data {
        var copy = self
        copy.append("--\(boundary)--\r\n")
        return copy.body
    }

    private mutating func appendBoundary() {
        append("--\(boundary)\r\n")
    }

    private mutating func append(_ string: String) {
        body.append(Data(string.utf8))
    }
}

private extension Date {
    var localRecorderISOString: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [
            .withInternetDateTime,
            .withFractionalSeconds,
        ]
        return formatter.string(from: self)
    }
}
