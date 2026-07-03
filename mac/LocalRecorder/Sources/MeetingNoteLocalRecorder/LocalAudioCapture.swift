@preconcurrency import AVFoundation
import CoreMedia
import Foundation
import LocalRecorderCore
import ScreenCaptureKit

struct LocalRecordingCaptureResult {
    var cleanupDirectoryURL: URL
    var payload: LocalRecordingUploadPayload
}

enum LocalRecordingCaptureError: LocalizedError {
    case alreadyRecording
    case noActiveRecording
    case noDisplayAvailable
    case audioBufferUnavailable
    case audioFormatUnavailable
    case writerFailed(String)

    var errorDescription: String? {
        switch self {
        case .alreadyRecording:
            return "Recording is already running"
        case .noActiveRecording:
            return "No active recording"
        case .noDisplayAvailable:
            return "No display is available for system audio capture"
        case .audioBufferUnavailable:
            return "Audio buffer is unavailable"
        case .audioFormatUnavailable:
            return "Audio format is unavailable"
        case .writerFailed(let message):
            return message
        }
    }
}

@MainActor
final class LocalRecordingCaptureController {
    private var activeSession: LocalRecordingCaptureSession?

    func start(
        fallbackIntentId: String,
        appVersion: String,
        onAudioLevel: @escaping @Sendable (Float) -> Void = { _ in }
    ) async throws {
        if activeSession != nil {
            throw LocalRecordingCaptureError.alreadyRecording
        }

        let session = try LocalRecordingCaptureSession(
            fallbackIntentId: fallbackIntentId,
            appVersion: appVersion,
            onAudioLevel: onAudioLevel
        )
        try await session.start()
        activeSession = session
    }

    func stop() async throws -> LocalRecordingCaptureResult {
        guard let activeSession else {
            throw LocalRecordingCaptureError.noActiveRecording
        }

        self.activeSession = nil
        return try await activeSession.stop()
    }
}

@MainActor
final class LocalRecordingCaptureSession {
    private let appVersion: String
    private let clientRecordingId: String
    private let computerAudioURL: URL
    private let fallbackIntentId: String
    private let microphoneAudioURL: URL
    private let microphoneRecorder: MicrophoneTrackRecorder
    private let startedAt: Date
    private let synthesizedAudioURL: URL
    private var isSystemAudioRecording = false
    private let systemRecorder: SystemAudioTrackRecorder

    init(
        fallbackIntentId: String,
        appVersion: String,
        onAudioLevel: @escaping @Sendable (Float) -> Void
    ) throws {
        let directoryURL = LocalRecorderFileLocations.recordingsDirectoryURL()
            .appending(path: UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )

        self.appVersion = appVersion
        self.clientRecordingId = UUID().uuidString
        self.computerAudioURL = directoryURL.appending(path: "computer.wav")
        self.fallbackIntentId = fallbackIntentId
        self.microphoneAudioURL = directoryURL.appending(path: "microphone.wav")
        self.startedAt = Date()
        self.synthesizedAudioURL = directoryURL.appending(path: "synthesized.wav")
        self.microphoneRecorder = try MicrophoneTrackRecorder(
            outputURL: microphoneAudioURL,
            onAudioLevel: onAudioLevel
        )
        self.systemRecorder = try SystemAudioTrackRecorder(
            outputURL: computerAudioURL,
            onAudioLevel: onAudioLevel
        )
    }

    func start() async throws {
        try microphoneRecorder.start()

        do {
            try await systemRecorder.start()
            isSystemAudioRecording = true
        } catch {
            await systemRecorder.stop()
        }
    }

