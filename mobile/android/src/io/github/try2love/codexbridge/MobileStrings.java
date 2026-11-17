package io.github.try2love.codexbridge;

import android.content.Context;

/** 화면 문구는 공용 언어팩에서 선택하며 저장한 언어 선택을 유지한다. */
final class MobileStrings {
 static String language(Context context){
  return MobileLocaleData.normalize(context.getSharedPreferences("bridge",0).getString("language",null));
 }
 static String text(Context context,String value){
  return MobileLocaleData.text(value,language(context));
 }
}
