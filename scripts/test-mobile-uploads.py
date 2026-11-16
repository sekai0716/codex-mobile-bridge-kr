#!/usr/bin/env python3
"""실제 업로드 검증과 Activity 메서드를 합성 URI로 검사한다. 기기·사용자 파일은 사용하지 않는다."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'mobile/android/src/io/github/try2love/codexbridge'


def method(source, signature):
    """제품 메서드를 그대로 추출하고 Android API와 실행 큐만 JVM에서 대체한다."""
    start = source.index(signature)
    opening = source.index('{', start)
    depth = 0
    for token in re.finditer(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*.*?\*/|[{}]', source[opening:], re.S):
        if token[0] == '{':
            depth += 1
        elif token[0] == '}':
            depth -= 1
            if depth == 0:
                return source[start:opening + token.end()]
    raise ValueError('Unclosed Java method: ' + signature)


stubs = {
    'android/net/Uri.java': r'''package android.net;
public final class Uri {
 private final String value;private final java.net.URI parsed;
 private Uri(String value){this.value=value;this.parsed=java.net.URI.create(value);}
 public static Uri parse(String value){return new Uri(value);}
 public String getScheme(){return parsed.getScheme();}public String getAuthority(){return parsed.getRawAuthority();}
 public String toString(){return value;}public int hashCode(){return value.hashCode();}
 public boolean equals(Object other){return other instanceof Uri&&value.equals(((Uri)other).value);}
}''',
    'android/os/Process.java': 'package android.os;public final class Process {public static int myUid(){return 1000;}}',
    'android/content/pm/ApplicationInfo.java': 'package android.content.pm;public class ApplicationInfo {public int uid;}',
    'android/content/pm/ProviderInfo.java': 'package android.content.pm;public class ProviderInfo {public ApplicationInfo applicationInfo;}',
    'android/content/pm/PackageManager.java': r'''package android.content.pm;
public class PackageManager {
 public final java.util.Map<String,ProviderInfo> providers=new java.util.HashMap<>();
 public ProviderInfo resolveContentProvider(String authority,int flags){return providers.get(authority);}
 public void add(String authority,int uid){ProviderInfo p=new ProviderInfo();p.applicationInfo=new ApplicationInfo();p.applicationInfo.uid=uid;providers.put(authority,p);}
}''',
    'android/content/res/AssetFileDescriptor.java': r'''package android.content.res;
public class AssetFileDescriptor implements AutoCloseable {
 private final Runnable close;public AssetFileDescriptor(Runnable close){this.close=close;}
 public void close(){close.run();}
}''',
    'android/content/ContentResolver.java': r'''package android.content;
import android.net.Uri;import android.content.res.AssetFileDescriptor;
public class ContentResolver {
 public int opened,closed;public Runnable beforeOpen;public final java.util.Map<String,String> failures=new java.util.HashMap<>();
 public AssetFileDescriptor openAssetFileDescriptor(Uri uri,String mode)throws java.io.IOException{
  if(!"r".equals(mode))throw new AssertionError("Only read access is allowed");
  String failure=failures.get(uri.toString());if("denied".equals(failure))throw new SecurityException("synthetic denied URI");
  if("null".equals(failure))return null;if("io".equals(failure))throw new java.io.IOException("synthetic unavailable URI");
  Runnable hook=beforeOpen;beforeOpen=null;if(hook!=null)hook.run();
  opened++;return new AssetFileDescriptor(()->closed++);
 }
}''',
    'android/content/Context.java': r'''package android.content;
public class Context {
 private final android.content.pm.PackageManager packages=new android.content.pm.PackageManager();
 private final ContentResolver resolver=new ContentResolver();
 public android.content.pm.PackageManager getPackageManager(){return packages;}public ContentResolver getContentResolver(){return resolver;}
}''',
    'android/content/ActivityNotFoundException.java': 'package android.content;public class ActivityNotFoundException extends RuntimeException {}',
    'android/content/ClipData.java': r'''package android.content;
import android.net.Uri;
public class ClipData {
 private final Uri[] values;public ClipData(Uri[] values){this.values=values;}
 public int getItemCount(){return values.length;}public Item getItemAt(int index){return new Item(values[index]);}
 public static class Item {private final Uri uri;Item(Uri uri){this.uri=uri;}public Uri getUri(){return uri;}}
}''',
    'android/content/Intent.java': r'''package android.content;
import android.net.Uri;
public class Intent {
 public static final String ACTION_OPEN_DOCUMENT="android.intent.action.OPEN_DOCUMENT",CATEGORY_OPENABLE="android.intent.category.OPENABLE",EXTRA_ALLOW_MULTIPLE="multiple",EXTRA_MIME_TYPES="mime";
 public static final int FLAG_GRANT_READ_URI_PERMISSION=1;
 public String action,type;public int flags;public Uri[] parsed;public ClipData clips;public Uri data;
 public final java.util.Set<String> categories=new java.util.HashSet<>();public final java.util.Map<String,Object> extras=new java.util.HashMap<>();
 public Intent(){}public Intent(String action){this.action=action;}public Intent addCategory(String category){categories.add(category);return this;}
 public Intent setType(String type){this.type=type;return this;}public Intent addFlags(int flags){this.flags|=flags;return this;}
 public Intent putExtra(String name,boolean value){extras.put(name,value);return this;}public Intent putExtra(String name,String[] value){extras.put(name,value);return this;}
 public ClipData getClipData(){return clips;}public Uri getData(){return data;}
}''',
    'android/app/Activity.java': r'''package android.app;
import android.content.Intent;
public class Activity extends android.content.Context {
 public static final int RESULT_OK=-1;public boolean focus=true,destroyed,launchUnavailable;public Intent launched;public int launchCode,launches;
 private final java.util.ArrayDeque<Runnable> ui=new java.util.ArrayDeque<>();
 public boolean hasWindowFocus(){return focus;}
 public void startActivityForResult(Intent intent,int code){if(launchUnavailable)throw new android.content.ActivityNotFoundException();launched=intent;launchCode=code;launches++;}
 public void runOnUiThread(Runnable task){ui.add(task);}public void drainUi(){while(!ui.isEmpty())ui.remove().run();}
 protected void onActivityResult(int request,int result,Intent data){}protected void onDestroy(){destroyed=true;}
}''',
    'android/graphics/Bitmap.java': 'package android.graphics;public class Bitmap {}',
    'android/view/ViewGroup.java': 'package android.view;public class ViewGroup {public void removeView(android.webkit.WebView view){}}',
    'android/webkit/WebView.java': r'''package android.webkit;
public class WebView {public String url;public boolean destroyed;private final android.view.ViewGroup parent=new android.view.ViewGroup();
 public WebView(String url){this.url=url;}public String getUrl(){return url;}public Object getParent(){return parent;}public void destroy(){destroyed=true;}}
''',
    'android/webkit/ValueCallback.java': 'package android.webkit;public interface ValueCallback<T> {void onReceiveValue(T value);}',
    'android/webkit/WebViewClient.java': 'package android.webkit;public class WebViewClient {public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){}}',
    'android/webkit/WebChromeClient.java': r'''package android.webkit;
public class WebChromeClient {
 public boolean onShowFileChooser(WebView view,ValueCallback<android.net.Uri[]> callback,FileChooserParams params){return false;}
 public static class FileChooserParams {
  public static final int MODE_OPEN_MULTIPLE=1;private final int mode;public FileChooserParams(int mode){this.mode=mode;}
  public int getMode(){return mode;}public String[] getAcceptTypes(){return new String[]{"*/*"};}
  // Android 파서가 반환한 URI 배열을 테스트 입력으로 주입하는 API 경계다.
  public static android.net.Uri[] parseResult(int result,android.content.Intent data){return result==android.app.Activity.RESULT_OK&&data!=null?data.parsed:null;}
 }
}''',
    'io/github/try2love/codexbridge/FixtureExecutor.java': r'''package io.github.try2love.codexbridge;
final class FixtureExecutor extends java.util.concurrent.AbstractExecutorService {
 private boolean stopped;private final java.util.ArrayDeque<Runnable> tasks=new java.util.ArrayDeque<>();
 public void execute(Runnable task){if(stopped)throw new java.util.concurrent.RejectedExecutionException();tasks.add(task);}
 public void drain(){while(!tasks.isEmpty())tasks.remove().run();}public int queued(){return tasks.size();}
 public void shutdown(){stopped=true;}public boolean isShutdown(){return stopped;}public boolean isTerminated(){return stopped&&tasks.isEmpty();}
 public boolean awaitTermination(long timeout,java.util.concurrent.TimeUnit unit){return isTerminated();}
 public java.util.List<Runnable> shutdownNow(){stopped=true;java.util.List<Runnable> rest=new java.util.ArrayList<>(tasks);tasks.clear();return rest;}
}''',
}

dsh = (SOURCE / 'DshMobileActivity.java').read_text(encoding='utf-8')
main = (SOURCE / 'MainActivity.java').read_text(encoding='utf-8')
imports = 'package io.github.try2love.codexbridge;import android.app.Activity;import android.content.*;import android.net.Uri;import android.webkit.*;import java.util.*;'
stubs['io/github/try2love/codexbridge/DshMobileActivity.java'] = imports + '''
final class DshMobileActivity extends Activity {
 private WebView web;private String entry;private ValueCallback<Uri[]> files;private String filePage;
 final FixtureExecutor uploadWorker=new FixtureExecutor();private int uploadGeneration,fileGeneration;
 DshMobileActivity(String url){entry=url;web=new WebView(url);}
 WebView view(){return web;}void replaceView(WebView next){web=next;}
 final WebViewClient navigation=new WebViewClient(){
''' + method(dsh, '@Override public void onPageStarted(') + '''
 };
 final WebChromeClient chooser=new WebChromeClient(){
''' + method(dsh, '@Override public boolean onShowFileChooser(') + '''
 };
''' + '\n'.join(method(dsh, signature) for signature in (
    ' private void cancelFiles(', ' private void selectedFiles(',
    ' @Override protected void onActivityResult(', ' @Override protected void onDestroy(')) + '\n}'
stubs['io/github/try2love/codexbridge/MainActivity.java'] = imports + '''
final class MainActivity extends Activity {
 WebView web=new WebView("https://gateway.fixture/");private ValueCallback<Uri[]> files;private WebView fileView;private int fileGeneration;int generation;
 final FixtureExecutor worker=new FixtureExecutor();final java.util.List<String> messages=new java.util.ArrayList<>();
 void message(String text){messages.add(text);}String L(String text){return text;}
 final WebChromeClient chooser=new WebChromeClient(){
''' + method(main, '   public boolean onShowFileChooser(') + '\n};\n' + method(main, ' void selectedFiles(') + '\n}'

java_home = os.environ.get('JAVA_HOME')


def java_tool(name):
    tool = str(Path(java_home) / 'bin' / name) if java_home else shutil.which(name)
    if not tool:
        raise SystemExit('JDK required: set JAVA_HOME')
    return tool


with tempfile.TemporaryDirectory(prefix='cmb-mobile-upload-') as folder:
    work = Path(folder)
    for name, source in stubs.items():
        path = work / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding='utf-8')
    subprocess.run([java_tool('javac'), '--release', '8', '-encoding', 'UTF-8', '-d', str(work),
                    *[str(work / name) for name in stubs],
                    *[str(SOURCE / (name + '.java')) for name in ('UploadFiles', 'GatewayURL', 'DshMobileURL')],
                    str(ROOT / 'mobile/tests/UploadFileTests.java')], check=True)
    subprocess.run([java_tool('java'), '-cp', str(work), 'io.github.try2love.codexbridge.UploadFileTests'], check=True)