    func stop() async throws -> LocalRecordingCaptureResult {
        let stoppedAt = Date()
        if isSystemAudioRecording {
            await systemRecorder.stop()
        }
        microphoneRecorder.stop()
        try LocalTrackSynthesizer.synthesize(
            computerAudioURL: computerAudioURL,
            microphoneAudioURL: microphoneAudioURL,
            outputURL: synthesizedAudioURL
        )

        let manifest = RecordingManifest(
            appVersion: appVersion,
            computerAudio: TrackMetadata(
                captureStartedAt: startedAt,
                captureStoppedAt: stoppedAt,
                sampleRate: LocalTrackAudioFormat.sampleRate,
                channelCount: LocalTrackAudioFormat.channelCount,
                codec: "pcm_s16le",
                container: "wav",
                firstSampleTime: 0
            ),
            microphoneAudio: TrackMetadata(
                captureStartedAt: startedAt,
                captureStoppedAt: stoppedAt,
                sampleRate: LocalTrackAudioFormat.sampleRate,
                channelCount: LocalTrackAudioFormat.channelCount,
                codec: "pcm_s16le",
                container: "wav",
                firstSampleTime: 0
            )
        )
        let payload = LocalRecordingUploadPayload(
            fallbackIntentId: fallbackIntentId,
            clientRecordingId: clientRecordingId,
            recordingStartedAt: startedAt,
            recordingStoppedAt: stoppedAt,
            computerAudioURL: computerAudioURL,
            microphoneAudioURL: microphoneAudioURL,
            synthesizedAudioURL: synthesizedAudioURL,
            manifest: manifest
        )

        return LocalRecordingCaptureResult(
            cleanupDirectoryURL: payload.computerAudioURL.deletingLastPathComponent(),
            payload: payload
        )
    }
}

enum LocalRecorderFileLocations {
    static func uploadQueueDirectoryURL() -> URL {
        applicationSupportDirectoryURL()
            .appending(path: "PendingUploads", directoryHint: .isDirectory)
    }

    static func recordingsDirectoryURL() -> URL {
        applicationSupportDirectoryURL()
            .appending(path: "Recordings", directoryHint: .isDirectory)
    }

    private static func applicationSupportDirectoryURL() -> URL {
        let baseURL = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first ?? FileManager.default.temporaryDirectory

        return baseURL
            .appending(path: "MeetingNoteLocalRecorder", directoryHint: .isDirectory)
    }
}

enum LocalTrackAudioFormat {
    static let sampleRate = 48_000.0
    static let channelCount = 2

    static var avFormat: AVAudioFormat {
        AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: sampleRate,
            channels: AVAudioChannelCount(channelCount),
            interleaved: false
        )!
    }

    static var processingFormat: AVAudioFormat {
        AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: AVAudioChannelCount(channelCount),
            interleaved: false
        )!
    }
}

enum LocalTrackSynthesizer {
    private static let frameCapacity: AVAudioFrameCount = 4096

    static func synthesize(
        computerAudioURL: URL,
        microphoneAudioURL: URL,
        outputURL: URL
    ) throws {
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        let computerFile = try AVAudioFile(forReading: computerAudioURL)
        let microphoneFile = try AVAudioFile(forReading: microphoneAudioURL)
        let writer = try PCM16WavWriter(outputURL: outputURL)
        defer {
            writer.close()
        }

        let mixFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: LocalTrackAudioFormat.sampleRate,
            channels: AVAudioChannelCount(LocalTrackAudioFormat.channelCount),
            interleaved: false
        )!

        while true {
            let computerBuffer = try readChunk(from: computerFile, format: mixFormat)
            let microphoneBuffer = try readChunk(from: microphoneFile, format: mixFormat)
            guard computerBuffer != nil || microphoneBuffer != nil else {
                break
            }

            let mixed = try mix(
                computerBuffer: computerBuffer,
                microphoneBuffer: microphoneBuffer,
                format: mixFormat
            )
            writer.write(mixed)
        }

