package io.github.try2love.codexbridge;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import org.json.JSONObject;
import java.util.List;
import java.util.UUID;

/** Device-local glue for UU's external-device protocol. No listeners or network requests. */
final class UURemote {
 private static final String PENDING="uu.pending", PACKAGE="com.netease.uuremote";
 private final Context context;
 private final SharedPreferences prefs;
 String scope="";
 UURemote(Context context,SharedPreferences prefs){this.context=context;this.prefs=prefs;}
 static String device(String cookie){
  try{return cookie!=null&&cookie.matches("codex_mobile_session_[0-9a-f]{24}")?ConnectionDiscovery.hash(cookie).substring(0,32):"";}
  catch(Exception unavailable){return "";}
 }
 boolean enabled(){return !scope.isEmpty()&&prefs.getBoolean("uu.enabled:"+scope,false);}
 private JSONObject pending(){
  try{JSONObject p=new JSONObject(prefs.getString(PENDING,""));if(System.currentTimeMillis()<p.getLong("until"))return p;}
  catch(Exception ignored){}
  return new JSONObject();
 }
 private void unlink(String device){
  SharedPreferences.Editor e=prefs.edit().remove("uu.binding:"+device);
  if(device.equals(pending().optString("scope")))e.remove(PENDING);
  e.apply();
 }
 void remove(String device){if(device.isEmpty())return;unlink(device);prefs.edit().remove("uu.enabled:"+device).apply();if(device.equals(scope))scope="";}
 String settings(String cmd){
  try{
   if(!scope.isEmpty()){
    if("enable".equals(cmd)||"disable".equals(cmd)){
     prefs.edit().putBoolean("uu.enabled:"+scope,"enable".equals(cmd)).apply();
     if("disable".equals(cmd)&&scope.equals(pending().optString("scope")))prefs.edit().remove(PENDING).apply();
    }else if("forget".equals(cmd))unlink(scope);
   }
   return new JSONObject().put("supported",!scope.isEmpty()).put("enabled",enabled())
    .put("bound",!prefs.getString("uu.binding:"+scope,"").isEmpty())
    .put("pip",context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)).toString();
  }catch(Exception e){return "{}";}
 }
 private String installedVersion(){
  try{return context.getPackageManager().getPackageInfo(PACKAGE,0).versionName;}
  catch(PackageManager.NameNotFoundException|SecurityException unavailable){return null;}
 }
 private static boolean knownTooOld(String version){
  if(version==null)return false;
  java.util.regex.Matcher numbers=java.util.regex.Pattern.compile("^(\\d+)\\.(\\d+)").matcher(version);
  if(!numbers.find())return false;
  try{
   int major=Integer.parseInt(numbers.group(1)),minor=Integer.parseInt(numbers.group(2));
   return major<4||major==4&&minor<42;
  }catch(NumberFormatException unknown){return false;}
 }
 private String scheme(){return context.getPackageName()+".uu";}
 private Uri.Builder base(String action){return new Uri.Builder().scheme("uuremote").authority("external").appendPath("device").appendPath(action);}
 String open(String mode){
  if(!enabled()||!("full".equals(mode)||"pip".equals(mode)))return "";
  if("pip".equals(mode)&&!context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE))return "작은 화면을 사용할 수 없습니다. 전체 화면 원격 제어를 사용하세요.";
  if(pending().has("nonce"))return "UU Remote 요청을 처리 중입니다.";
  String id=prefs.getString("uu.binding:"+scope,"");
  String kind=id.isEmpty()?"bind":mode,nonce=UUID.randomUUID().toString();
  Uri.Builder callback=new Uri.Builder().scheme(scheme()).authority("result");
  Uri.Builder request;
  if(kind.equals("bind"))request=base("authorize").appendQueryParameter("callback",callback.toString()).appendQueryParameter("nonce",nonce);
  else{
   request=base("control").appendQueryParameter("anonymous_device_id",id).appendQueryParameter("window_type",mode.equals("pip")?"1":"0");
   if(kind.equals("pip"))request.appendQueryParameter("callback",callback.appendQueryParameter("nonce",nonce).toString());
  }
  Intent intent=new Intent(Intent.ACTION_VIEW,request.build()).setPackage(PACKAGE);
  String version=installedVersion();
  if(knownTooOld(version))return "UU Remote 4.42.0 이상을 설치하거나 해당 버전으로 업데이트하세요.";
  try{
   if(!kind.equals("full"))prefs.edit().putString(PENDING,new JSONObject().put("scope",scope).put("kind",kind)
      .put("nonce",nonce).put("until",System.currentTimeMillis()+600000).toString()).apply();
   // Android can launch the package even when a resolver query would hide it.
   context.startActivity(intent);return "";
  }catch(ActivityNotFoundException missing){
   prefs.edit().remove(PENDING).apply();
   return version!=null?"Android가 설치된 UU 원격 앱에서 원격 제어 링크를 열 수 없습니다.":"UU 원격 링크 처리기를 찾을 수 없습니다. 이 Android 프로필에 UU 원격이 설치되어 있는지 확인하세요.";
  }catch(SecurityException denied){
   prefs.edit().remove(PENDING).apply();
   return "Android에서 실행을 차단했습니다. Codex Bridge가 UU Remote를 열 수 있도록 허용하세요.";
  }catch(Exception e){prefs.edit().remove(PENDING).apply();return "UU Remote를 열 수 없습니다.";}
 }
 private static String one(Uri uri,String name){List<String> values=uri.getQueryParameters(name);return values.size()==1?values.get(0):null;}
 /** null means an unrelated URL. An empty result consumes a stale or unsolicited callback. */
 String callback(Uri uri){
  if(uri==null||!scheme().equals(uri.getScheme())||!"result".equals(uri.getEncodedAuthority()))return null;
  JSONObject p=pending();String nonce=one(uri,"nonce"),device=p.optString("scope");
  if(!uri.getPath().isEmpty()||uri.getFragment()!=null||uri.toString().length()>8192||nonce==null||!nonce.equals(p.optString("nonce"))||!prefs.getBoolean("uu.enabled:"+device,false))return "";
  prefs.edit().remove(PENDING).apply();
  if(!scope.isEmpty()&&!scope.equals(device))return "";
  if("bind".equals(p.optString("kind"))){
   String id=one(uri,"anonymous_device_id");
   if(id!=null&&!id.isEmpty()&&id.length()<=4096&&!uri.getQueryParameterNames().contains("error")){
    prefs.edit().putString("uu.binding:"+device,id).apply();return "기기가 연결되었습니다. 작은 화면 또는 원격 제어를 다시 선택하세요.";
   }
   return "user_cancel".equals(one(uri,"error"))?"":"기기 연결이 완료되지 않았습니다. UU Remote에서 계정과 장치를 확인하세요.";
  }
  if("success".equals(one(uri,"status"))&&!uri.getQueryParameterNames().contains("reason"))return "UU Remote 작은 화면이 열렸습니다.";
  if(!"failure".equals(one(uri,"status")))return "작은 화면을 열 수 없습니다. 기기를 확인한 뒤 다시 시도하세요.";
  String reason=one(uri,"reason");
  if("device_not_found".equals(reason)){unlink(device);return "UU Remote 기기를 더 이상 사용할 수 없습니다. 다시 연결하세요.";}
  return "device_offline".equals(reason)?"UU Remote 기기가 오프라인 상태입니다.":"pip_unsupported".equals(reason)?"작은 화면을 사용할 수 없습니다. 전체 화면 원격 제어를 사용하세요.":"user_cancel".equals(reason)?"":"작은 화면을 열 수 없습니다. 기기를 확인한 뒤 다시 시도하세요.";
 }
}
