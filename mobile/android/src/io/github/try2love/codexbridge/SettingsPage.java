package io.github.try2love.codexbridge;

import android.app.*;
import android.animation.ValueAnimator;
import android.content.*;
import android.graphics.Bitmap;
import android.graphics.drawable.BitmapDrawable;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.widget.*;
import android.transition.*;
import java.util.*;

/** A full-screen settings window preserves the caller's WebView and active downloads. */
final class SettingsPage extends Dialog implements SharedPreferences.OnSharedPreferenceChangeListener {
 private final MainActivity owner;
 private final SharedPreferences prefs;
 private final SettingsUi ui;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final LinearLayout notificationHost;
 private final LinearLayout body,systemHost;
 private final SettingsUi.ToggleRow taskToggle,backgroundToggle;
 private final View backgroundDivider;
 private final FrameLayout screen;
 private final ScrollView scroll;
 private final int initialScroll;
 private final boolean entering;
 private boolean closing;
 private Bitmap previousFrame;
 private BitmapDrawable previousDrawable;
 private ValueAnimator pageAnimator,themeAnimator;
 private final Runnable refreshStatus=new Runnable(){public void run(){if(isShowing()){refresh();handler.postDelayed(this,3000);}}};
 private String signature="";
 private SettingsMotion.Sheet themePicker;
 SettingsPage(MainActivity owner,int position){this(owner,position,true,null);}
 SettingsPage(MainActivity owner,int position,boolean entering){this(owner,position,entering,null);}
 private SettingsPage(MainActivity owner,int position,boolean entering,Bitmap previousFrame){
  super(SettingsUi.themed(owner),owner.getResources().getIdentifier("SettingsTheme","style",owner.getPackageName()));this.owner=owner;initialScroll=position;this.entering=entering;this.previousFrame=previousFrame;prefs=owner.getSharedPreferences("bridge",0);ui=new SettingsUi(getContext());setOwnerActivity(owner);requestWindowFeature(Window.FEATURE_NO_TITLE);
  LinearLayout content=ui.column();content.setBackgroundColor(ui.page);
  LinearLayout toolbar=new LinearLayout(getContext());toolbar.setGravity(Gravity.CENTER_VERTICAL);toolbar.setPadding(ui.dp(12),ui.dp(8),ui.dp(12),ui.dp(8));toolbar.setBackgroundColor(ui.surface);
  View back=ui.icon("back",ui.text);back.setContentDescription(ui.L("뒤로"));ui.clickable(back,this::close);toolbar.addView(back,new LinearLayout.LayoutParams(ui.dp(44),ui.dp(44)));
  TextView title=ui.text("설정",20,ui.text);title.setTypeface(android.graphics.Typeface.create("sans-serif-medium",0));toolbar.addView(title);content.addView(toolbar);
  scroll=new ScrollView(getContext());scroll.setFillViewport(true);scroll.setClipToPadding(false);body=ui.column();body.setPadding(ui.dp(20),ui.dp(12),ui.dp(20),ui.dp(24));scroll.addView(body);content.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  notificationHost=ui.column();body.addView(notificationHost);
  LinearLayout notifications=ui.section(notificationHost,"알림");
  taskToggle=ui.toggle(notifications,"작업 알림",prefs.getBoolean("alerts",false),owner::toggleNotifications);
  backgroundToggle=ui.toggle(notifications,"백그라운드 알림",prefs.getBoolean("backgroundNotifications",false),owner::toggleBackgroundNotifications);backgroundDivider=notifications.getChildAt(1);
  ui.hint(backgroundToggle.row,"백그라운드 알림 정보",()->new AlertDialog.Builder(getContext()).setTitle(ui.L("백그라운드 알림 정보")).setMessage(ui.L("백그라운드 알림은 계속 개선되고 있습니다. 이를 활성화하면 배터리 사용량이 증가하거나 장치가 과열될 수 있습니다.\n문제가 발생하거나 제안 사항이 있는 경우 문제 또는 PR를 제출해 주세요. 감사합니다!")).setPositiveButton(ui.L("닫기"),null).show());
  systemHost=ui.column();systemHost.setPadding(0,ui.dp(16),0,0);notificationHost.addView(systemHost);buildNotifications();
  LinearLayout app=ui.section(body,"앱");themeRow(app);
  LinearLayout update=ui.action(app,"업데이트 확인","",()->{});TextView value=ui.value(update,owner.appVersion());
  android.view.ViewGroup.LayoutParams valueLayout=value.getLayoutParams();update.removeView(value);update.addView(value,update.getChildCount()-1,valueLayout);
  update.setOnClickListener(v->owner.checkUpdate(this,update,value));
  screen=new FrameLayout(getContext());screen.addView(content,new FrameLayout.LayoutParams(-1,-1));setContentView(screen);
  getWindow().setBackgroundDrawableResource(android.R.color.transparent);getWindow().clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);getWindow().setWindowAnimations(0);getWindow().getDecorView().setPadding(0,0,0,0);
  new SystemBars(getWindow(),screen,()->{}).update(ui.surface,ui.page);
  setOnShowListener(d->{getWindow().setLayout(-1,-1);if(entering&&SettingsMotion.enabled()){screen.setAlpha(0);screen.setTranslationX(ui.dp(24));}
   screen.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener(){public boolean onPreDraw(){screen.getViewTreeObserver().removeOnPreDrawListener(this);scroll.scrollTo(0,initialScroll);appear();return true;}});
  });
 }
 int scrollPosition(){return scroll.getScrollY();}
 boolean isClosing(){return closing;}
 SettingsPage replacement(){Bitmap frame=ui.page==new SettingsUi(SettingsUi.themed(owner)).page?null:SettingsMotion.capture(screen);return new SettingsPage(owner,scrollPosition(),false,frame);}
 private void appear(){
  if(closing||!isShowing())return;
  if(previousFrame!=null){
   previousDrawable=new BitmapDrawable(getContext().getResources(),previousFrame);previousDrawable.setBounds(0,0,screen.getWidth(),screen.getHeight());screen.getOverlay().add(previousDrawable);
   themeAnimator=SettingsMotion.animate(SettingsMotion.THEME,f->previousDrawable.setAlpha(Math.round(255*(1-f))),()->{themeAnimator=null;releaseFrame();});
  }else if(entering)pageAnimator=SettingsMotion.animate(SettingsMotion.ENTER,f->{screen.setAlpha(f);screen.setTranslationX(ui.dp(24)*(1-f));},()->pageAnimator=null);
 }
 private void releaseFrame(){
  if(themeAnimator!=null){themeAnimator.cancel();themeAnimator=null;}if(previousDrawable!=null){screen.getOverlay().remove(previousDrawable);previousDrawable=null;}if(previousFrame!=null){previousFrame.recycle();previousFrame=null;}
 }
 private void close(){
  if(closing||!isShowing())return;closing=true;if(pageAnimator!=null)pageAnimator.cancel();releaseFrame();TransitionManager.endTransitions(body);
  float alpha=screen.getAlpha(),position=screen.getTranslationX();pageAnimator=SettingsMotion.animate(SettingsMotion.EXIT,f->{screen.setAlpha(alpha*(1-f));screen.setTranslationX(position+(ui.dp(24)-position)*f);},()->{pageAnimator=null;dismiss();});
 }
 @Override public void onBackPressed(){close();}
 @Override public void cancel(){close();}
 @Override public boolean dispatchTouchEvent(MotionEvent event){return closing||super.dispatchTouchEvent(event);}
 @Override protected void onStart(){super.onStart();prefs.registerOnSharedPreferenceChangeListener(this);handler.post(refreshStatus);}
 @Override protected void onStop(){prefs.unregisterOnSharedPreferenceChangeListener(this);handler.removeCallbacksAndMessages(null);if(pageAnimator!=null){pageAnimator.cancel();pageAnimator=null;}releaseFrame();TransitionManager.endTransitions(body);if(themePicker!=null)themePicker.dismiss();super.onStop();}
 @Override public void onSharedPreferenceChanged(SharedPreferences preferences,String key){
  if("settingsTheme".equals(key)){owner.reopenSettings(this);return;}
  if("alerts".equals(key)||"backgroundNotifications".equals(key))refresh(true);
 }
 void refresh(){refresh(false);}
 private void refresh(boolean animate){
  if(closing)return;
  String next=statusSignature();if(next.equals(signature))return;
  if(animate&&SettingsMotion.enabled()&&body.isLaidOut()){TransitionManager.endTransitions(body);TransitionSet transition=new TransitionSet().setOrdering(TransitionSet.ORDERING_TOGETHER);transition.addTransition(new ChangeBounds()).addTransition(new Fade());transition.setDuration(SettingsMotion.LAYOUT);transition.setInterpolator(SettingsMotion.EASE);TransitionManager.beginDelayedTransition(body,transition);}
  int position=scroll.getScrollY();buildNotifications();scroll.post(()->scroll.scrollTo(0,position));
 }
 private String statusSignature(){
  NotificationManager manager=(NotificationManager)owner.getSystemService(Context.NOTIFICATION_SERVICE);
  PowerManager power=(PowerManager)owner.getSystemService(Context.POWER_SERVICE);
  return prefs.getBoolean("alerts",false)+":"+prefs.getBoolean("backgroundNotifications",false)+":"+manager.areNotificationsEnabled()+":"+blocked("foreground-tasks")+":"+blocked("background-monitor")+":"+power.isIgnoringBatteryOptimizations(owner.getPackageName())+":"+connectionStates();
 }
 private void buildNotifications(){
  signature=statusSignature();systemHost.removeAllViews();
  boolean alerts=prefs.getBoolean("alerts",false),background=alerts&&prefs.getBoolean("backgroundNotifications",false);
  taskToggle.checked(alerts);backgroundToggle.checked(background);backgroundToggle.row.setVisibility(alerts?View.VISIBLE:View.GONE);backgroundDivider.setVisibility(alerts?View.VISIBLE:View.GONE);systemHost.setVisibility(alerts?View.VISIBLE:View.GONE);
  if(!alerts)return;
  LinearLayout system=ui.section(systemHost,"시스템 권한");
  boolean allowed=((NotificationManager)owner.getSystemService(Context.NOTIFICATION_SERVICE)).areNotificationsEnabled();
  boolean tasksBlocked=blocked("foreground-tasks"),backgroundBlocked=background&&blocked("background-monitor");
  String permission=allowed?(tasksBlocked||backgroundBlocked?"조치 필요":"허용됨"):"알림 허용";
  LinearLayout permissions=ui.action(system,"알림 권한",permission,()->openSetting(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,owner.getPackageName())));
  if(!allowed||tasksBlocked||backgroundBlocked)((TextView)permissions.getChildAt(1)).setTextColor(ui.danger);
  if(tasksBlocked||backgroundBlocked){
   String warning=tasksBlocked?(backgroundBlocked?"작업 및 백그라운드 알림 채널이 꺼져 있습니다.":"작업 알림 채널이 꺼져 있습니다"):"백그라운드 알림 채널이 꺼져 있습니다";
   LinearLayout labels=(LinearLayout)permissions.getChildAt(0);TextView detail=ui.text(warning,12,ui.danger);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=ui.dp(4);labels.addView(detail,p);
  }
  if(background){
   ui.action(system,"백그라운드 설정","앱 세부정보",()->openSetting(detailsIntent()));
   PowerManager power=(PowerManager)owner.getSystemService(Context.POWER_SERVICE);
   ui.action(system,"배터리 최적화",power.isIgnoringBatteryOptimizations(owner.getPackageName())?"최적화 제외":"사용 중",()->openSetting(new Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)));
  }
  ui.action(system,"알림 소스","",this::showNotificationSources);
  ui.action(system,"테스트 알림 보내기","10초 후",owner::testNotification);
  Map<String,String> connections=connectionStates();
  if(connections.values().stream().anyMatch(value->!"연결됨".equals(value))){
   LinearLayout row=ui.action(system,"컴퓨터 연결","조치 필요",this::showConnections);((TextView)row.getChildAt(1)).setTextColor(ui.danger);
  }
 }
 private void showNotificationSources(){
  LinearLayout content=ui.column();content.setPadding(ui.dp(8),ui.dp(8),ui.dp(8),ui.dp(8));
  TextView hint=ui.text("이 전화기에 대한 작업 알림을 선택하세요. 채팅 및 알림 받은 편지함은 계속 사용할 수 있습니다.",13,ui.muted);hint.setPadding(ui.dp(16),ui.dp(8),ui.dp(16),ui.dp(12));content.addView(hint);
  if(owner.saved().isEmpty())content.addView(ui.text("저장된 컴퓨터 연결이 없습니다.",15,ui.muted));
  LinearLayout list=ui.column();content.addView(list);
  for(String address:new TreeSet<>(owner.saved())){
   SettingsUi.ToggleRow[] choice=new SettingsUi.ToggleRow[1];
   choice[0]=ui.toggle(list,owner.computerName(address),NotificationSources.enabled(prefs,address),()->{
    boolean enabled=!NotificationSources.enabled(prefs,address);
    NotificationSources.setEnabled(prefs,address,enabled);choice[0].checked(enabled);
    choice[0].row.setContentDescription(owner.computerName(address)+", "+address+", "+ui.L(enabled?"켜짐":"꺼짐"));
    MonitorService.refresh();
   });
   LinearLayout labels=(LinearLayout)choice[0].row.getChildAt(0);
   TextView url=ui.text(address,12,ui.muted);url.setPadding(0,ui.dp(4),ui.dp(8),0);labels.addView(url);
   choice[0].row.setContentDescription(owner.computerName(address)+", "+address+", "+ui.L(NotificationSources.enabled(prefs,address)?"켜짐":"꺼짐"));
  }
  ScrollView scroll=new ScrollView(getContext());scroll.addView(content);
  new AlertDialog.Builder(getContext()).setTitle(ui.L("알림 소스")).setView(scroll).setPositiveButton(ui.L("완료"),null).show();
 }
 private boolean blocked(String id){NotificationChannel channel=((NotificationManager)owner.getSystemService(Context.NOTIFICATION_SERVICE)).getNotificationChannel(id);return channel!=null&&channel.getImportance()==NotificationManager.IMPORTANCE_NONE;}
 private Map<String,String> connectionStates(){
  Map<String,NotificationReceiver.Status> statuses=MonitorService.connectionStates();Map<String,String> result=new TreeMap<>();
  for(String address:owner.saved()){
   NotificationReceiver.Status status=statuses.get(address);
   result.put(address,status==NotificationReceiver.Status.RECEIVING?"연결됨":status==NotificationReceiver.Status.RETRYING?"재시도 중":"다시 로그인하세요.");
  }
  return result;
 }
 private void showConnections(){
  StringBuilder message=new StringBuilder();
  for(Map.Entry<String,String> row:connectionStates().entrySet()){
   if(message.length()>0)message.append("\n\n");message.append(owner.computerName(row.getKey())).append('\n').append(row.getKey()).append('\n').append(ui.L(row.getValue()));
  }
  new AlertDialog.Builder(getContext()).setTitle(ui.L("컴퓨터 연결")).setMessage(message).setNegativeButton(ui.L("닫기"),null).setPositiveButton(ui.L("상태 새로고침"),(d,w)->{MonitorService.refresh();showConnections();}).show();
 }
 private Intent detailsIntent(){return new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+owner.getPackageName()));}
 private void openSetting(Intent intent){try{owner.startActivity(intent);}catch(RuntimeException unavailable){try{owner.startActivity(detailsIntent());}catch(RuntimeException denied){Toast.makeText(getContext(),ui.L("시스템 설정에서 이 앱의 세부정보를 엽니다."),Toast.LENGTH_LONG).show();}}}
 private void themeRow(LinearLayout app){
  LinearLayout row=ui.action(app,"테마",themeName(),this::chooseTheme);
  ui.hint(row,"테마 안내",()->Toast.makeText(getContext(),ui.L("개발 중입니다. 테마 변경 사항은 현재 설정에만 적용됩니다."),Toast.LENGTH_LONG).show());
 }
 private String themeName(){String value=SettingsUi.theme(owner);return "light".equals(value)?"밝게":"dark".equals(value)?"어둡게":"시스템 설정 따르기";}
 private void chooseTheme(){
  if(themePicker!=null&&themePicker.isShowing())return;
  LinearLayout sheet=ui.column();sheet.setPadding(ui.dp(16),ui.dp(20),ui.dp(16),ui.dp(28));
  android.graphics.drawable.GradientDrawable face=ui.face(ui.surface,20);float radius=ui.dp(20);face.setCornerRadii(new float[]{radius,radius,radius,radius,0,0,0,0});sheet.setBackground(face);
  TextView title=ui.text("테마",20,ui.text);title.setPadding(ui.dp(16),0,ui.dp(16),ui.dp(12));sheet.addView(title);
  String[] values={"system","light","dark"},labels={"시스템 설정 따르기","밝게","어둡게"};
  RadioGroup options=new RadioGroup(getContext());sheet.addView(options,new LinearLayout.LayoutParams(-1,-2));
  for(int i=0;i<values.length;i++){
   final String value=values[i];RadioButton option=new RadioButton(getContext());option.setText(ui.L(labels[i]));option.setTextSize(15);option.setTextColor(ui.text);option.setChecked(value.equals(SettingsUi.theme(owner)));option.setPadding(ui.dp(16),0,ui.dp(16),0);option.setMinimumHeight(ui.dp(52));
   option.setButtonTintList(android.content.res.ColorStateList.valueOf(option.isChecked()?ui.accent:ui.track));
   option.setBackground(ui.face(option.isChecked()?ui.pressed:ui.surface,8));
   option.setOnClickListener(v->themePicker.close(()->prefs.edit().putString("settingsTheme",value).apply()));options.addView(option,new RadioGroup.LayoutParams(-1,-2));
  }
  TextView cancel=ui.text("취소",15,ui.muted);cancel.setGravity(Gravity.CENTER);cancel.setMinimumHeight(ui.dp(48));ui.clickable(cancel,()->themePicker.close(null));sheet.addView(cancel,new LinearLayout.LayoutParams(-1,-2));
  themePicker=new SettingsMotion.Sheet(getContext(),sheet,ui.dp(24));themePicker.show();
 }
}
