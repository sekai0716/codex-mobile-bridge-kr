package io.github.try2love.codexbridge;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;

/** Separate process and WebView store: third-party pages never receive Bridge native APIs. */
public final class DshMobileActivity extends Activity {
 private static boolean initialized;
 private WebView web;private String entry;private ValueCallback<Uri[]> files;private String filePage;
 private final java.util.concurrent.ExecutorService uploadWorker=java.util.concurrent.Executors.newSingleThreadExecutor();
 private int uploadGeneration,fileGeneration;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  if(Build.VERSION.SDK_INT<28){finish();return;}
  if(!initialized){WebView.setDataDirectorySuffix("dsh-mobile");initialized=true;}
  try{entry=DshMobileURL.connection(getIntent().getStringExtra("url"));}catch(Exception invalid){finish();return;}
  android.content.res.Configuration configuration=new android.content.res.Configuration(getResources().getConfiguration());String theme=getIntent().getStringExtra("theme");
  if("dark".equals(theme)||"light".equals(theme))configuration.uiMode=(configuration.uiMode&~android.content.res.Configuration.UI_MODE_NIGHT_MASK)|("dark".equals(theme)?android.content.res.Configuration.UI_MODE_NIGHT_YES:android.content.res.Configuration.UI_MODE_NIGHT_NO);
  ContextThemeWrapper themed=new ContextThemeWrapper(this,0);themed.applyOverrideConfiguration(configuration);themed.setTheme(getResources().getIdentifier("SettingsTheme","style",getPackageName()));
  SettingsUi ui=new SettingsUi(themed);LinearLayout root=ui.column();root.setBackgroundColor(ui.page);
  LinearLayout bar=new LinearLayout(ui.context);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(ui.dp(8),0,ui.dp(8),0);
  ImageButton close=toolbarButton(ui,"ic_menu_monitor","내 컴퓨터",this::finish);bar.addView(close,new LinearLayout.LayoutParams(ui.dp(48),ui.dp(48)));
  TextView title=ui.text("DSH Mobile",17,ui.text);title.setTypeface(null,android.graphics.Typeface.BOLD);title.setGravity(Gravity.CENTER);title.setSingleLine();title.setEllipsize(android.text.TextUtils.TruncateAt.END);bar.addView(title,new LinearLayout.LayoutParams(0,-2,1));
  ImageButton reload=toolbarButton(ui,"ic_menu_refresh_cw","새로 고치다",()->web.reload());bar.addView(reload,new LinearLayout.LayoutParams(ui.dp(48),ui.dp(48)));root.addView(bar,new LinearLayout.LayoutParams(-1,ui.dp(56)));
  web=new WebView(ui.context);web.setBackgroundColor(ui.page);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
  new SystemBars(this,root,()->{}).update(ui.page,ui.page);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    String target=request.getUrl().toString();if(DshMobileURL.sameOrigin(target,entry))return false;
    if(request.isForMainFrame()&&request.hasGesture()&&("https".equals(request.getUrl().getScheme())||"http".equals(request.getUrl().getScheme())))new AlertDialog.Builder(ui.context).setMessage(MobileStrings.text(DshMobileActivity.this,"브라우저에서 외부 링크를 열까요? \n")+request.getUrl().getHost()).setPositiveButton(MobileStrings.text(DshMobileActivity.this,"열기"),(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,request.getUrl()));}catch(ActivityNotFoundException ignored){}}).setNegativeButton(MobileStrings.text(DshMobileActivity.this,"취소"),null).show();return true;
   }
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){uploadGeneration++;cancelFiles();}
   @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())Toast.makeText(DshMobileActivity.this,MobileStrings.text(DshMobileActivity.this,"연결에 실패했습니다. 다시 시도하려면 새로고침하세요."),Toast.LENGTH_LONG).show();}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(view!=web||!DshMobileURL.sameOrigin(view.getUrl(),entry)||!hasWindowFocus())return false;
    cancelFiles();files=callback;filePage=view.getUrl();fileGeneration=++uploadGeneration;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
    try{startActivityForResult(intent,1);}catch(ActivityNotFoundException unavailable){cancelFiles();}return true;
   }
  });
  if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::back);
  web.loadUrl(entry);
 }
 private ImageButton toolbarButton(SettingsUi ui,String resource,String label,Runnable action){
  ImageButton button=new ImageButton(ui.context);button.setImageResource(getResources().getIdentifier(resource,"drawable",getPackageName()));button.setColorFilter(ui.text);button.setPadding(ui.dp(12),ui.dp(12),ui.dp(12),ui.dp(12));button.setContentDescription(MobileStrings.text(this,label));ui.clickable(button,action);return button;
 }
 private void back(){if(web!=null&&web.canGoBack())web.goBack();else finish();}
 @Override public void onBackPressed(){back();}
 private void cancelFiles(){ValueCallback<Uri[]> callback=files;files=null;filePage=null;if(callback!=null)callback.onReceiveValue(null);}
 /** 외부 provider의 읽기 가능 여부는 백그라운드에서 검사하고 선택한 페이지에만 결과를 전달한다. */
 private void selectedFiles(int result,Intent data){
  ValueCallback<Uri[]> callback=files;WebView current=web;String page=filePage;int ticket=fileGeneration;
  if(callback==null)return;
  Uri[] selected=result==RESULT_OK&&current!=null&&ticket==uploadGeneration&&page!=null&&page.equals(current.getUrl())&&DshMobileURL.sameOrigin(current.getUrl(),entry)?WebChromeClient.FileChooserParams.parseResult(result,data):null;
  if(selected==null){cancelFiles();return;}
  uploadWorker.execute(()->{
   boolean accepted=UploadFiles.readable(this,java.util.Arrays.asList(selected));
   runOnUiThread(()->{
    // 탐색·파괴·새 파일 선택으로 취소된 콜백에는 검사 결과를 다시 전달하지 않는다.
    if(files!=callback||fileGeneration!=ticket)return;
    files=null;filePage=null;
    callback.onReceiveValue(accepted&&current==web&&ticket==uploadGeneration&&page.equals(current.getUrl())&&DshMobileURL.sameOrigin(current.getUrl(),entry)?selected:null);
   });
  });
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==1)selectedFiles(result,data);}
 @Override protected void onDestroy(){uploadGeneration++;cancelFiles();uploadWorker.shutdownNow();if(web!=null){((android.view.ViewGroup)web.getParent()).removeView(web);web.destroy();web=null;}super.onDestroy();}
}
