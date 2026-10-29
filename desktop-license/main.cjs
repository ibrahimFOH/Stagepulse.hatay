const { app, BrowserWindow, shell } = require("electron");
const PANEL_URL = "https://stagepulse.com.tr/lisans/";

function isTrustedPanel(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "stagepulse.com.tr" &&
      (url.pathname === "/lisans" || url.pathname === "/lisans/" || url.pathname.startsWith("/lisans/"));
  } catch { return false; }
}
function createWindow() {
  const window = new BrowserWindow({
    width: 1180, height: 820, minWidth: 760, minHeight: 600,
    show: false, autoHideMenuBar: true, backgroundColor: "#090909",
    title: "Stagepulse Lisans Yönetimi",
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedPanel(url)) void window.loadURL(url);
    else void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => { if (!isTrustedPanel(url)) event.preventDefault(); });
  window.loadURL(PANEL_URL);
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