        try writer.finish()
    }

    private static func readChunk(
        from file: AVAudioFile,
        format: AVAudioFormat
    ) throws -> AVAudioPCMBuffer? {
        guard file.framePosition < file.length else {
            return nil
        }

        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: file.processingFormat,
            frameCapacity: frameCapacity
        ) else {
            throw LocalRecordingCaptureError.audioBufferUnavailable
        }

        try file.read(into: buffer, frameCount: frameCapacity)
        guard buffer.frameLength > 0 else {
            return nil
        }

        return try LocalAudioBufferConverter.convert(buffer, to: format)
    }

    private static func mix(
        computerBuffer: AVAudioPCMBuffer?,
        microphoneBuffer: AVAudioPCMBuffer?,
        format: AVAudioFormat
    ) throws -> AVAudioPCMBuffer {
        let frameLength = max(
            computerBuffer?.frameLength ?? 0,
            microphoneBuffer?.frameLength ?? 0
        )
        guard
            frameLength > 0,
            let mixed = AVAudioPCMBuffer(
                pcmFormat: format,
                frameCapacity: frameLength
            ),
            let mixedChannels = mixed.floatChannelData
        else {
            throw LocalRecordingCaptureError.audioBufferUnavailable
        }

        mixed.frameLength = frameLength
        for channel in 0..<Int(format.channelCount) {
            let output = mixedChannels[channel]
            let computerChannel = channelData(from: computerBuffer, channel: channel)
            let microphoneChannel = channelData(from: microphoneBuffer, channel: channel)

            for frame in 0..<Int(frameLength) {
                let computerSample = sample(
                    from: computerChannel,
                    frame: frame,
                    frameLength: computerBuffer?.frameLength
                )
                let microphoneSample = sample(
                    from: microphoneChannel,
                    frame: frame,
                    frameLength: microphoneBuffer?.frameLength
                )
                output[frame] = max(-1, min(1, computerSample + microphoneSample))
            }
        }

        return mixed
    }

    private static func channelData(
        from buffer: AVAudioPCMBuffer?,
        channel: Int
    ) -> UnsafeMutablePointer<Float>? {
        guard
            let buffer,
            let channels = buffer.floatChannelData,
            buffer.format.channelCount > 0
        else {
            return nil
        }

        let clampedChannel = min(channel, Int(buffer.format.channelCount) - 1)
        return channels[clampedChannel]
    }

    private static func sample(
        from channelData: UnsafeMutablePointer<Float>?,
        frame: Int,
        frameLength: AVAudioFrameCount?
    ) -> Float {
        guard
            let channelData,
            let frameLength,
            frame < Int(frameLength)
        else {
            return 0
        }

        return channelData[frame]
    }
}

final class MicrophoneTrackRecorder {
    private let engine = AVAudioEngine()
    private let onAudioLevel: @Sendable (Float) -> Void
    private let writer: PCM16WavWriter

    init(
        outputURL: URL,
        onAudioLevel: @escaping @Sendable (Float) -> Void
    ) throws {
        self.onAudioLevel = onAudioLevel
        self.writer = try PCM16WavWriter(outputURL: outputURL)
    }

    func start() throws {
        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)

        input.installTap(
            onBus: 0,
            bufferSize: 4096,
            format: inputFormat
        ) { [onAudioLevel, writer] buffer, _ in
            onAudioLevel(LocalAudioLevelMeter.rmsLevel(from: buffer))
            writer.write(buffer)
        }
        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        writer.close()
    }
}

final class SystemAudioTrackRecorder: NSObject, @unchecked Sendable, SCStreamOutput, SCStreamDelegate {
    private let onAudioLevel: @Sendable (Float) -> Void
    private let queue = DispatchQueue(label: "tech.inevitable.meeting-note.local-recorder.system-audio")
    private let writer: PCM16WavWriter
    private var stream: SCStream?

    init(
        outputURL: URL,
        onAudioLevel: @escaping @Sendable (Float) -> Void
    ) throws {
        self.onAudioLevel = onAudioLevel
        self.writer = try PCM16WavWriter(outputURL: outputURL)
    }

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(
            false,
            onScreenWindowsOnly: true
        )
        guard let display = content.displays.first else {
            throw LocalRecordingCaptureError.noDisplayAvailable
        }

        let configuration = SCStreamConfiguration()
        configuration.width = 2
        configuration.height = 2
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        configuration.queueDepth = 3
        configuration.capturesAudio = true
        configuration.sampleRate = Int(LocalTrackAudioFormat.sampleRate)
        configuration.channelCount = LocalTrackAudioFormat.channelCount
        configuration.excludesCurrentProcessAudio = true

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
        try stream.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
        try await stream.startCapture()
        self.stream = stream
    }

    func stop() async {
        guard let stream else {
            writer.close()
            return
        }

        try? await stream.stopCapture()
        self.stream = nil
        writer.close()
    }

    nonisolated func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .audio, sampleBuffer.isValid else {
            return
        }

        do {
            let buffer = try AVAudioPCMBuffer.localRecorderBuffer(from: sampleBuffer)
            onAudioLevel(LocalAudioLevelMeter.rmsLevel(from: buffer))
            writer.write(buffer)
        } catch {
            writer.record(error)
        }
    }

    nonisolated func stream(_ stream: SCStream, didStopWithError error: Error) {
        writer.record(error)
    }
}

