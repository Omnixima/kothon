# Kothon for Windows

Kothon builds for 64-bit Windows 10 and 11 from the same code as the Mac app.
A Mac can't build the Windows installer, so GitHub Actions builds it
(`.github/workflows/windows.yml`).

## Test build

Every push to `main` builds a test installer. To build one by hand:

1. On GitHub: **Actions → Windows build → Run workflow**, leave the tag empty.
2. When the run is green (about 30 to 40 minutes the first time, faster after),
   download the **kothon-windows-x64** artifact at the bottom of the run page.
3. On the PC, unzip it and run `Kothon_<version>_x64-setup.exe`.

Until the installer is signed, Windows SmartScreen says "Windows protected your
PC". Click **More info → Run anyway**.

What to check on the PC:

- The 4-step onboarding: language, model download, microphone access, first words.
- Hold **Ctrl + Space** in Notepad, Word, a browser and say a Bengali sentence.
  The text should appear where the cursor is.
- The Bengali punctuation and number options, and switching to English.
- The tray icon (bottom right, maybe under the ^ arrow) opens the window.
- Speed: a short sentence should come back about as fast as on the Mac with
  the দ্রুত model. Kothon uses the GPU through Vulkan when the driver has it,
  otherwise the CPU.
- Uninstall from Settings → Apps leaves no Kothon in Start.

Models and history live in `%APPDATA%\com.kothon.dictation\`.

## Release

Only after the test build has been tested:

1. Set the new version in `src-tauri/tauri.conf.json` (and `Cargo.toml`) and push.
2. Release the Mac app as usual with `scripts/kothon/release.sh` and
   `gh release create v<version> ...`. This makes the release and its
   `latest.json` with the Mac entry.
3. **Actions → Windows build → Run workflow**, with the tag `v<version>`.
   It builds again from that commit, uploads the installer and its `.sig` to the
   release, and adds `windows-x86_64` to the release's `latest.json`. The Mac
   entry stays as it is.

Windows installs then update themselves like the Mac app.

One-time setup for the updater signature: add the updater key as a repository
secret (the same key the Mac release uses):

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo Omnixima/kothon < ~/.tauri/kothon-updater.key
```

## Code signing (SignPath)

SignPath Foundation signs open-source Windows apps for free. The workflow
already has the signing steps; they switch on by themselves once these exist
in the repository settings:

| Kind     | Name                           | Value                               |
| -------- | ------------------------------ | ----------------------------------- |
| Variable | `SIGNPATH_ORGANIZATION_ID`     | From SignPath, after approval       |
| Secret   | `SIGNPATH_API_TOKEN`           | API token of a SignPath CI user     |
| Variable | `SIGNPATH_PROJECT_SLUG`        | Optional, default `kothon`          |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | Optional, default `release-signing` |

In SignPath, the project needs two artifact configurations, named `binaries`
(a zip of `kothon.exe` and Kothon's DLLs, sign each PE file) and `installer`
(a zip holding the setup `.exe`, sign it). The signed flow signs the app first,
builds the installer around it, then signs the installer, so both carry the
signature. It hasn't run yet; expect to adjust it on the first signed build.

The certificate is SignPath Foundation's, so Windows shows the publisher as
"SignPath Foundation".

### Applying

1. Add a code signing policy to the README (SignPath asks for one). Example:

   > **Code signing policy.** Free code signing provided by
   > [SignPath.io](https://signpath.io), certificate by
   > [SignPath Foundation](https://signpath.org). Committers and approvers:
   > [Omnixima](https://github.com/Omnixima). Kothon works offline. It only
   > goes online to download the models you pick and to check GitHub for
   > updates; it sends no audio, text or usage data anywhere.

2. Apply at [signpath.org](https://signpath.org) with the repository URL. They
   check that the project is open source (MIT is fine), released, maintained,
   and built from source on GitHub Actions.
3. After approval, set up the project, the two artifact configurations and a
   signing policy with SignPath, and connect the GitHub repository as a trusted
   build system.
4. Add the variable and secret above. The next run signs.
