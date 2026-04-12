# JetDesk

> **⚠️ Disclaimer:** This project is heavily *vibe-coded*. Expect occasional quirks, undocumented features, and code that flows on pure momentum. 

JetDesk is a powerful, low-latency remote workstation management and control solution. It balances ease-of-use with high performance, bridging the gap between your Windows desktop and mobile device to provide seamless control, window management, screen sharing, and secure automation.

The environment is built using two primary components:
1. **Daemon:** A lightweight Node.js background process running on the host Windows machine.
2. **App:** A React Native (Expo) mobile application to control the host.

---

## 🚀 Features

- **Touch & Mouse Abstraction:** Full simulation of mouse movement, clicks, scrolling, and dragging with absolute and relative positioning mapped perfectly to your phone.
- **Keyboard Injection:** Global hotkey invocation, complex keystrokes, modifiers, and rich text typing directly from mobile to the desktop.
- **Live Screen Casting:** High-performance, low-latency live view of your desktop directly into your mobile app.
- **App & Window Management:** Complete control over live windows—list, minimize, focus, close, and dynamically launch applications over the network.
- **Clipboard Syncing:** Two-way sync allows fetching the desktop clipboard directly from the phone or setting it securely.
- **Power & System Controls:** Built-in actions to Sleep, Lock, Shutdown, Restart, as well as a Wake-on-LAN fallback for powered-down machines.
- **Remote Terminal/Shell:** Run predefined commands and scripts safely using the allowed remote shell execution modules.
- **Secure Web Console:** Auto-deployed system tray app that grants access to a local HTTPS dashboard for management, setting preferences, and configuring accepted remote terminals. 

---

## 🧠 Workings & Architecture

The JetDesk ecosystem is designed around maximum performance and modularity.
- **Host Daemon (`/daemon`)**: Leveraging Win32 bindings (via `koffi`), `node-forge` for cryptography, and native process spawners, the daemon interfaces incredibly low-level with Windows to mimic native inputs instead of using slower user-space alternatives.
- **Client App (`/app`)**: Powered by React Native and Expo, utilizing `react-native-tcp-socket` and `zustand` for state management. Features a complex connection lifecycle manager tracking AppState (background/foreground flags), and dropping pings off when the screen sleeps to preserve battery.

---

## 🔒 Protocol & Security

All interactions with the host daemon are tightly secured and heavily optimized:

- **Transport:** All communication takes place over a **Raw TLS Socket (Port 57423)**. This ensures that latency remains incredibly low (skipping the overhead of HTTP/WebSocket protocols) while remaining strictly encrypted.
- **Certificates:** Self-signed TLS certificates are dynamically provisioned using `node-forge`. The mobile app authenticates the server using persistent **Certificate Fingerprints** to prevent MITM attacks. 
- **Auto-Discovery:** Uses **mDNS/Bonjour** (`_jetdesk_._tcp.local`) to broadcast device availability over local networks for zero-configuration discovery.
- **Authentication Handshake:**
  1. Connection is opened.
  2. The Daemon issues a `pairing.challenge` with a unique nonce.
  3. The New Client submits a PIN-based `pairing.verify` request (usually done via scanning a QR from the desktop web console).
  4. On success, a persistent `sessionToken` is exchanged.
  5. Subsequent reconnections skip PIN-entry by submitting the `sessionToken`.
- **Payload Formatting:** Uses Newline-Delimited JSON framing (`v1` specification). Example: `{ "v": 1, "type": "system.lock", "seq": 4, "payload": {} } \n`

---

## 🛠️ How to Start Using (End User)

If you just want to run JetDesk out-of-the-box using the pre-compiled packages:

1. **Get the files:** Navigate to the `/downloadables/` directory of the project.
2. **Install to PC:** Launch the `JetDeskDaemon.exe` on your Windows Desktop. A `SysTray` icon will appear, and it will spawn an internal secure Web Console locally on `https://<YOUR_IP>:57424/`.
3. **Install to Phone:** Sideload and install the `JetDeskApp.apk` on your local Android device.
4. **Pair the Devices:** 
   - Open the Mobile App.
   - It will automatically discover the PC on the network.
   - Pair using the PIN generated inside the PC's Web Console or automatically pair by scanning the QR code showing on your Desktop.
5. **Take Control:** Use the mobile UI to manage your mouse, windows, and execute system commands.

---

## 💻 How to Start Development

To extend or modify the platform, you will need a fully capable development environment.

### Prerequisites
- Node.js (v20+ recommended)
- React Native / Expo CLI setup.
- Android Studio / Android SDK (for mobile environment emulation).
- Python 3 & MSVC C++ Build Tools (required to compile Windows bindings like `koffi` and `node-active-window`).

### 1. Launching the Daemon
The daemon runs on `nodemon` watching TypeScript sources to hot-reload dynamically.
```bash
cd daemon
npm install
npm run start
```
*A browser window should automatically pop open routing you to `https://localhost:57424`.*

### 2. Launching the App
The app runs on Expo.
```bash
cd app
npm install
npm run start
```
*From the Expo CLI, press `a` to run the frontend in your Android Emulator or scan the Expo Go QR Code.*

---

## 🏗️ Building for Production

A universal build script (`build-release.ps1`) is provided to automate bundling both packages.
This uses `caxa` for the Node.js executable bounding, and `gradlew` for the APK compilation.

1. Ensure global deps are available if needed.
2. Run the build pipeline from the project root using PowerShell:

```powershell
.\scripts\build-release.ps1
```

3. The script will output raw standalone packages directly into the `/downloadables/` directory:
   - `JetDeskDaemon.exe` (Standalone background Windows Process)
   - `JetDeskApp.apk` (Release Android APK)