final class PCM16WavWriter: @unchecked Sendable {
    private let fileHandle: FileHandle
    private let lock = NSLock()
    private let outputFormat = LocalTrackAudioFormat.processingFormat
    private var dataByteCount: UInt32 = 0
    private var error: Error?
    private var isClosed = false

    init(outputURL: URL) throws {
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        FileManager.default.createFile(
            atPath: outputURL.path,
            contents: Self.wavHeader(dataByteCount: 0),
        )
        self.fileHandle = try FileHandle(forWritingTo: outputURL)
        try fileHandle.seekToEnd()
    }

    func write(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        defer {
            lock.unlock()
        }

        guard !isClosed, error == nil else {
            return
        }

        do {
            guard let converted = try convert(buffer) else {
                return
            }

            try writePCM(converted)
        } catch {
            self.error = error
        }
    }

    func record(_ error: Error) {
        lock.lock()
        self.error = error
        lock.unlock()
    }

    func close() {
        lock.lock()
        closeLocked()
        lock.unlock()
    }

    func finish() throws {
        lock.lock()
        closeLocked()
        let recordedError = error
        lock.unlock()

        if let recordedError {
            throw recordedError
        }
    }

    private func convert(_ buffer: AVAudioPCMBuffer) throws -> AVAudioPCMBuffer? {
        try LocalAudioBufferConverter.convert(buffer, to: outputFormat)
    }

    private func writePCM(_ buffer: AVAudioPCMBuffer) throws {
        guard buffer.frameLength > 0,
              let channels = buffer.floatChannelData else {
            return
        }

        let frameLength = Int(buffer.frameLength)
        let channelCount = Int(outputFormat.channelCount)
        var data = Data()
        data.reserveCapacity(frameLength * channelCount * MemoryLayout<Int16>.size)

        for frame in 0..<frameLength {
            for channel in 0..<channelCount {
                let sample = channels[channel][frame]
                var pcm = Int16(
                    max(
                        Double(Int16.min),
                        min(Double(Int16.max), Double(sample) * Double(Int16.max))
                    )
                ).littleEndian
                withUnsafeBytes(of: &pcm) { bytes in
                    data.append(contentsOf: bytes)
                }
            }
        }

        try fileHandle.write(contentsOf: data)
        dataByteCount = dataByteCount &+ UInt32(data.count)
    }

    private func closeLocked() {
        guard !isClosed else {
            return
        }

        isClosed = true
        do {
            try fileHandle.seek(toOffset: 0)
            try fileHandle.write(contentsOf: Self.wavHeader(dataByteCount: dataByteCount))
            try fileHandle.close()
        } catch {
            self.error = error
        }
    }

    private static func wavHeader(dataByteCount: UInt32) -> Data {
        var data = Data()
        data.append(contentsOf: [0x52, 0x49, 0x46, 0x46])
        appendUInt32(36 &+ dataByteCount, to: &data)
        data.append(contentsOf: [0x57, 0x41, 0x56, 0x45])
        data.append(contentsOf: [0x66, 0x6d, 0x74, 0x20])
        appendUInt32(16, to: &data)
        appendUInt16(1, to: &data)
        appendUInt16(UInt16(LocalTrackAudioFormat.channelCount), to: &data)
        appendUInt32(UInt32(LocalTrackAudioFormat.sampleRate), to: &data)
        appendUInt32(
            UInt32(LocalTrackAudioFormat.sampleRate) *
                UInt32(LocalTrackAudioFormat.channelCount) *
                UInt32(MemoryLayout<Int16>.size),
            to: &data
        )
        appendUInt16(
            UInt16(LocalTrackAudioFormat.channelCount * MemoryLayout<Int16>.size),
            to: &data
        )
        appendUInt16(16, to: &data)
        data.append(contentsOf: [0x64, 0x61, 0x74, 0x61])
        appendUInt32(dataByteCount, to: &data)
        return data
    }

