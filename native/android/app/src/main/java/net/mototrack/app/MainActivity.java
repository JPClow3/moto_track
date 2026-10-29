package net.mototrack.app;

import android.Manifest;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.util.Locale;

public final class MainActivity extends ComponentActivity {
  private WebView web;
  private LinearLayout errorPanel;
  private ValueCallback<Uri[]> fileResult;
  private GeolocationPermissions.Callback locationResult;
  private String locationOrigin;
  private static final int FILE_REQUEST = 401;
  private static final int LOCATION_REQUEST = 402;
  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
  private boolean english() { return Locale.getDefault().getLanguage().equals("en"); }
  private String text(String pt, String en) { return english() ? en : pt; }

  @android.annotation.SuppressLint("SetJavaScriptEnabled")
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(Color.rgb(250,250,250));
    // Keep native controls clear of display cutouts and system gesture areas.
    root.setOnApplyWindowInsetsListener((view, insets) -> {
      if (Build.VERSION.SDK_INT >= 30) {
        android.graphics.Insets safe = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
        view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
      }
      return insets;
    });
    LinearLayout toolbar = new LinearLayout(this);
    toolbar.setBackgroundColor(Color.rgb(24,24,27));
    root.addView(toolbar, new LinearLayout.LayoutParams(-1,dp(56)));
    addButton(toolbar, text("Voltar","Back"), view -> back());
    addButton(toolbar, text("Atualizar","Reload"), view -> retry());
    addButton(toolbar, text("Compartilhar","Share"), view -> {
      Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain");
      // Share a public canonical link only, never account URLs or bearer tokens.
      share.putExtra(Intent.EXTRA_TEXT,"Moto Track — https://moto-track.net");
      startActivity(Intent.createChooser(share,text("Compartilhar Moto Track","Share Moto Track")));
    });

    errorPanel = new LinearLayout(this);
    errorPanel.setOrientation(LinearLayout.VERTICAL);
    errorPanel.setPadding(dp(24),dp(32),dp(24),dp(24));
    TextView error = new TextView(this);
    error.setText(text("Não foi possível conectar. Seus registros na nuvem não foram apagados. Confira a conexão e tente novamente.","Couldn't connect. Your cloud records have not been deleted. Check your connection and retry."));
    error.setTextSize(18);
    errorPanel.addView(error);
    Button retry = new Button(this);
    retry.setText(text("Tentar novamente","Retry"));
    retry.setOnClickListener(view -> retry());
    errorPanel.addView(retry);
    errorPanel.setVisibility(View.GONE);
    root.addView(errorPanel,new LinearLayout.LayoutParams(-1,-2));

