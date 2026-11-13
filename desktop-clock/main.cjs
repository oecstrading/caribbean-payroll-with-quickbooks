const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require("electron");
const path = require("path");
const CLOCK_URL = "https://caribbean-payroll-with-quickbooks.lovable.app/kiosk";
const ORIGIN = new URL(CLOCK_URL).origin;
let win, tray, quitting = false;
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on("second-instance", () => show());
function show() { if (!win) return create(); win.show(); win.focus(); }
function create(hidden) {
  win = new BrowserWindow({ width: 520, height: 820, title: "OECS Time Clock", icon: path.join(__dirname, "icon.png"), show: !hidden, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false } });
  win.loadURL(CLOCK_URL);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(ORIGIN)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.session.setPermissionRequestHandler((wc, perm, cb) => cb(["geolocation", "media"].includes(perm) && wc.getURL().startsWith(ORIGIN)));
  win.on("close", (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
}
function menu() {
  const auto = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Time Clock", click: show },
    { label: "Reload clock", click: () => win && win.reload() },
    { type: "separator" },
    { label: "Start with Windows", type: "checkbox", checked: auto, click: (i) => { app.setLoginItemSettings({ openAtLogin: i.checked, args: ["--hidden"] }); menu(); } },
    { type: "separator" },
    { label: "Quit Time Clock", click: () => { quitting = true; app.quit(); } },
  ]));
}
app.whenReady().then(() => {
  if (!app.getLoginItemSettings().openAtLogin && !require("fs").existsSync(path.join(app.getPath("userData"), ".configured"))) {
    app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });
    require("fs").writeFileSync(path.join(app.getPath("userData"), ".configured"), "1");
  }
  create(process.argv.includes("--hidden"));
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 16, height: 16 }));
  tray.setToolTip("OECS Time Clock — click to clock in or out");
  tray.on("click", show);
  menu();
});
app.on("window-all-closed", (e) => e.preventDefault());
