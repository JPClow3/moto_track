using System.Diagnostics;
using System.Globalization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
namespace MotoTrack;

internal sealed class MotoTrackWindow : Form
{
    private static readonly Uri Origin = new("https://moto-track.net");
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };
    private readonly Panel failure = new() { Dock = DockStyle.Fill, Visible = false };
    private readonly ToolStrip toolbar = new() { Dock = DockStyle.Top, GripStyle = ToolStripGripStyle.Hidden, AutoSize = false, Height = 48 };
    private bool English => CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "en";
    private string Copy(string pt, string en) => English ? en : pt;

    internal MotoTrackWindow()
    {
        Text = "Moto Track"; Width = 1280; Height = 860; MinimumSize = new Size(390, 640);
        StartPosition = FormStartPosition.CenterScreen;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        toolbar.AccessibleName = Copy("Controles do aplicativo", "App controls");
        AddButton(Copy("Voltar", "Back"), (_, _) => { if (browser.CoreWebView2?.CanGoBack == true) { failure.Visible = false; browser.Visible = true; browser.GoBack(); } });
        AddButton(Copy("Atualizar", "Reload"), (_, _) => Retry());
        AddButton(Copy("Copiar link do app", "Copy app link"), (_, _) => Clipboard.SetText("https://moto-track.net"));
        AddButton(Copy("Suporte", "Support"), (_, _) => browser.CoreWebView2?.Navigate(new Uri(Origin, "/suporte").AbsoluteUri));
        Controls.Add(browser); Controls.Add(failure); Controls.Add(toolbar);
        var message = new Label { Text = Copy("Não foi possível conectar. Confira a conexão e tente novamente. Seus registros na nuvem não foram apagados.", "Couldn't connect. Check your connection and retry. Your cloud records have not been deleted."), Dock = DockStyle.Top, Height = 100, Padding = new Padding(24) };
        var retry = new Button { Text = Copy("Tentar novamente", "Retry"), Dock = DockStyle.Top, Height = 48 };
        retry.Click += (_, _) => Retry(); failure.Controls.Add(retry); failure.Controls.Add(message);
        Shown += async (_, _) => await InitializeAsync();
    }
    private void AddButton(string title, EventHandler click)
    {
        var button = new ToolStripButton(title) { Padding = new Padding(12, 6, 12, 6), AccessibleName = title };
        button.Click += click; toolbar.Items.Add(button);
    }
    private static bool Owned(Uri uri) => uri.Scheme == Uri.UriSchemeHttps && uri.Host == Origin.Host && uri.IsDefaultPort;
    // Same paths as Android and iOS: native clients never open pricing, checkout or the portal.
    private static bool Restricted(Uri uri) => uri.AbsolutePath.TrimEnd('/') is "/precos" or "/billing" or "/billing/checkout" or "/billing/portal";
    private async Task InitializeAsync()
    {
        try
        {
            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MotoTrack", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, profile, new CoreWebView2EnvironmentOptions { Language = English ? "en-US" : "pt-BR" });
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2;
            core.Settings.UserAgent += " MotoTrackNative/Windows";
#if DEBUG
            core.Settings.AreDevToolsEnabled = true;
#else
      core.Settings.AreDevToolsEnabled=false;
#endif
            core.Settings.IsStatusBarEnabled = false;
            core.NavigationStarting += (_, args) =>
            {
                if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri)) { args.Cancel = true; return; }
                if (Owned(uri) && Restricted(uri))
                {
                    args.Cancel = true;
                    core.Navigate(new Uri(Origin, "/app-info").AbsoluteUri);
                    return;
                }
                if (!Owned(uri))
                {
                    args.Cancel = true;
                    if (uri.Scheme == Uri.UriSchemeHttps || (args.IsUserInitiated && uri.Scheme == "mailto")) OpenExternal(uri);
                }
            };
            core.NewWindowRequested += (_, args) =>
            {
                args.Handled = true;
                if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri)) return;
                // The system browser has no WebView2 session cookies, so app
                // links (target="_blank") stay in this window, signed in.
                if (Owned(uri)) core.Navigate(uri.AbsoluteUri);
                else if (args.IsUserInitiated && uri.Scheme == Uri.UriSchemeHttps) OpenExternal(uri);
            };
            core.NavigationCompleted += (_, args) => { if (!args.IsSuccess && args.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled) ShowFailure(); };
            core.PermissionRequested += (_, args) =>
            {
                if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) || !Owned(uri)) { args.State = CoreWebView2PermissionState.Deny; return; }
                if (args.PermissionKind != CoreWebView2PermissionKind.Geolocation) return;
                // Without a deferral WebView2 resolves the request when this
                // handler returns, before the rider answers the dialog.
                var deferral = args.GetDeferral();
                BeginInvoke((Action)(() =>
                {
                    try
                    {
                        args.State = MessageBox.Show(this, Copy("Permitir localização para consultar postos próximos?", "Allow location to find nearby fuel stations?"), "Moto Track", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
                    }
                    finally { deferral.Complete(); }
                }));
            };
            core.DownloadStarting += (_, args) =>
            {
                if (!Uri.TryCreate(args.DownloadOperation.Uri, UriKind.Absolute, out var uri) || !Owned(uri)) { args.Cancel = true; return; }
                var deferral = args.GetDeferral();
                BeginInvoke((Action)(() =>
                {
                    try
                    {
                        using var dialog = new SaveFileDialog { FileName = Path.GetFileName(args.ResultFilePath), Title = Copy("Salvar arquivo do Moto Track", "Save Moto Track file") };
                        if (dialog.ShowDialog(this) == DialogResult.OK) args.ResultFilePath = dialog.FileName; else args.Cancel = true;
                        args.Handled = true;
                    }
                    finally { deferral.Complete(); }
                }));
            };
            core.Navigate(new Uri(Origin, "/dashboard").AbsoluteUri);
        }
        catch (Exception error) when (error is WebView2RuntimeNotFoundException || error is System.Runtime.InteropServices.COMException)
        {
            ShowFailure();
            MessageBox.Show(this, Copy("O Microsoft Edge WebView2 Runtime é necessário. Instale o runtime oficial da Microsoft e tente novamente.", "Microsoft Edge WebView2 Runtime is required. Install the official Microsoft runtime and retry."), "Moto Track", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
    private static void OpenExternal(Uri uri)
    {
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); } catch (System.ComponentModel.Win32Exception) { }
    }
    private void Retry()
    {
        if (browser.CoreWebView2 == null) { _ = InitializeAsync(); return; }
        failure.Visible = false; browser.Visible = true;
        var target = browser.Source;
        browser.CoreWebView2.Navigate(target != null && Owned(target) ? target.AbsoluteUri : new Uri(Origin, "/dashboard").AbsoluteUri);
    }
    private void ShowFailure() { browser.Visible = false; failure.Visible = true; failure.BringToFront(); toolbar.BringToFront(); }
    protected override void Dispose(bool disposing) { if (disposing) browser.Dispose(); base.Dispose(disposing); }
}
