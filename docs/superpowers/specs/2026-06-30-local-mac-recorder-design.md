# Local Mac Recorder Design

## Goal

Build a macOS fallback recorder for [meeting-note](/Users/glaze/developer/meeting-note) so a meeting can still be captured when the [Recall.ai](https://www.recall.ai/) bot does not join.

The user experience stays colleague first. The website shows one meeting, one transcript, one summary, one export, and one share surface. The local recorder is a capture fallback for the same meeting, not a separate upload product.

## Approved Scope

1. The first version targets macOS 15 plus.
2. The Mac app asks the user to sign in before monitoring meetings.
3. After login, the Mac app asks for microphone, screen audio capture, notifications, and start at login permission.
4. After permissions are ready, the Mac app runs as a small menu bar app.
5. The Mac app checks the web app for eligible missed bot meetings.
6. If a meeting with a link is one minute past start time and has no successful Recall recording evidence, the Mac app shows a local macOS notification.
7. Clicking the notification starts local recording immediately.
8. The recorder captures two local tracks, one for computer audio and one for the user's microphone.
9. When the user stops recording, the app uploads both tracks automatically.
10. The server attaches the local recording to the same meeting by matching the recording time to eligible missed meetings.
11. The server creates one synthesized audio file from both tracks.
12. Export returns the synthesized audio file, not the separate technical tracks.

## Out Of Scope

1. Auto joining Google Meet or Zoom from the Mac app.
2. Recording before a user clicks the local notification.
3. Separate uploaded meetings for local recordings.
4. Showing two separate audio tracks in normal website UI.
5. Supporting macOS versions below 15 in the first version.
6. Replacing Recall as the normal meeting recorder.

## Current Product Anchors

The existing product already has the needed cloud concepts.

1. Recall webhook handling can mark a meeting as missed when a bot call ends without recording evidence.
2. Meeting rows already preserve calendar title, meeting time, meeting link, team, owner, and status.
3. Uploaded audio already stores media in [Cloudflare R2](https://developers.cloudflare.com/r2/) and creates transcription work.
4. The current upload path accepts one MP3 and creates a separate uploaded meeting. The local recorder must use a new same meeting path instead.
5. Export must prefer the synthesized local recording for locally recorded meetings.

## Mac App Architecture

The Mac app is a signed SwiftUI menu bar app.

1. `AuthController` starts web login through the hosted web app and stores the device session in [Apple Keychain](https://developer.apple.com/documentation/security/keychain_services).
2. `PermissionController` checks and requests microphone, screen audio capture, notifications, and start at login permission.
3. `MeetingMonitor` polls the server every minute while the app is active and logged in.
4. `NotificationController` shows local macOS notifications for eligible missed bot meetings.
5. `Recorder` starts only after notification click and writes two local audio files.
6. `UploadQueue` uploads completed recordings and retries failed uploads.
7. `MenuBarStatus` shows login state, permission state, monitoring state, recording state, and upload retry state.

The app uses [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit/) for system audio capture and [AVAudioEngine](https://developer.apple.com/documentation/avfaudio/avaudioengine) for microphone capture. Notifications use [UserNotifications](https://developer.apple.com/documentation/usernotifications). Start at login uses [SMAppService](https://developer.apple.com/documentation/servicemanagement/smappservice).

## Login And Permissions

First run flow:

1. User opens the Mac app.
2. App asks the user to sign in.
3. Login opens the web app auth flow.
4. App stores the returned device session in Keychain.
5. App asks for microphone access.
6. App asks for screen and system audio capture access.
7. App asks for notification permission.
8. App asks for start at login permission.
9. App starts monitoring only after required permissions are ready.

If a required permission is denied, the app shows the missing permission and a direct action to open the relevant system setting. It does not show monitoring as active.

## Missed Bot Detection

The web app exposes an authenticated endpoint for the Mac app:

`GET /api/local-recorder/missed-meetings`

The endpoint returns meetings visible to the signed in user's workspace where:

1. The meeting has a Google Meet or Zoom link.
2. The meeting start time is at least one minute in the past.
3. The meeting is still inside its expected recording window.
4. Recall has no recording id for the meeting.
5. The meeting status is scheduled or missed.
6. A fallback notification has not already been shown by this Mac app for the current recording window.

Each signed in Mac app user in the workspace can receive the local notification. This satisfies the all users requirement without server side push.

The Mac app shows a local notification:

`Bot did not join. Start local recording?`

Clicking the notification starts recording immediately. There is no website fallback for this notification path because the Mac app owns the notification.

## Recording Behavior

The recorder writes two files in a local app data folder:

1. Computer audio track.
2. User microphone track.

The local recording session stores:

1. Recording start time.
2. Recording stop time.
3. Signed in user id.
4. Workspace id from the session.
5. Candidate meeting titles and time windows returned during monitoring.
6. Local file paths.
7. Upload state.

The user can stop recording from the menu bar app. After stop, upload starts automatically.

## Meeting Matching

The server attaches uploads to the same meeting by recording time.

Upload request:

`POST /api/local-recorder/recordings`

The request includes:

1. Recording start time.
2. Recording stop time.
3. Computer audio file.
4. Microphone audio file.
5. Client generated recording id for retry dedupe.

The server finds eligible missed meetings in the user's workspace whose meeting window overlaps the recording window.

If exactly one eligible meeting matches, the upload attaches to that meeting.

If more than one meeting matches, the server returns a conflict response with the candidate meeting titles and times. The Mac app asks the user which meeting to attach, then retries with the selected meeting. This is the only place where user choice is required, because time alone is not safe for overlapping meetings.

If no meeting matches, the app keeps the files local and shows an upload blocked state.

## Cloud Storage And Data Model

Add a local recording source without creating a new meeting.

Recommended schema additions:

1. Add `local_recorder` to `asset_source`.
2. Add `computer_audio`, `microphone_audio`, and `synthesized_audio` to `asset_type`, or add an `audio_role` field if keeping `asset_type = audio` is cleaner.
3. Add a `local_recordings` table with meeting id, owner user id, recording start time, recording stop time, client recording id, status, error message, and synthesized asset id.
4. Store all three files in R2.

The normal meeting page reads from the existing meeting id. Technical track assets stay hidden from normal UI.

## Processing Flow

1. Mac app uploads computer audio and microphone audio.
2. Server stores both tracks in R2.
3. Server creates or updates a local recording row for the existing meeting.
4. Server synthesizes one audio file from both tracks.
5. Server stores synthesized audio in R2.
6. Server creates one transcription job using the synthesized audio.
7. Transcript, summary, share, and search use the same existing meeting surfaces.
8. Export uses the synthesized audio asset.

The two original tracks remain available for future diarization and speaker matching.

## Website Behavior

The dashboard keeps showing the original calendar meeting.

The meeting page shows:

1. The normal transcript state.
2. A small source label when the meeting was recorded locally.
3. A retry state if local upload or synthesis failed.

The page does not show meeting ids or two technical track files to normal users.

## Failure Handling

1. If the user is not logged in, the Mac app does not monitor.
2. If permissions are missing, the Mac app does not monitor.
3. If the bot later joins successfully, the server stops returning the meeting as eligible.
4. If recording is active and the app quits, it should recover any closed files on next launch and offer upload.
5. If upload fails, both tracks stay local and retry later.
6. If synthesis fails, the meeting shows a repair state and export remains unavailable until synthesis succeeds.
7. If matching is ambiguous, the app asks the user to choose from candidate meetings.

## Verification

Implementation should prove:

1. A meeting one minute past start with no Recall recording is eligible.
2. A meeting with a Recall recording id is not eligible.
3. A meeting without a meeting link is not eligible.
4. The Mac polling endpoint returns only meetings visible to the signed in user's workspace.
5. A local recording upload attaches to the existing meeting, not a new meeting.
6. Overlapping meetings return a conflict instead of guessing.
7. Computer and microphone tracks are stored separately.
8. Synthesis creates one exportable audio asset.
9. Export returns synthesized audio for locally recorded meetings.
10. Failed uploads stay retryable from local disk.

## Success Criteria

The feature is complete when a signed in macOS 15 plus user can install the Mac app, grant permissions, receive a local notification one minute after a missed bot join, click it to record, stop recording, upload automatically, and then see the same meeting on the website with transcript processing and synthesized audio export.
