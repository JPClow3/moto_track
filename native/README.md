# Moto Track native distribution

The native clients host the existing HTTPS application at `https://moto-track.net`.
They add platform navigation, native sharing or link copying, file selection/downloads and connection recovery. They do not contain a separate database or embedded service secrets.

## Prepared artifacts

Local build artifacts are under `packages/` (ignored by Git):

- `moto-track-android-preview.apk`: debug-signed preview; package `net.mototrack.app.preview`.
- `moto-track-android-release-unsigned.aab`: release bundle; provisional package `net.mototrack.app`. Supply the owner's upload signing key before Play submission.
- `moto-track-windows-x64-unsigned.msix`: self-contained .NET Windows desktop application in an unsigned MSIX with development identity.
- `moto-track-windows-desktop-preview.zip`: executable and redistribution notices; requires the installed Microsoft Edge WebView2 Runtime.
- `moto-track-ios-xcode-project.zip`: Xcode project, source and icons. The user chose to keep the project for now; no IPA was compiled or signed.

The native clients use the hosted site's current version. Deploy the reviewed web changes before accepting a native release; a native build does not publish its server routes.

## Android

Requires JDK 17 and Android SDK platform 36. Configure `ANDROID_HOME` or an ignored `android/local.properties` with an escaped SDK path.

```sh
cd native/android
./gradlew assembleDebug bundleRelease lintRelease
```

The Gradle wrapper is pinned with the distribution checksum. AndroidX Activity handles system back navigation. JavaScript is required by the Svelte app; top-level navigation is restricted to the app's HTTPS origin, file:// and mixed-content access are disabled, and no JavaScript bridge is exposed. Uploads accept only external content URIs with an explicit read grant. Location is requested only when the site asks for it. Cloud backup and device transfer exclude app data.

Before a Play release, reserve/confirm the package identity, supply the owner's signing key, run on physical devices, verify private downloads/uploads, permissions, account recovery/deletion and offline behavior, then capture the signed build. Do not use the debug key as a production upload key.

## Windows

Requires .NET 10 SDK to rebuild, the Windows SDK's MakeAppx to package, and WebView2 Runtime to run.

```powershell
dotnet publish native/windows/MotoTrack.csproj -c Release -r win-x64 --self-contained true
./native/windows/package.ps1
```

Replace `MotoTrack.Development` and `CN=MotoTrack Development` with the exact identity and publisher from Partner Center before Store submission. Sign the MSIX with the owner's certificate. The package script includes vendor redistribution notices. The application keeps WebView2 data in the current user's LocalAppData, uses a native Save dialog for app-origin downloads, and shares only the public canonical app link.

## iOS

Open `ios/MotoTrack.xcodeproj` in Xcode on a Mac. Select the owner's development team and confirmed bundle ID, then run on iPhone and iPad. Use Archive and the owner's distribution configuration to produce the IPA.

The source includes SwiftUI controls, persistent WKWebView session storage, pull to refresh, native share/download sheets, connection recovery, camera/photo/location usage descriptions and a native privacy manifest. Privacy labels must separately describe the hosted application's actual data collection.

No macOS/Xcode environment was available for compilation in this preparation. XML/plist and project references can be inspected locally; they do not prove Swift compilation or device behavior.

## Mobile purchases and sign-in

Android and iOS identify themselves with `MotoTrackNative/Android` and `MotoTrackNative/iOS`. The hosted app removes purchase CTAs and redirects hosted checkout, pricing and portal entry points to `/app-info`. Native clients also block those navigation paths. These flags only remove presentation surfaces; they never grant access or change ownership.

All native clients use email/password sign-in in this version. Google OAuth remains available in a browser. Native Google actions are rejected on the server because the clients do not implement a secure system-browser callback flow.

Native paid upgrades, purchase restoration and provider verification are not implemented. Confirm the applicable store business model and review requirements before submission. No store availability, approval or signed-release claim is made by the preview packages.
