# ADR: Android Media Notification Custom Actions

## Title
- Decision: Bridge React Native Track Player to native Android media custom actions.

## Status
- Accepted

## Context
- Android 13 and newer derive media controls from `PlaybackState`, so speed and comments cannot be represented as previous/next capabilities without Android replacing their icons and semantics.
- Android 12 and older render `MediaStyle` actions through ExoPlayer's `PlayerNotificationManager`.
- React Native Track Player 4.1.2 and its pinned KotlinAudio 2.1.0 dependency do not expose either custom-action surface to JavaScript.
- The app needs stable custom controls for playback speed and comments while preserving previous/next for real queue navigation.

## Decision
- Keep React Native Track Player at 4.1.2 and extend the checked-in Bun patch with `androidCustomActions` plus a `RemoteCustomAction` event.
- On Android 13+, register `MediaSessionConnector.CustomActionProvider` instances so the system media surface owns placement and play/pause state.
- On Android 12 and older, install real `PlayerNotificationManager.CustomActionReceiver` actions into the existing `MediaStyle` notification. Do not disguise custom controls as previous/next.
- Use explicit drawable resource names copied by the Expo config plugin so development and preview builds resolve icons without Metro.
- Retain the private KotlinAudio and ExoPlayer fields used by this bridge in consumer ProGuard rules.

## Consequences
- Benefits:
  - Notification, lock-screen, and external media controls keep correct action semantics and accessible titles.
  - Previous/next remain available for future queue navigation.
  - A headless speed change can update the native notification icon before the app UI resumes.
- Tradeoffs:
  - Android 12 and older require reflection because KotlinAudio 2.1.0 does not expose its internal `PlayerNotificationManager`.
  - OEMs and Android may reorder expanded actions; arbitrary legacy custom actions cannot be forced into compact `MediaStyle` slots.
  - If the private bridge cannot be installed, standard back/play/forward controls remain available and the failure is emitted to logcat; speed/comments are omitted rather than mislabeled.
- Upgrade and verification triggers:
  - Re-audit this bridge whenever React Native Track Player, KotlinAudio, or ExoPlayer is upgraded.
  - Verify the reflected field names, ProGuard retention, custom-action receiver registration, and process-recreation behavior in a fresh native development build.
  - Remove the reflection bridge when the upstream player exposes equivalent custom media actions.
