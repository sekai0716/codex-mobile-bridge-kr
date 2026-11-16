package io.github.try2love.codexbridge;

import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.webkit.*;
import java.util.*;

/** 실제 검증 코드와 Activity 메서드를 합성 provider·실행 큐로 검사한다. */
public final class UploadFileTests {
 private static int checks;
 private static final String BASE="http://192.168.1.2:8080/chat";
 private static final Uri ONE=Uri.parse("content://documents.fixture/one"),TWO=Uri.parse("content://documents.fixture/two");
 private static void check(boolean value,String label){checks++;if(!value)throw new AssertionError(label);}
 private static final class Capture implements ValueCallback<Uri[]> {
  final List<Uri[]> values=new ArrayList<>();public void onReceiveValue(Uri[] value){values.add(value);}
  void empty(){check(values.size()==1&&values.get(0)==null,"exactly one rejected/cancelled callback");}
  void accepted(Uri... expected){check(values.size()==1&&Arrays.equals(values.get(0),expected),"original selected URI order preserved");}
 }
 private static Intent picked(Uri... values){Intent data=new Intent();data.parsed=values;data.clips=new ClipData(values);if(values.length>0)data.data=values[0];return data;}
 private static void providers(Context context){context.getPackageManager().add("documents.fixture",2000);context.getPackageManager().add("own.fixture",android.os.Process.myUid());}
 private static DshMobileActivity activity(){DshMobileActivity activity=new DshMobileActivity(BASE);providers(activity);return activity;}
 private static Capture choose(DshMobileActivity activity,int mode){Capture callback=new Capture();check(activity.chooser.onShowFileChooser(activity.view(),callback,new WebChromeClient.FileChooserParams(mode)),"chooser accepted user action");return callback;}
 private static void finish(DshMobileActivity activity){activity.uploadWorker.drain();activity.drainUi();}
 private static void result(DshMobileActivity activity,Intent data){activity.onActivityResult(1,Activity.RESULT_OK,data);}

 private static void helperContract(){
  Context context=new Context();providers(context);
  check(UploadFiles.readable(context,Arrays.asList(ONE)),"external content URI readable");
  check(UploadFiles.readable(context,Arrays.asList(ONE,TWO)),"multiple external content URIs readable");
  check(context.getContentResolver().opened==3&&context.getContentResolver().closed==3,"all descriptors closed");
  check(!UploadFiles.readable(context,null),"null selection rejected");check(!UploadFiles.readable(context,Collections.emptyList()),"empty selection rejected");
  for(Uri uri:new Uri[]{null,Uri.parse("file:///fixture/private-not-a-real-file"),Uri.parse("data:text/plain,fixture"),Uri.parse("content://own.fixture/private"),Uri.parse("content://missing.fixture/file"),Uri.parse("content:/no-authority")})
   check(!UploadFiles.readable(context,Arrays.asList(uri)),"untrusted URI rejected: "+uri);
  context.getPackageManager().providers.put("null-app.fixture",new android.content.pm.ProviderInfo());
  check(!UploadFiles.readable(context,Arrays.asList(Uri.parse("content://null-app.fixture/file"))),"provider without application identity rejected");
  check(context.getContentResolver().opened==3,"unsafe schemes and private providers never open a descriptor");
  for(String failure:new String[]{"denied","null","io"}){
   context.getContentResolver().failures.put(TWO.toString(),failure);
   check(!UploadFiles.readable(context,Arrays.asList(ONE,TWO)),"any unreadable item rejects the entire selection: "+failure);
  }
  check(context.getContentResolver().opened==context.getContentResolver().closed,"successful descriptors closed before later rejection");
 }

