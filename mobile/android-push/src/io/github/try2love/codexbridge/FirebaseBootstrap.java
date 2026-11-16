package io.github.try2love.codexbridge;
import android.app.*;
import android.content.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
public final class FirebaseBootstrap {
 public static void enable(MainActivity app){
  if(FirebaseApp.initializeApp(app)==null){app.message("이 설치 패키지가 아직 구성되지 않았습니다. Firebase 프로젝트");return;}
  TaskNotifications.createChannel(app,"tasks");
  FirebaseMessaging.getInstance().setAutoInitEnabled(true);
  FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{app.getSharedPreferences("bridge",0).edit().putString("fcmToken",token).apply();app.registerPushToken();}).addOnFailureListener(e->app.message("시스템 푸시 등록에 실패했습니다. 확인하세요. Google 서비스 및 네트워크。"));
 }
}
