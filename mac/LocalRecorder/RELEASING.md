# Releasing the macOS recorder

The recorder uses Sparkle 2 to check for and install updates automatically. Release archives and the Sparkle appcast are hosted in GitHub Releases.

The app is ad hoc signed like Shuttle. It is not signed with an Apple Developer ID certificate and is not notarized. Sparkle update archives are still signed with EdDSA so installed apps can verify future downloads.

The release target is arm64 macOS 15 or newer. The workflow uses Node.js 24 for the bundled sidecar and Swift Testing for the recorder package.

## One time GitHub setup

The `SPARKLE_PRIVATE_KEY` Actions secret is already configured in the `glazec/tape` repository. Its public key is embedded in `script/build_and_run.sh`. Keep the local Keychain item named `meeting-note` as the recovery copy.

No Apple certificate or App Store Connect secrets are required for this release mode.

The embedded `SPARKLE_FEED_URL` points to the stable `macos-appcast` release in `glazec/tape`. `tests/local-recorder-packaging.test.ts` verifies that this origin stays aligned with the repository URL in `package.json`.

## Publish a release

Create and push a semantic version tag from `main`:

```bash
git switch main
git pull --ff-only
git tag mac-v0.3.0
git push origin mac-v0.3.0
```

Run the complete repository gate before tagging:

```bash
npm run verify:all
```

The `Release macOS recorder` workflow then:

1. Runs the Swift and sidecar tests.
2. Builds the arm64 app with the hardened runtime.
3. Applies ad hoc signatures to the app, Sparkle helpers, Node runtime, and Recall SDK binaries.
4. Signs the ZIP with Sparkle EdDSA.
5. Publishes the ZIP, checksum, and installation instructions to the versioned GitHub Release.
6. Updates the stable `macos-appcast` release asset used by installed apps.

After the workflow succeeds, verify both the versioned release and the `macos-appcast` release in the repository that matches the embedded Sparkle feed. Confirm that `appcast.xml` references the new archive and contains a Sparkle EdDSA signature.

The workflow refuses malformed tags, tags outside `main`, missing Sparkle secrets, invalid ad hoc signatures, and missing Sparkle metadata.

## Install the package without Apple signing

1. Download the `MeetingNoteLocalRecorder` ZIP from the GitHub Release.
2. Unzip it and drag `MeetingNoteLocalRecorder.app` into `/Applications`.
3. Open Terminal and remove the quarantine attribute from this app only:

```bash
xattr -dr com.apple.quarantine /Applications/MeetingNoteLocalRecorder.app
```

4. Launch the app:

```bash
open /Applications/MeetingNoteLocalRecorder.app
```

5. Grant Microphone, Screen Recording, Accessibility, and Notifications when macOS asks.

If removing quarantine reports a permission error, run the same `xattr` command with `sudo`. This bypass is necessary because the app is not notarized. Only use the ZIP downloaded from the official `glazec/tape` GitHub Release and verify its published SHA256 checksum before opening it.
