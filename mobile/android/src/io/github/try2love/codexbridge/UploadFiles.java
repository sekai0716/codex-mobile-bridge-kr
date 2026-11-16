package io.github.try2love.codexbridge;

import android.content.Context;
import android.content.pm.ProviderInfo;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import java.util.Collection;

/** 파일 선택기의 결과도 외부 입력이다. 앱 내부 파일을 WebView에 전달하지 않는다. */
final class UploadFiles {
 static boolean readable(Context context,Collection<Uri> selected){
  if(selected==null||selected.isEmpty())return false;
  try{
   for(Uri uri:selected){
    if(uri==null||!"content".equals(uri.getScheme()))return false;
    ProviderInfo provider=context.getPackageManager().resolveContentProvider(uri.getAuthority(),0);
    if(provider==null||provider.applicationInfo==null||provider.applicationInfo.uid==android.os.Process.myUid())return false;
    try(AssetFileDescriptor descriptor=context.getContentResolver().openAssetFileDescriptor(uri,"r")){
     if(descriptor==null)return false;
    }
   }
   return true;
  }catch(Exception denied){return false;}
 }
}
