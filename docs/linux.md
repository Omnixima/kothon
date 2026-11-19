# Kothon for Linux

Kothon builds for 64-bit Linux as a `.deb`, for Ubuntu 22.04 and newer,
Debian 12 and Linux Mint 21 and newer. GitHub Actions builds it
(`.github/workflows/linux.yml`).

## Test build

Every push to `main` builds a test package. To build one by hand, use
**Actions → Linux build → Run workflow** with the tag left empty, then download
the **kothon-linux-x64** artifact from the run page. On the Linux PC:

```bash
unzip kothon-linux-x64.zip
sudo apt install ./Kothon_*_amd64.deb
```

Kothon then shows up in the app menu. The default shortcut is
<kbd>Ctrl</kbd> <kbd>Space</kbd>.

What to check:

- Onboarding, the model download and the first words.
- Dictating into a text editor, a browser and a terminal. On Wayland, global
  shortcuts and typing into other apps are limited; X11 sessions work best.
- The tray icon. GNOME needs the AppIndicator extension to show tray icons
  (Ubuntu has it by default).

Models and history live in `~/.local/share/com.kothon.dictation/`.

## Release

After testing, and after the Mac release for that version exists:
**Actions → Linux build → Run workflow** with the tag `v<version>`. It attaches
the `.deb` to the release.

The `.deb` doesn't update itself: Tauri's updater only updates AppImages.
Users install new versions from Releases. An AppImage build (which could
update itself) can come later if people ask for it.
