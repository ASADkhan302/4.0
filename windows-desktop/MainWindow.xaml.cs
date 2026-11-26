using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace UniversityOfLakkiMarwatLMS.Desktop
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// Hosts the ULM LMS single-page application inside Microsoft Edge WebView2 Chromium runtime
    /// and exposes the native desktop bridge (`window.desktopAPI`) for offline storage & folder migration.
    /// </summary>
    public partial class MainWindow : Window
    {
        private const string LocalDevUrl = "http://localhost:3000";
        private const string VirtualHostName = "app.local";
        private const string LibraryDbFileName = "Library.ulmlib";
        private const string MasterExcelFileName = "ULM_Master_Books_Register.xlsx";

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        private sealed class DesktopConfig
        {
            public string LibraryDataPath { get; set; } = string.Empty;
        }

        private string _activeLibraryFolder = string.Empty;

        public MainWindow()
        {
            InitializeComponent();
            _activeLibraryFolder = LoadOrInitializeLibraryFolder();
            Loaded += MainWindow_Loaded;
        }

        private static string GetConfigFilePath()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string configDir = Path.Combine(localAppData, "ULM_Central_Library");
            Directory.CreateDirectory(configDir);
            return Path.Combine(configDir, "config.json");
        }

        private static string GetDefaultLibraryFolder()
        {
            string docs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            string fallback = Path.Combine(docs, "ULM Library Data");
            Directory.CreateDirectory(fallback);
            return fallback;
        }

        private static string LoadOrInitializeLibraryFolder()
        {
            try
            {
                string configPath = GetConfigFilePath();
                if (File.Exists(configPath))
                {
                    string json = File.ReadAllText(configPath, Encoding.UTF8);
                    var cfg = JsonSerializer.Deserialize<DesktopConfig>(json, JsonOptions);
                    if (!string.IsNullOrWhiteSpace(cfg?.LibraryDataPath))
                    {
                        string normalized = Path.GetFullPath(cfg.LibraryDataPath.Trim());
                        Directory.CreateDirectory(normalized);
                        return normalized;
                    }
                }
            }
            catch
            {
                // Fall back to default Documents folder
            }

            string defaultFolder = GetDefaultLibraryFolder();
            SaveLibraryFolderConfig(defaultFolder);
            return defaultFolder;
        }

        private static void SaveLibraryFolderConfig(string folderPath)
        {
            string configPath = GetConfigFilePath();
            var cfg = new DesktopConfig { LibraryDataPath = folderPath };
            File.WriteAllText(configPath, JsonSerializer.Serialize(cfg, JsonOptions), Encoding.UTF8);
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                await InitializeWebViewAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Failed to initialize Microsoft Edge WebView2 runtime.\n\nError: {ex.Message}\n\nPlease install the Evergreen WebView2 Runtime from Microsoft.",
                    "ULM LMS Desktop Startup Error",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error
                );
            }
        }

        private async Task InitializeWebViewAsync()
        {
            // Configure user data folder in LocalAppData for persistent SQLite/IndexedDB/localStorage storage
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string userDataFolder = Path.Combine(localAppData, "UniversityOfLakkiMarwatLMS", "WebView2Data");
            Directory.CreateDirectory(userDataFolder);

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await webView.EnsureCoreWebView2Async(env);

            // Configure WebView2 settings
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

            // Inject native window.desktopAPI preload bridge before document scripts run
            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(BuildDesktopPreloadScript());

            // Handle native window & storage RPC messages from React frontend
            webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

            // Check if local Vite dev server is running (e.g. while debugging in Visual Studio)
            bool isDevServerActive = await CheckUrlAvailableAsync(LocalDevUrl);

            if (isDevServerActive)
            {
                webView.CoreWebView2.Navigate(LocalDevUrl);
            }
            else
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string distFolder = Path.Combine(baseDir, "wwwroot");

                if (!Directory.Exists(distFolder))
                {
                    string directDist = Path.Combine(baseDir, "dist");
                    if (Directory.Exists(directDist))
                    {
                        distFolder = directDist;
                    }
                    else
                    {
                        string altPath = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "dist"));
                        if (Directory.Exists(altPath))
                        {
                            distFolder = altPath;
                        }
                    }
                }

                if (Directory.Exists(distFolder))
                {
                    webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        VirtualHostName,
                        distFolder,
                        CoreWebView2HostResourceAccessKind.Allow
                    );
                    webView.CoreWebView2.Navigate($"https://{VirtualHostName}/index.html");
                }
                else
                {
                    webView.CoreWebView2.NavigateToString(
                        "<html><body style='font-family:sans-serif;background:#0B1120;color:#F8FAFC;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'>" +
                        "<div style='text-align:center;padding:40px;border:1px solid #334155;border-radius:16px;background:#0F172A;'>" +
                        "<h2 style='color:#F59E0B;'>University of Lakki Marwat — Central Campus Library</h2>" +
                        "<p>Frontend assets not found. Please run <code>npm run build</code> in the project directory, then rebuild in Visual Studio.</p>" +
                        "<p style='color:#94A3B8;'>Or start the dev server with <code>npm run dev</code> for live reload debugging.</p>" +
                        "</div></body></html>"
                    );
                }
            }

            webView.NavigationCompleted += (s, args) =>
            {
                loadingOverlay.Visibility = Visibility.Collapsed;
            };
        }

        private static string BuildDesktopPreloadScript()
        {
            return @"
(function () {
  if (window.desktopAPI && window.desktopAPI.__ulmBridgeInstalled) return;
  let seq = 0;
  const pending = new Map();

  if (window.chrome && window.chrome.webview) {
    window.chrome.webview.addEventListener('message', function (event) {
      let msg = event && event.data;
      if (typeof msg === 'string') {
        try { msg = JSON.parse(msg); } catch { return; }
      }
      if (!msg || typeof msg !== 'object' || !msg.id) return;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) {
        entry.reject(new Error(String(msg.error)));
      } else {
        entry.resolve(msg.result);
      }
    });
  }

  function invoke(method, params) {
    return new Promise(function (resolve, reject) {
      if (!window.chrome || !window.chrome.webview) {
        reject(new Error('WebView2 bridge unavailable.'));
        return;
      }
      const id = 'desktop_' + Date.now() + '_' + (++seq);
      pending.set(id, { resolve: resolve, reject: reject });
      window.chrome.webview.postMessage({ id: id, method: method, params: params || {} });
    });
  }

  window.desktopAPI = {
    __ulmBridgeInstalled: true,
    isDesktop: true,
    platform: 'win32',
    getDefaultRepoPath: function () { return invoke('getDefaultRepoPath'); },
    changeLibraryLocation: function () { return invoke('changeLibraryLocation'); },
    selectLibraryFolder: function () { return invoke('selectLibraryFolder'); },
    chooseLibraryFolder: function () { return invoke('changeLibraryLocation'); },
    selectFolder: function () { return invoke('changeLibraryLocation'); },
    openFolderInExplorer: function (folderPath) { return invoke('openFolderInExplorer', { folderPath: folderPath || '' }); },
    checkLibraryFile: function (filename) { return invoke('checkLibraryFile', { filename: filename || 'Library.ulmlib' }); },
    readLibraryFile: function (filename) { return invoke('readLibraryFile', { filename: filename || '' }); },
    writeLibraryFile: function (filename, content) { return invoke('writeLibraryFile', { filename: filename || '', content: content || '' }); },
    writeLocalFile: function (filename, content, options) {
      return invoke('writeLocalFile', {
        filename: filename || '',
        content: content || '',
        encoding: (options && options.encoding) || 'utf8'
      });
    },
    saveBinaryFile: function (defaultName, base64Data) {
      return invoke('saveBinaryFile', { defaultName: defaultName || 'export.bin', base64Data: base64Data || '' });
    },
    printCurrentView: function () { return invoke('printCurrentView'); },
    windowControl: function (action) {
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({ type: 'WINDOW_CONTROL', action: action });
      }
    }
  };
})();
";
        }

        private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string rawJson = string.Empty;
                try
                {
                    rawJson = e.WebMessageAsJson ?? string.Empty;
                }
                catch
                {
                    // Fall back to string payload
                }

                if (string.IsNullOrWhiteSpace(rawJson))
                {
                    try
                    {
                        rawJson = e.TryGetWebMessageAsString() ?? string.Empty;
                    }
                    catch
                    {
                        return;
                    }
                }

                if (string.IsNullOrWhiteSpace(rawJson)) return;

                using JsonDocument doc = JsonDocument.Parse(rawJson);
                JsonElement root = doc.RootElement;
                if (root.ValueKind == JsonValueKind.String)
                {
                    string nested = root.GetString() ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(nested)) return;
                    using JsonDocument nestedDoc = JsonDocument.Parse(nested);
                    HandleParsedMessage(nestedDoc.RootElement);
                    return;
                }

                HandleParsedMessage(root);
            }
            catch
            {
                // Ignore malformed messages
            }
        }

        private void HandleParsedMessage(JsonElement root)
        {
            if (root.ValueKind != JsonValueKind.Object) return;

            // 1. JSON-RPC method calls ({ id, method, params })
            if (root.TryGetProperty("method", out JsonElement methodEl) && methodEl.ValueKind == JsonValueKind.String)
            {
                string method = methodEl.GetString() ?? string.Empty;
                string id = root.TryGetProperty("id", out JsonElement idEl) ? (idEl.GetString() ?? string.Empty) : string.Empty;
                JsonElement parameters = root.TryGetProperty("params", out JsonElement pEl) && pEl.ValueKind == JsonValueKind.Object
                    ? pEl
                    : default;

                object? result = null;
                string? error = null;

                try
                {
                    switch (method)
                    {
                        case "changeLibraryLocation":
                        case "selectLibraryFolder":
                        case "chooseLibraryFolder":
                        case "selectFolder":
                            result = HandleChangeLibraryLocation();
                            break;
                        case "getDefaultRepoPath":
                            result = _activeLibraryFolder;
                            break;
                        case "openFolderInExplorer":
                            result = HandleOpenFolderInExplorer(GetStringParam(parameters, "folderPath"));
                            break;
                        case "checkLibraryFile":
                            result = HandleCheckLibraryFile(GetStringParam(parameters, "filename", LibraryDbFileName));
                            break;
                        case "readLibraryFile":
                            result = HandleReadLibraryFile(GetStringParam(parameters, "filename"));
                            break;
                        case "writeLibraryFile":
                            result = HandleWriteLibraryFile(
                                GetStringParam(parameters, "filename"),
                                GetStringParam(parameters, "content"),
                                "utf8"
                            );
                            break;
                        case "writeLocalFile":
                            result = HandleWriteLibraryFile(
                                GetStringParam(parameters, "filename"),
                                GetStringParam(parameters, "content"),
                                GetStringParam(parameters, "encoding", "utf8")
                            );
                            break;
                        case "saveBinaryFile":
                            result = HandleSaveBinaryFile(
                                GetStringParam(parameters, "defaultName", "export.pdf"),
                                GetStringParam(parameters, "base64Data")
                            );
                            break;
                        case "printCurrentView":
                            Dispatcher.Invoke(() => webView.CoreWebView2?.ShowPrintUI());
                            result = true;
                            break;
                        default:
                            error = $"Unsupported desktop bridge method: {method}";
                            break;
                    }
                }
                catch (Exception ex)
                {
                    error = ex.Message;
                }

                if (!string.IsNullOrEmpty(id))
                {
                    PostRpcResponse(id, result, error);
                }
                return;
            }

            // 2. Legacy window control & browse-folder messages ({ type, action })
            if (root.TryGetProperty("action", out JsonElement actionEl) && actionEl.ValueKind == JsonValueKind.String)
            {
                string action = actionEl.GetString() ?? string.Empty;
                switch (action)
                {
                    case "minimize":
                        Dispatcher.Invoke(() => WindowState = WindowState.Minimized);
                        break;
                    case "maximize":
                        Dispatcher.Invoke(() =>
                        {
                            WindowState = (WindowState == WindowState.Maximized) ? WindowState.Normal : WindowState.Maximized;
                        });
                        break;
                    case "close":
                        Dispatcher.Invoke(Close);
                        break;
                    case "browse-folder":
                    {
                        var outcome = HandleChangeLibraryLocation();
                        if (outcome.Ok && !string.IsNullOrWhiteSpace(outcome.Path))
                        {
                            string payload = JsonSerializer.Serialize(new
                            {
                                @event = "folder-selected",
                                folderPath = outcome.Path
                            });
                            Dispatcher.Invoke(() => webView.CoreWebView2?.PostWebMessageAsJson(payload));
                        }
                        break;
                    }
                }
            }
        }

        private sealed class ChangeLocationResult
        {
            public bool Ok { get; set; }
            public bool Cancelled { get; set; }
            public bool Canceled => Cancelled;
            public string? Path { get; set; }
            public string? Error { get; set; }
        }

        /// <summary>
        /// Opens the built-in .NET 8 WPF OpenFolderDialog on the STA UI thread owned by MainWindow,
        /// validates write access, safely migrates Library.ulmlib & Master Excel without overwriting
        /// an existing destination DB, persists config.json, and returns the updated path.
        /// </summary>
        private ChangeLocationResult HandleChangeLibraryLocation()
        {
            string currentFolder = string.IsNullOrWhiteSpace(_activeLibraryFolder)
                ? LoadOrInitializeLibraryFolder()
                : _activeLibraryFolder;

            string? selectedPath = Application.Current.Dispatcher.Invoke(() =>
            {
                var dialog = new OpenFolderDialog
                {
                    Title = "Select ULM Library Data Folder",
                    InitialDirectory = Directory.Exists(currentFolder)
                        ? currentFolder
                        : Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    Multiselect = false
                };

                return dialog.ShowDialog(this) == true ? dialog.FolderName : null;
            });

            if (string.IsNullOrWhiteSpace(selectedPath))
            {
                return new ChangeLocationResult { Ok = false, Cancelled = true };
            }

            try
            {
                string normalizedTarget = Path.GetFullPath(selectedPath.Trim());
                Directory.CreateDirectory(normalizedTarget);

                // Verify write permissions with a temporary probe file
                string probePath = Path.Combine(normalizedTarget, $".ulm_write_probe_{Guid.NewGuid():N}.tmp");
                File.WriteAllText(probePath, "ok", Encoding.UTF8);
                File.Delete(probePath);

                string normalizedCurrent = Directory.Exists(currentFolder)
                    ? Path.GetFullPath(currentFolder)
                    : currentFolder;

                if (!string.Equals(normalizedTarget, normalizedCurrent, StringComparison.OrdinalIgnoreCase))
                {
                    // Migrate Library.ulmlib only if destination does not already contain one
                    string sourceDb = Path.Combine(normalizedCurrent, LibraryDbFileName);
                    string targetDb = Path.Combine(normalizedTarget, LibraryDbFileName);
                    if (File.Exists(sourceDb) && !File.Exists(targetDb))
                    {
                        File.Copy(sourceDb, targetDb, overwrite: false);
                    }

                    // Migrate Master Excel register if present and not already in destination
                    string sourceExcel = Path.Combine(normalizedCurrent, MasterExcelFileName);
                    string targetExcel = Path.Combine(normalizedTarget, MasterExcelFileName);
                    if (File.Exists(sourceExcel) && !File.Exists(targetExcel))
                    {
                        File.Copy(sourceExcel, targetExcel, overwrite: false);
                    }
                }

                SaveLibraryFolderConfig(normalizedTarget);
                _activeLibraryFolder = normalizedTarget;

                return new ChangeLocationResult
                {
                    Ok = true,
                    Cancelled = false,
                    Path = normalizedTarget
                };
            }
            catch (Exception ex)
            {
                return new ChangeLocationResult
                {
                    Ok = false,
                    Cancelled = false,
                    Error = $"Could not change library folder location: {ex.Message}"
                };
            }
        }

        private bool HandleOpenFolderInExplorer(string? folderPath)
        {
            try
            {
                string target = !string.IsNullOrWhiteSpace(folderPath) && Directory.Exists(folderPath)
                    ? folderPath
                    : _activeLibraryFolder;
                Directory.CreateDirectory(target);
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = $"\"{target}\"",
                    UseShellExecute = true
                });
                return true;
            }
            catch
            {
                return false;
            }
        }

        private object HandleCheckLibraryFile(string filename)
        {
            string safeName = Path.GetFileName(string.IsNullOrWhiteSpace(filename) ? LibraryDbFileName : filename);
            string fullPath = Path.Combine(_activeLibraryFolder, safeName);
            if (!File.Exists(fullPath))
            {
                return new { exists = false, sizeBytes = 0L, lastModified = (string?)null, fullPath };
            }

            var info = new FileInfo(fullPath);
            return new
            {
                exists = true,
                sizeBytes = info.Length,
                lastModified = info.LastWriteTimeUtc.ToString("O"),
                fullPath
            };
        }

        private string? HandleReadLibraryFile(string filename)
        {
            if (string.IsNullOrWhiteSpace(filename)) return null;
            string safeName = Path.GetFileName(filename);
            string fullPath = Path.Combine(_activeLibraryFolder, safeName);
            if (!File.Exists(fullPath)) return null;
            return File.ReadAllText(fullPath, Encoding.UTF8);
        }

        private object HandleWriteLibraryFile(string filename, string content, string encoding)
        {
            if (string.IsNullOrWhiteSpace(filename))
            {
                return new { ok = false };
            }

            Directory.CreateDirectory(_activeLibraryFolder);
            string safeName = Path.GetFileName(filename);
            string fullPath = Path.Combine(_activeLibraryFolder, safeName);

            if (string.Equals(encoding, "base64", StringComparison.OrdinalIgnoreCase) ||
                content.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                int commaIdx = content.IndexOf(',');
                string cleanBase64 = commaIdx >= 0 ? content[(commaIdx + 1)..] : content;
                byte[] bytes = Convert.FromBase64String(cleanBase64);
                File.WriteAllBytes(fullPath, bytes);
            }
            else
            {
                File.WriteAllText(fullPath, content, Encoding.UTF8);
            }

            return new { ok = true, fullPath };
        }

        private bool HandleSaveBinaryFile(string defaultName, string base64Data)
        {
            if (string.IsNullOrWhiteSpace(base64Data)) return false;

            string? savePath = Application.Current.Dispatcher.Invoke(() =>
            {
                var dlg = new SaveFileDialog
                {
                    FileName = Path.GetFileName(defaultName),
                    InitialDirectory = Directory.Exists(_activeLibraryFolder)
                        ? _activeLibraryFolder
                        : Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    Filter = "All Files (*.*)|*.*"
                };
                return dlg.ShowDialog(this) == true ? dlg.FileName : null;
            });

            if (string.IsNullOrWhiteSpace(savePath)) return false;

            int commaIdx = base64Data.IndexOf(',');
            string cleanBase64 = commaIdx >= 0 ? base64Data[(commaIdx + 1)..] : base64Data;
            byte[] bytes = Convert.FromBase64String(cleanBase64);
            File.WriteAllBytes(savePath, bytes);
            return true;
        }

        private void PostRpcResponse(string id, object? result, string? error)
        {
            string payload = JsonSerializer.Serialize(new
            {
                id,
                result,
                error
            }, JsonOptions);

            Dispatcher.Invoke(() => webView.CoreWebView2?.PostWebMessageAsJson(payload));
        }

        private static string GetStringParam(JsonElement parameters, string name, string fallback = "")
        {
            if (parameters.ValueKind == JsonValueKind.Object &&
                parameters.TryGetProperty(name, out JsonElement el) &&
                el.ValueKind == JsonValueKind.String)
            {
                return el.GetString() ?? fallback;
            }
            return fallback;
        }

        private static async Task<bool> CheckUrlAvailableAsync(string url)
        {
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(400) };
                var response = await client.GetAsync(url);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