    private static func appendUInt16(_ value: UInt16, to data: inout Data) {
        var littleEndian = value.littleEndian
        withUnsafeBytes(of: &littleEndian) { bytes in
            data.append(contentsOf: bytes)
        }
    }

    private static func appendUInt32(_ value: UInt32, to data: inout Data) {
        var littleEndian = value.littleEndian
        withUnsafeBytes(of: &littleEndian) { bytes in
            data.append(contentsOf: bytes)
        }
    }
}

enum LocalAudioBufferConverter {
    static func convert(
        _ buffer: AVAudioPCMBuffer,
        to outputFormat: AVAudioFormat
    ) throws -> AVAudioPCMBuffer {
        if buffer.format == outputFormat {
            return buffer
        }

        guard let converter = AVAudioConverter(from: buffer.format, to: outputFormat) else {
            throw LocalRecordingCaptureError.audioFormatUnavailable
        }

        let ratio = outputFormat.sampleRate / buffer.format.sampleRate
        let frameCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1
        guard let converted = AVAudioPCMBuffer(
            pcmFormat: outputFormat,
            frameCapacity: frameCapacity
        ) else {
            throw LocalRecordingCaptureError.audioBufferUnavailable
        }

        let input = AudioConverterInput(buffer: buffer)
        var conversionError: NSError?
        converter.convert(to: converted, error: &conversionError) { _, status in
            input.provide(status: status)
        }

        if let conversionError {
            throw conversionError
        }

        return converted
    }
}

final class AudioConverterInput: @unchecked Sendable {
    private let buffer: AVAudioPCMBuffer
    private let lock = NSLock()
    private var didProvideBuffer = false

    init(buffer: AVAudioPCMBuffer) {
        self.buffer = buffer
    }

    func provide(status: UnsafeMutablePointer<AVAudioConverterInputStatus>) -> AVAudioBuffer? {
        lock.lock()
        defer {
            lock.unlock()
        }

        if didProvideBuffer {
            status.pointee = .noDataNow
            return nil
        }

        didProvideBuffer = true
        status.pointee = .haveData
        return buffer
    }
}

enum LocalAudioLevelMeter {
    static func rmsLevel(from buffer: AVAudioPCMBuffer) -> Float {
        guard buffer.frameLength > 0, buffer.format.channelCount > 0 else {
            return 0
        }

        guard let measurableBuffer = makeFloatBuffer(from: buffer),
              let channels = measurableBuffer.floatChannelData else {
            return 0
        }

        let channelCount = Int(measurableBuffer.format.channelCount)
        let frameLength = Int(measurableBuffer.frameLength)
        var squareSum: Float = 0
        var sampleCount = 0

        for channel in 0..<channelCount {
            let channelData = channels[channel]
            for frame in 0..<frameLength {
                let sample = channelData[frame]
                squareSum += sample * sample
                sampleCount += 1
            }
        }

        guard sampleCount > 0 else {
            return 0
        }

        return sqrt(squareSum / Float(sampleCount))
    }

    private static func makeFloatBuffer(from buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        if buffer.format.commonFormat == .pcmFormatFloat32,
           !buffer.format.isInterleaved {
            return buffer
        }

        guard let format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: buffer.format.sampleRate,
            channels: buffer.format.channelCount,
            interleaved: false
        ) else {
            return nil
        }

        return try? LocalAudioBufferConverter.convert(buffer, to: format)
    }
}

private extension AVAudioPCMBuffer {
    static func localRecorderBuffer(from sampleBuffer: CMSampleBuffer) throws -> AVAudioPCMBuffer {
        guard let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer) else {
            throw LocalRecordingCaptureError.audioFormatUnavailable
        }

        let format = AVAudioFormat(cmAudioFormatDescription: formatDescription)
        let frameCount = AVAudioFrameCount(CMSampleBufferGetNumSamples(sampleBuffer))
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: frameCount
        ) else {
            throw LocalRecordingCaptureError.audioBufferUnavailable
        }

        buffer.frameLength = frameCount
        let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
            sampleBuffer,
            at: 0,
            frameCount: Int32(frameCount),
            into: buffer.mutableAudioBufferList
        )

        guard status == noErr else {
            throw LocalRecordingCaptureError.writerFailed("Could not copy system audio buffer")
        }

        return buffer
    }
}