    web = new WebView(this);
    root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
    setContentView(root);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    // File chooser access is limited to explicitly granted, external content URIs.
    // There are no broad storage permissions, app content providers or JS bridges.
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setGeolocationEnabled(true);
    settings.setUserAgentString(settings.getUserAgentString()+" MotoTrackNative/Android");
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri=request.getUrl();
        if (owned(uri)) {
          if (restricted(uri.getPath())) web.loadUrl(BuildConfig.APP_ORIGIN+"/app-info");
          else return false;
        } else if (request.hasGesture() && ("https".equals(uri.getScheme()) || "mailto".equals(uri.getScheme()))) {
          try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch (android.content.ActivityNotFoundException ignored) { }
        }
        return true;
      }
      @Override public void onPageFinished(WebView view,String url) { CookieManager.getInstance().flush(); }
      @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) showError();
      }
      @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,android.net.http.SslError error) {
        handler.cancel(); showError();
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
        if (fileResult != null) fileResult.onReceiveValue(null);
        fileResult=callback;
        Intent choose=params.createIntent();
        try { startActivityForResult(choose,FILE_REQUEST); }
        catch (android.content.ActivityNotFoundException exception) { fileResult.onReceiveValue(null); fileResult=null; }
        return true;
      }
      @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        if (!owned(Uri.parse(origin))) { callback.invoke(origin,false,false); return; }
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED) { callback.invoke(origin,true,false); return; }
        if (locationResult!=null) locationResult.invoke(locationOrigin,false,false);
        locationResult=callback; locationOrigin=origin;
        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},LOCATION_REQUEST);
      }
      @Override public void onGeolocationPermissionsHidePrompt() {
        if (locationResult!=null) locationResult.invoke(locationOrigin,false,false);
        locationResult=null; locationOrigin=null;
      }
    });
    web.setDownloadListener((url,agent,disposition,mime,length) -> {
      Uri uri=Uri.parse(url);
      if (!owned(uri)) return;
      String name=URLUtil.guessFileName(url,disposition,mime).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]","_");
      name=name.replaceAll("^\\.+|\\.+$","");
      if(name.trim().isEmpty()) name="moto-track-download";
      if (name.length()>120) name=name.substring(name.length()-120);
      DownloadManager.Request download=new DownloadManager.Request(uri);
      String cookie=CookieManager.getInstance().getCookie(url);
      if (cookie!=null) download.addRequestHeader("Cookie",cookie);
      download.addRequestHeader("User-Agent",settings.getUserAgentString());
      if (mime!=null) download.setMimeType(mime);
      download.setTitle(name);
      download.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      download.setDestinationInExternalFilesDir(this,Environment.DIRECTORY_DOWNLOADS,name);
      try { ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(download); }
      catch (RuntimeException exception) { Toast.makeText(this,text("Não foi possível iniciar o download.","Couldn't start the download."),Toast.LENGTH_LONG).show(); }
    });
    if (state==null || web.restoreState(state)==null) web.loadUrl(BuildConfig.APP_ORIGIN+"/dashboard");
    getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true) {
      @Override public void handleOnBackPressed() { back(); }
    });
  }
  private boolean owned(Uri uri) {
    Uri origin=Uri.parse(BuildConfig.APP_ORIGIN);
    return "https".equals(uri.getScheme()) && origin.getHost().equals(uri.getHost()) && (uri.getPort()==-1 || uri.getPort()==443);
  }
  private boolean restricted(String path) {
    if(path==null) return false;
    return path.matches("/(precos|billing|billing/checkout|billing/portal)/?");
  }
  private void addButton(LinearLayout bar,String title,View.OnClickListener action) {
    Button button=new Button(this);
    button.setText(title); button.setTextSize(12); button.setContentDescription(title);
    button.setTextColor(Color.WHITE); button.setBackgroundColor(Color.TRANSPARENT);
    button.setOnClickListener(action);
    bar.addView(button,new LinearLayout.LayoutParams(0,-1,1));
  }
  private void back() { if(web.canGoBack()) { errorPanel.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.goBack(); } else finish(); }
  private void showError() { errorPanel.setVisibility(View.VISIBLE); web.setVisibility(View.GONE); }
  private void retry() { errorPanel.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); if(web.getUrl()!=null && owned(Uri.parse(web.getUrl()))) web.reload(); else web.loadUrl(BuildConfig.APP_ORIGIN+"/dashboard"); }
  @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
  @Override protected void onActivityResult(int request,int result,Intent data) {
    super.onActivityResult(request,result,data);
    if(request==FILE_REQUEST && fileResult!=null) {
      Uri[] selected=WebChromeClient.FileChooserParams.parseResult(result,data);
      if(selected!=null) {
        for(Uri uri:selected) {
          if(!safeChosenFile(uri)) { selected=null; break; }
        }
      }
      fileResult.onReceiveValue(selected); fileResult=null;
    }
  }
  private boolean safeChosenFile(Uri uri) {
    if(uri==null || !"content".equals(uri.getScheme()) || uri.getAuthority()==null || uri.getAuthority().isEmpty()) return false;
    android.content.pm.ProviderInfo provider=getPackageManager().resolveContentProvider(uri.getAuthority(),0);
    if(provider==null || getPackageName().equals(provider.packageName)) return false;
    // The system picker must have granted this app read access to the selection.
    return checkUriPermission(uri,android.os.Process.myPid(),android.os.Process.myUid(),Intent.FLAG_GRANT_READ_URI_PERMISSION)==PackageManager.PERMISSION_GRANTED;
  }
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants) {
    super.onRequestPermissionsResult(request,permissions,grants);
    if(request==LOCATION_REQUEST && locationResult!=null) {
      boolean allowed=false; for(int grant:grants) if(grant==PackageManager.PERMISSION_GRANTED) allowed=true;
      locationResult.invoke(locationOrigin,allowed,false); locationResult=null; locationOrigin=null;
    }
  }
  @Override protected void onDestroy() {
    if(fileResult!=null) fileResult.onReceiveValue(null);
    if(locationResult!=null) locationResult.invoke(locationOrigin,false,false);
    web.stopLoading(); web.destroy(); super.onDestroy();
  }
}