 private static void normalAttachments(){
  DshMobileActivity single=activity();Capture one=choose(single,0);
  check(Intent.ACTION_OPEN_DOCUMENT.equals(single.launched.action)&&single.launched.categories.contains(Intent.CATEGORY_OPENABLE),"system document chooser retained");
  check(Boolean.FALSE.equals(single.launched.extras.get(Intent.EXTRA_ALLOW_MULTIPLE)),"single chooser retained");
  result(single,picked(ONE));check(one.values.isEmpty(),"provider validation is deferred");single.uploadWorker.drain();check(one.values.isEmpty(),"delivery returns to UI queue");single.drainUi();one.accepted(ONE);
  check(single.getContentResolver().opened==1&&single.getContentResolver().closed==1,"DSH uses shared descriptor check");
  DshMobileActivity multiple=activity();Capture many=choose(multiple,WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
  check(Boolean.TRUE.equals(multiple.launched.extras.get(Intent.EXTRA_ALLOW_MULTIPLE)),"multiple chooser retained");result(multiple,picked(TWO,ONE));finish(multiple);many.accepted(TWO,ONE);
 }

 private static void rejectedAttachments(){
  for(Uri uri:new Uri[]{null,Uri.parse("file:///fixture/private-not-a-real-file"),Uri.parse("data:text/plain,fixture"),Uri.parse("content://own.fixture/private"),Uri.parse("content://missing.fixture/file")}){
   DshMobileActivity activity=activity();Capture callback=choose(activity,0);result(activity,picked(uri));finish(activity);callback.empty();
  }
  for(String failure:new String[]{"denied","null","io"}){
   DshMobileActivity activity=activity();activity.getContentResolver().failures.put(TWO.toString(),failure);Capture callback=choose(activity,1);result(activity,picked(ONE,TWO));finish(activity);callback.empty();
  }
  DshMobileActivity empty=activity();Capture none=choose(empty,0);result(empty,picked());finish(empty);none.empty();
  DshMobileActivity noIntent=activity();Capture absent=choose(noIntent,0);result(noIntent,null);finish(noIntent);absent.empty();
  DshMobileActivity cancelled=activity();Capture callback=choose(cancelled,0);cancelled.onActivityResult(1,0,picked(ONE));finish(cancelled);callback.empty();
 }

 private static void chooserBoundaries(){
  DshMobileActivity activity=activity();Capture callback=new Capture();
  check(!activity.chooser.onShowFileChooser(new WebView(BASE),callback,new WebChromeClient.FileChooserParams(0)),"foreign WebView rejected");
  activity.focus=false;check(!activity.chooser.onShowFileChooser(activity.view(),callback,new WebChromeClient.FileChooserParams(0)),"missing user focus rejected");
  activity.focus=true;activity.view().url="https://outside.fixture/";check(!activity.chooser.onShowFileChooser(activity.view(),callback,new WebChromeClient.FileChooserParams(0)),"foreign origin rejected");
  check(activity.launches==0&&callback.values.isEmpty(),"rejected chooser never launches picker or owns callback");
  DshMobileActivity unavailable=activity();unavailable.launchUnavailable=true;Capture failed=choose(unavailable,0);failed.empty();unavailable.launchUnavailable=false;
  Capture next=choose(unavailable,0);result(unavailable,picked(ONE));finish(unavailable);next.accepted(ONE);
  DshMobileActivity wrongRequest=activity();Capture pending=choose(wrongRequest,0);wrongRequest.onActivityResult(99,Activity.RESULT_OK,picked(ONE));finish(wrongRequest);check(pending.values.isEmpty(),"unrelated activity result ignored");result(wrongRequest,picked(ONE));finish(wrongRequest);pending.accepted(ONE);
 }

 private static void navigationAndLifetime(){
  DshMobileActivity beforeResult=activity();Capture first=choose(beforeResult,0);beforeResult.navigation.onPageStarted(beforeResult.view(),BASE+"/next",null);first.empty();result(beforeResult,picked(ONE));finish(beforeResult);first.empty();
  DshMobileActivity whileReading=activity();Capture second=choose(whileReading,0);result(whileReading,picked(ONE));whileReading.navigation.onPageStarted(whileReading.view(),BASE+"/next",null);whileReading.navigation.onPageStarted(whileReading.view(),BASE,null);finish(whileReading);second.empty();
  DshMobileActivity beforeUi=activity();Capture third=choose(beforeUi,0);result(beforeUi,picked(ONE));beforeUi.uploadWorker.drain();beforeUi.navigation.onPageStarted(beforeUi.view(),BASE+"/next",null);beforeUi.drainUi();third.empty();
  DshMobileActivity changedPath=activity();Capture fourth=choose(changedPath,0);result(changedPath,picked(ONE));changedPath.uploadWorker.drain();changedPath.view().url=BASE+"/other";changedPath.drainUi();fourth.empty();
  DshMobileActivity changedOrigin=activity();Capture fifth=choose(changedOrigin,0);changedOrigin.view().url="https://outside.fixture/";result(changedOrigin,picked(ONE));finish(changedOrigin);fifth.empty();
  DshMobileActivity replaced=activity();Capture sixth=choose(replaced,0);result(replaced,picked(ONE));replaced.uploadWorker.drain();replaced.replaceView(new WebView(BASE));replaced.drainUi();sixth.empty();
  DshMobileActivity pendingDestroy=activity();Capture seventh=choose(pendingDestroy,0);pendingDestroy.onDestroy();seventh.empty();result(pendingDestroy,picked(ONE));finish(pendingDestroy);seventh.empty();check(pendingDestroy.uploadWorker.isShutdown(),"destroyed activity shuts down its worker");
  DshMobileActivity readingDestroy=activity();Capture eighth=choose(readingDestroy,0);result(readingDestroy,picked(ONE));readingDestroy.onDestroy();finish(readingDestroy);eighth.empty();
  DshMobileActivity duringRead=activity();Capture midRead=choose(duringRead,0);duringRead.getContentResolver().beforeOpen=duringRead::onDestroy;result(duringRead,picked(ONE));finish(duringRead);midRead.empty();check(duringRead.getContentResolver().opened==1&&duringRead.getContentResolver().closed==1,"descriptor closes after destruction during validation");
  DshMobileActivity queuedDestroy=activity();Capture ninth=choose(queuedDestroy,0);result(queuedDestroy,picked(ONE));queuedDestroy.uploadWorker.drain();queuedDestroy.onDestroy();queuedDestroy.drainUi();ninth.empty();
  DshMobileActivity newer=activity();Capture old=choose(newer,0);result(newer,picked(ONE));newer.uploadWorker.drain();Capture current=choose(newer,0);old.empty();newer.drainUi();check(current.values.isEmpty(),"late old completion cannot cancel newer chooser");result(newer,picked(TWO));finish(newer);current.accepted(TWO);old.empty();
  DshMobileActivity reused=activity();Capture sameCallback=choose(reused,0);result(reused,picked(ONE));reused.uploadWorker.drain();check(reused.chooser.onShowFileChooser(reused.view(),sameCallback,new WebChromeClient.FileChooserParams(0)),"new chooser may reuse a callback object");sameCallback.empty();reused.drainUi();sameCallback.empty();result(reused,picked(TWO));finish(reused);check(sameCallback.values.size()==2&&Arrays.equals(sameCallback.values.get(1),new Uri[]{TWO}),"generation separates requests even with the same callback object");
 }

 private static void mainActivityCompatibility(){
  MainActivity main=new MainActivity();providers(main);Capture normal=new Capture();check(main.chooser.onShowFileChooser(main.web,normal,new WebChromeClient.FileChooserParams(1)),"MainActivity chooser retained");main.selectedFiles(Activity.RESULT_OK,picked(TWO,ONE,TWO));main.worker.drain();main.drainUi();normal.accepted(TWO,ONE);
  Capture privateFile=new Capture();main.chooser.onShowFileChooser(main.web,privateFile,new WebChromeClient.FileChooserParams(0));main.selectedFiles(Activity.RESULT_OK,picked(Uri.parse("content://own.fixture/private")));main.worker.drain();main.drainUi();privateFile.empty();
  Capture stale=new Capture();main.chooser.onShowFileChooser(main.web,stale,new WebChromeClient.FileChooserParams(0));main.selectedFiles(Activity.RESULT_OK,picked(ONE));main.generation++;main.worker.drain();main.drainUi();stale.empty();
  Capture wrongView=new Capture();main.chooser.onShowFileChooser(new WebView("https://gateway.fixture/"),wrongView,new WebChromeClient.FileChooserParams(0));main.selectedFiles(Activity.RESULT_OK,picked(ONE));wrongView.empty();
 }

 public static void main(String[] args){
  helperContract();normalAttachments();rejectedAttachments();chooserBoundaries();navigationAndLifetime();mainActivityCompatibility();
  System.out.println("Upload validation passed: "+checks+" assertions; real UploadFiles and Activity methods, synthetic providers only");
 }
}
