package net.paperclips.reset;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class MainActivity extends Activity {
 private static final String HOME="https://appassets.androidplatform.net/assets/index.html";
 private static final int IMPORT=1, EXPORT=2;
 private WebView web;
 private ValueCallback<Uri[]> fileChoice;
 private String pendingExport;
 private boolean foreground;
 private HardwareScreen hardwareScreen;

 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setStatusBarColor(Color.BLACK);getWindow().setNavigationBarColor(Color.BLACK);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);
  web=new WebView(this);web.setBackgroundColor(Color.BLACK);
  if(Build.VERSION.SDK_INT>=33)try{hardwareScreen=new HardwareScreen(web,getAssets());}catch(IOException|IllegalArgumentException error){android.util.Log.w("PaperclipsRemastered","Hardware screen unavailable",error);}
  root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
  if(Build.VERSION.SDK_INT>=30){
   getWindow().setDecorFitsSystemWindows(false);
   root.setOnApplyWindowInsetsListener((view,insets)->{
    android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
    view.setPadding(safe.left,safe.top,safe.right,safe.bottom);return insets;
   });
  }
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setSupportZoom(false);settings.setMediaPlaybackRequiresUserGesture(true);
  web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND,true);
  web.addJavascriptInterface(new GameFiles(),"AndroidGame");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl();
    if(HOME.equals(uri.toString()))try{return new WebResourceResponse("text/html","UTF-8",getAssets().open("index.html"));}catch(IOException error){return blocked();}
    return blocked();
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !HOME.equals(request.getUrl().toString());}
   @Override public void onPageFinished(WebView view,String url){hideSystemBars();}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(fileChoice!=null)fileChoice.onReceiveValue(null);fileChoice=callback;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");
    intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});
    startActivityForResult(intent,IMPORT);return true;
   }
  });
  web.loadUrl(HOME);
 }
 private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,new ByteArrayInputStream(new byte[0]));}
 private void hideSystemBars(){
  if(Build.VERSION.SDK_INT>=30){WindowInsetsController controller=getWindow().getInsetsController();if(controller!=null){controller.hide(WindowInsets.Type.systemBars());controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);}}
  else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
 }
 public final class GameFiles {
  @JavascriptInterface public boolean hardwareScreenAvailable(){return hardwareScreen!=null;}
  @JavascriptInterface public void configureScreen(boolean enabled,float width,float bloom,boolean curve,float rgb,boolean ending){
   runOnUiThread(()->{if(hardwareScreen!=null)hardwareScreen.configure(enabled,width,bloom,curve,rgb,ending);});
  }
  @JavascriptInterface public void exportSave(String text){
   runOnUiThread(()->{
    if(pendingExport!=null)return;pendingExport=text;
    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");
    intent.putExtra(Intent.EXTRA_TITLE,getString(R.string.save_file_prefix)+"-"+new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(new Date())+".json");startActivityForResult(intent,EXPORT);
   });
  }
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==IMPORT&&fileChoice!=null){fileChoice.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileChoice=null;}
  if(request==EXPORT){
   String text=pendingExport;pendingExport=null;
   if(result==RESULT_OK&&data!=null&&text!=null){
    try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(text.getBytes(StandardCharsets.UTF_8));Toast.makeText(this,R.string.save_exported,Toast.LENGTH_SHORT).show();}
    catch(IOException error){Toast.makeText(this,R.string.save_export_failed,Toast.LENGTH_LONG).show();}
   }
  }
 }
 @Override protected void onPause(){
  foreground=false;
  web.evaluateJavascript("window.MobilePaperclips?.save()",ignored->{if(!foreground){web.onPause();web.pauseTimers();}});
  super.onPause();
 }
 @Override protected void onResume(){
  super.onResume();foreground=true;
  if(web!=null){web.resumeTimers();web.onResume();web.evaluateJavascript("window.MobilePaperclips?.resume()",null);}hideSystemBars();
 }
 @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused)hideSystemBars();}
 @Override public void onBackPressed(){
  web.evaluateJavascript("window.MobilePaperclips?.back() || false",handled->{
   if(!"true".equals(handled))new AlertDialog.Builder(this).setMessage(R.string.exit_prompt).setNegativeButton(R.string.keep_playing,null).setPositiveButton(R.string.exit,(dialog,which)->web.evaluateJavascript("window.MobilePaperclips?.save()",ignored->finish())).show();
  });
 }
 @Override protected void onDestroy(){if(fileChoice!=null)fileChoice.onReceiveValue(null);web.removeJavascriptInterface("AndroidGame");web.destroy();super.onDestroy();}
}
