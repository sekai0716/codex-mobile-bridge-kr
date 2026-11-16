// Adapted from 2389859005/coding-mobile, MIT, commit 7a8f003. See ../LICENSE.coding-mobile.
// Product component. Only a verified Claude DevTools Console may receive input.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Automation.Text;

class ClaudeKeyboard {
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
    [StructLayout(LayoutKind.Explicit)] struct UNION {
        [FieldOffset(0)] public KEYBDINPUT key;
        [FieldOffset(0)] public MOUSEINPUT mouse;
    }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk,scan; public uint flags,time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int x,y; public uint data,flags,time; public UIntPtr extra; }
    [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] input, int size);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint first,uint second,bool attach);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
    [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll")] static extern IntPtr GetThreadDesktop(uint thread);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool GetUserObjectInformation(IntPtr handle,int index,StringBuilder value,uint length,out uint needed);
    [DllImport("wtsapi32.dll",CharSet=CharSet.Unicode)] static extern bool WTSQuerySessionInformation(IntPtr server,int id,int info,out IntPtr buffer,out uint bytes);
    [DllImport("wtsapi32.dll")] static extern void WTSFreeMemory(IntPtr buffer);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern int GetApplicationUserModelId(IntPtr process,ref uint length,StringBuilder value);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int mode);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    delegate bool EnumWindow(IntPtr window,IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback,IntPtr data);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr window);
    [StructLayout(LayoutKind.Sequential)] struct LastInput {public uint size,tick;}
    [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LastInput value);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window,uint command);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,StringBuilder text,int count);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
    [DllImport("user32.dll",EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr window,int index);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window,uint attribute,out uint value,uint size);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window,uint message,IntPtr wparam,IntPtr lparam);
    static string executable;
    static string cancelFile;
    static IntPtr inputWindow;
    static bool quitAction;
    static int quitPid;
    static int session=Process.GetCurrentProcess().SessionId;
    static void Stage(string text) {Console.WriteLine(text);Console.Out.Flush();}
    // Claude/DevTools의 실제 접근성 이름과 구형 오류 문구는 외부 계약이므로 번역하지 않습니다.
    static string OwnerIssue(string value,string marker) {
        if(String.IsNullOrEmpty(marker)||!value.Contains("["+marker+"]"))return null;
        if(value.Contains("BRIDGE_OWNER_BUSY"))return "OWNER_BUSY";
        if(value.Contains("BRIDGE_OWNER_UNCONFIRMED"))return "OWNER_UNCONFIRMED";
        if(value.Contains("BRIDGE_OWNER_LEGACY")||value.Contains("Claude \u6865\u63a5\u8fde\u63a5\u88ab\u5176\u4ed6\u7f51\u5173\u5360\u7528"))return "OWNER_LEGACY";
        return null;
    }
    static string DesktopName(IntPtr desktop) {
        var value=new StringBuilder(256);uint needed;
        return desktop!=IntPtr.Zero&&GetUserObjectInformation(desktop,2,value,512,out needed)?value.ToString():null;
    }
    static string DesktopUnavailable() {
        IntPtr buffer=IntPtr.Zero;
        try {
            uint bytes;
            // WTSSessionInfoEx's level-one union starts at byte eight. Query
            // this process's session, never another user's active console.
            if(!WTSQuerySessionInformation(IntPtr.Zero,session,25,out buffer,out bytes)||buffer==IntPtr.Zero||bytes<20||
               Marshal.ReadInt32(buffer,0)!=1||Marshal.ReadInt32(buffer,8)!=session)
                return "Windows 데스크톱을 사용할 수 없습니다. 현재 세션을 확인할 수 없습니다. 컴퓨터 바탕 화면을 복원한 후 다시 시도하십시오.";
            int connection=Marshal.ReadInt32(buffer,12),flags=Marshal.ReadInt32(buffer,16);
            var version=Environment.OSVersion.Version;
            if(version.Major==6&&version.Minor==1&&(flags==0||flags==1))flags=1-flags;
            if(flags==0)return "Windows 잠김; 컴퓨터의 잠금을 해제하고 다시 시도해 주세요.";
            if(flags!=1||connection!=0||session==0)return "Windows 데스크톱을 사용할 수 없습니다. 컴퓨터 데스크톱 세션을 복원하고 다시 시도해 주세요.";
        } finally {if(buffer!=IntPtr.Zero)WTSFreeMemory(buffer);}
        var input=OpenInputDesktop(0,false,1); // Read only; never switch desktops.
        if(input==IntPtr.Zero)return "Windows 입력 데스크톱을 사용할 수 없습니다. 시스템 보안 프롬프트를 끄거나 데스크톱을 복원한 후 다시 시도하십시오.";
        try {
            string current=DesktopName(GetThreadDesktop(GetCurrentThreadId())),active=DesktopName(input);
            if(current==null||active==null||!current.Equals(active,StringComparison.Ordinal))
                return "Windows 입력 데스크톱을 사용할 수 없습니다. 컴퓨터 바탕화면을 복원한 후 다시 시도해 주세요.";
        } finally {CloseDesktop(input);}
        return null;
    }
    static void CheckInteractiveDesktop() {
        var reason=DesktopUnavailable();if(reason!=null)throw new Exception(reason);
    }
    static void Activate(IntPtr window) {
        CheckCancelled();
        CheckInteractiveDesktop();
        uint ignored,current=GetCurrentThreadId(),foreground=GetWindowThreadProcessId(GetForegroundWindow(),out ignored);
        bool attached=foreground!=0&&foreground!=current&&AttachThreadInput(current,foreground,true);
        try {ShowWindow(window,9);BringWindowToTop(window);SetForegroundWindow(window);}
        finally {if(attached)AttachThreadInput(current,foreground,false);}
        Thread.Sleep(300);
        CheckForeground();
    }
    static bool Owned(int pid) {
        try { using(var p=Process.GetProcessById(pid)) return p.SessionId==session && p.ProcessName.Equals("Claude",StringComparison.OrdinalIgnoreCase) && p.MainModule.FileName.Equals(executable,StringComparison.OrdinalIgnoreCase); }
        catch { return false; }
    }
    sealed class AppWindow {
        public IntPtr Handle,Owner;
        public int Pid;
        public bool Visible,ToolWindow,Cloaked;
        public string Title="",ClassName="";
    }
    sealed class WindowSelection {
        public IntPtr Handle;
        public int Count;
    }
    static bool Eligible(AppWindow window,int pid) {
        return window.Pid==pid&&window.Handle!=IntPtr.Zero&&window.Visible&&!window.ToolWindow&&!window.Cloaked
            &&!String.IsNullOrEmpty(window.Title)&&!DevToolsTitle(window.Title);
    }
    static WindowSelection SelectWindow(IEnumerable<AppWindow> windows,int pid,IntPtr foreground) {
        var selected=new WindowSelection();IntPtr only=IntPtr.Zero;
        foreach(var window in windows) {
            if(!Eligible(window,pid))continue;
            selected.Count++;only=window.Handle;
            if(window.Handle==foreground)selected.Handle=foreground;
        }
        if(selected.Count==1)selected.Handle=only;
        return selected;
    }
    static WindowSelection SelectDevTools(IEnumerable<AppWindow> windows,int pid) {
        var selected=new WindowSelection();
        foreach(var window in windows) {
            if(window.Pid!=pid||window.Handle==IntPtr.Zero||!window.Visible||window.Cloaked||!DevToolsTitle(window.Title))continue;
            selected.Count++;selected.Handle=window.Handle;
        }
        if(selected.Count!=1)selected.Handle=IntPtr.Zero;
        return selected;
    }
    static List<AppWindow> ReadWindows(int selectedPid) {
        var windows=new List<AppWindow>();
        EnumWindows(delegate(IntPtr handle,IntPtr data) {
            uint pid;GetWindowThreadProcessId(handle,out pid);
            if(pid!=selectedPid)return true;
            var title=new StringBuilder(1024);var name=new StringBuilder(256);
            GetWindowText(handle,title,title.Capacity);GetClassName(handle,name,name.Capacity);
            long style=IntPtr.Size==8?GetWindowLongPtr(handle,-20).ToInt64():GetWindowLong(handle,-20);
            uint cloaked;bool hidden=DwmGetWindowAttribute(handle,14,out cloaked,4)==0&&cloaked!=0;
            windows.Add(new AppWindow {Handle=handle,Owner=GetWindow(handle,4),Pid=(int)pid,
                Visible=IsWindowVisible(handle),ToolWindow=(style&0x80)!=0,Cloaked=hidden,
                Title=title.ToString(),ClassName=name.ToString()});
            return true;
        },IntPtr.Zero);
        return windows;
    }
    static IntPtr WaitWindow(Func<WindowSelection> find,Action restore,Action check,Action pause,int attempts) {
        bool restored=false;
        for(int attempt=0;attempt<attempts;attempt++) {
            check();var selected=find();
            if(selected.Handle!=IntPtr.Zero)return selected.Handle;
            if(selected.Count>1)throw new Exception("여러 개 감지됨 Claude 창, 연결할 창을 선택하고 다시 시도해 주세요.");
            if(!restored&&restore!=null) {check();restore();restored=true;}
            if(attempt+1<attempts)pause();
        }
        throw new Exception("Claude 창이 준비되지 않았습니다. 시스템 트레이에서 열어주세요. Claude 나중에 다시 시도해 보세요");
    }
    static IntPtr WaitAppWindow(Process process,bool restore) {
        Action check=delegate {
            CheckCancelled();
            if(restore&&!quitAction)CheckInteractiveDesktop();
            if(process.HasExited||!Owned(process.Id))throw new Exception("Claude 기본 프로세스가 변경되었습니다. 다시 연결해 보세요.");
        };
        Action reopen=restore?(Action)delegate {
            // Claude's native single-instance launch restores its tray window.
            // Never activate one of its many hidden utility windows directly.
            check();
            using(var launched=Process.Start(NativeLaunch(executable,ApplicationId(process.Id),
                Environment.GetFolderPath(Environment.SpecialFolder.Windows)))) {}
        }:null;
        return WaitWindow(()=>SelectWindow(ReadWindows(process.Id),process.Id,GetForegroundWindow()),
                          reopen,check,()=>Thread.Sleep(250),32);
    }
    static string ApplicationId(int pid) {
        var handle=OpenProcess(0x1000,false,pid); // Query limited process metadata only.
        if(handle==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        try {
            uint length=0;int status=GetApplicationUserModelId(handle,ref length,null);
            if(status==15700||status==15703)return null; // Unpackaged / no application identity.
            if(status!=122||length==0||length>512)throw new Exception("확인할 수 없습니다 Claude 네이티브 애플리케이션 시작 입구");
            var value=new StringBuilder((int)length);
            status=GetApplicationUserModelId(handle,ref length,value);
            if(status!=0)throw new System.ComponentModel.Win32Exception(status);
            return value.ToString();
        } finally {CloseHandle(handle);}
    }
    static ProcessStartInfo NativeLaunch(string path,string applicationId,string windowsDirectory) {
        if(applicationId==null)return new ProcessStartInfo(path) {UseShellExecute=false,WorkingDirectory=Path.GetDirectoryName(path)};
        // Registered Store binaries can reject both CreateProcess and direct
        // ShellExecute. Use the selected process's OS-reported app identity.
        if(!System.Text.RegularExpressions.Regex.IsMatch(applicationId,@"^[A-Za-z0-9_.-]+_[A-Za-z0-9]+![A-Za-z0-9_.-]+$"))
            throw new Exception("Claude 기본 애플리케이션 시작 항목 형식이 잘못되었습니다.");
        return new ProcessStartInfo(Path.Combine(windowsDirectory,"explorer.exe"),"shell:AppsFolder\\"+applicationId) {
            UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};
    }
    static string JsonString(string value) {
        return "\""+value.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r","\\r").Replace("\n","\\n").Replace("\t","\\t")+"\"";
    }
    static void InspectWindow(Process process) {
        // Diagnostic only: no native launch, activation, key state or input.
        var windows=ReadWindows(process.Id);var selection=SelectWindow(windows,process.Id,GetForegroundWindow());
        var json=new StringBuilder();
        json.Append("{\"processId\":").Append(process.Id).Append(",\"sessionId\":").Append(process.SessionId)
            .Append(",\"helperSessionId\":").Append(session).Append(",\"mainWindowHandle\":").Append(process.MainWindowHandle.ToInt64())
            .Append(",\"selectedWindowHandle\":").Append(selection.Handle.ToInt64()).Append(",\"eligibleCount\":").Append(selection.Count)
            .Append(",\"appUserModelId\":");
        var applicationId=ApplicationId(process.Id);
        json.Append(applicationId==null?"null":JsonString(applicationId)).Append(",\"windows\":[");
        bool first=true;
        foreach(var window in windows) {
            if(!first)json.Append(',');first=false;
            json.Append("{\"handle\":").Append(window.Handle.ToInt64()).Append(",\"owner\":").Append(window.Owner.ToInt64())
                .Append(",\"visible\":").Append(window.Visible?"true":"false").Append(",\"toolWindow\":").Append(window.ToolWindow?"true":"false")
                .Append(",\"cloaked\":").Append(window.Cloaked?"true":"false").Append(",\"eligible\":").Append(Eligible(window,process.Id)?"true":"false")
                .Append(",\"devTools\":").Append(DevToolsTitle(window.Title)?"true":"false").Append(",\"className\":").Append(JsonString(window.ClassName)).Append('}');
        }
        Console.WriteLine(json.Append("]}").ToString());
    }
    static void CheckCancelled() {
        if ((cancelFile!=null && File.Exists(cancelFile)) || (!quitAction&&!backgroundAction&&!backgroundCleanupAction&&(GetAsyncKeyState(27)&0x8001)!=0))
            throw new Exception(quitAction?"취소 Claude 종료":"키보드 연결이 취소되었습니다. Claude 타이틀 선택 시작을 다시 시도할 수 있습니다.");
    }
    static void CheckForeground() {
        CheckCancelled();
        CheckInteractiveDesktop();
        var window=GetForegroundWindow();uint pid; GetWindowThreadProcessId(window,out pid);
        if (!Owned((int)pid)) throw new Exception(quitAction?"Claude 종료 창이 포그라운드에 유지되지 않으며 종료 요청이 제출되지 않았습니다. 다시 종료해 보세요.":"초점이 나갔어 Claude，자동 연결이 중지되었습니다. 다시 시도해 주세요.");
        if(inputWindow!=IntPtr.Zero&&window!=inputWindow)throw new Exception(quitAction?"Claude 종료 창이 변경되었으며 종료 요청이 제출되지 않았습니다. 다시 종료해 보세요.":"Claude 창이 바뀌어 자동연결이 멈췄습니다. 다시 시도해 주세요.");
    }
    static bool PromptName(string name,string id) {
        return id=="console-prompt" || name=="Console prompt" || name=="\u63a7\u5236\u53f0\u63d0\u793a" || name=="\u63a7\u5236\u53f0\u63d0\u793a\u7b26";
    }
    static bool IsPrompt(AutomationElement e) {
        return e!=null && Owned(e.Current.ProcessId) && PromptName(e.Current.Name,e.Current.AutomationId);
    }
    static void CheckPrompt(AutomationElement prompt) {
        CheckForeground();
        if(!FocusedWithin(prompt,AutomationElement.FocusedElement,TreeWalker.ControlViewWalker.GetParent,
                          (first,second)=>Automation.Compare(first,second)))
            throw new Exception("Console 입력 포커스가 변경되어 자동 입력이 취소되었습니다.");
    }
    static bool FocusedWithin<T>(T expected,T focused,Func<T,T> parent,Func<T,T,bool> equal) where T:class {
        for(int i=0;i<5&&focused!=null;i++,focused=parent(focused))if(equal(expected,focused))return true;
        return false;
    }
    static void FocusPrompt(AutomationElement prompt) {
        CheckForeground();
        prompt.SetFocus();
        for(int i=0;i<10;i++){Thread.Sleep(100);CheckForeground();try{CheckPrompt(prompt);return;}catch{}}
        CheckPrompt(prompt);
    }
    static INPUT Key(ushort vk,bool up) { var i=new INPUT(); i.type=1;i.data.key.vk=vk;i.data.key.flags=(up?2u:0u)|((vk>=33&&vk<=40)?1u:0u);return i; }
    static void Send(INPUT[] keys) {
        CheckForeground();
        if(SendInput((uint)keys.Length,keys,Marshal.SizeOf(typeof(INPUT)))!=keys.Length) throw new Exception("Windows 키보드 입력을 거부하고 있습니다. 확인해 주세요. Claude 권한이 보조자의 권한과 일치합니까？");
    }
    static void Shortcut() { CheckForeground();Send(new[]{Key(17,false),Key(18,false),Key(73,false),Key(73,true),Key(18,true),Key(17,true)}); }
    static AutomationElement ConsolePrompt() {
        return ConsolePrompt(AutomationElement.FromHandle(GetForegroundWindow()));
    }
    static AutomationElement ConsolePrompt(AutomationElement root) {
        var elements=root.FindAll(TreeScope.Descendants,new OrCondition(
            new PropertyCondition(AutomationElement.AutomationIdProperty,"console-prompt"),
            new PropertyCondition(AutomationElement.NameProperty,"Console prompt"),
            new PropertyCondition(AutomationElement.NameProperty,"\u63a7\u5236\u53f0\u63d0\u793a"),
            new PropertyCondition(AutomationElement.NameProperty,"\u63a7\u5236\u53f0\u63d0\u793a\u7b26")));
        foreach(AutomationElement e in elements) if(IsPrompt(e)&&!e.Current.IsOffscreen) return e;
        return null;
    }
    static bool DevToolsTitle(string title) {
        return title=="Developer Tools"||title=="DevTools"||title=="\u5f00\u53d1\u8005\u5de5\u5177"||title.StartsWith("Developer Tools - ",StringComparison.Ordinal)||title.StartsWith("DevTools - ",StringComparison.Ordinal)||title.StartsWith("\u5f00\u53d1\u8005\u5de5\u5177 - ",StringComparison.Ordinal);
    }
    static void CloseDevTools() {
        // Called only after the parent verifies the signed bridge heartbeat.
        // Detached tools close by their exact Claude-owned window, without
        // activating another app or ever sending a close to Claude's main UI.
        var windows=new System.Collections.Generic.List<IntPtr>();
        EnumWindows(delegate(IntPtr window,IntPtr data){uint pid;GetWindowThreadProcessId(window,out pid);if(IsWindowVisible(window)&&Owned((int)pid))windows.Add(window);return true;},IntPtr.Zero);
        int closed=0;
        foreach(var window in windows) {
            CheckCancelled();
            if(!IsWindow(window))continue;
            var root=AutomationElement.FromHandle(window);
            if(ConsolePrompt(root)==null)continue;
            var title=new StringBuilder(512);GetWindowText(window,title,title.Capacity);
            if(DevToolsTitle(title.ToString())) {
                if(!PostMessage(window,0x0010,IntPtr.Zero,IntPtr.Zero))throw new Exception("Claude 연결되었지만 개발자 도구를 닫지 못했습니다.");
                for(int i=0;i<30&&IsWindow(window);i++)Thread.Sleep(100);
                if(IsWindow(window))throw new Exception("Claude 연결되었습니다. 개발자 도구가 닫히지 않았습니다.");
                closed++;continue;
            }
            var close=root.FindFirst(TreeScope.Descendants,new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Button),new OrCondition(new PropertyCondition(AutomationElement.NameProperty,"Close DevTools"),new PropertyCondition(AutomationElement.NameProperty,"\u5173\u95ed\u5f00\u53d1\u8005\u5de5\u5177"))));
            object pattern;
            if(close!=null&&Owned(close.Current.ProcessId)&&!close.Current.IsOffscreen&&close.TryGetCurrentPattern(InvokePattern.Pattern,out pattern)) {((InvokePattern)pattern).Invoke();closed++;continue;}
            // A docked Console without its own accessible close button remains
            // open. Cleanup must never activate a window or send a shortcut.
            throw new Exception("Claude 연결됨; 개발자 도구가 자동으로 닫히지 않았습니다. 수동으로 닫아주세요.");
        }
        Stage("DevTools closed: "+closed);
    }
    static void SelectConsoleTab() {
        var root=AutomationElement.FromHandle(GetForegroundWindow());
        var tabs=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.TabItem));
        foreach(AutomationElement tab in tabs) {
            string name=tab.Current.Name;
            if((name=="Console"||name=="\u63a7\u5236\u53f0")&&!tab.Current.IsOffscreen&&Owned(tab.Current.ProcessId)) {
                object pattern;
                CheckForeground();
                if(tab.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern)) ((SelectionItemPattern)pattern).Select();
                return;
            }
        }
    }
    const string DeveloperMenuUnavailable="제발 Claude 도움말 메뉴에서 개발자 모드를 활성화하고 다시 연결해 보세요.";
    static T WaitMenuEntry<T>(Func<T> find,Action check,Action pause) where T:class {
        for(int attempt=0;attempt<20;attempt++) {
            check();var item=find();if(item!=null)return item;
            if(attempt<19)pause();
        }
        return null;
    }
    static void EnableDeveloperMenu<T>(Func<string,T> find,Action<T> invoke,Action<T> expand,Action check,Action pause) where T:class {
        check();var help=find("help");
        if(help==null) {
            var menu=find("menu");if(menu==null)throw new Exception(DeveloperMenuUnavailable);
            check();invoke(menu);
            help=WaitMenuEntry(()=>find("help"),check,pause);
        }
        if(help==null)throw new Exception(DeveloperMenuUnavailable);
        check();expand(help);
        T enable=null,troubleshooting=null;
        WaitMenuEntry(delegate {
            enable=find("enable");troubleshooting=find("troubleshooting");
            return enable??troubleshooting;
        },check,pause);
        if(enable==null&&troubleshooting!=null) {
            check();expand(troubleshooting);
            enable=WaitMenuEntry(()=>find("enable"),check,pause);
        }
        if(enable==null)throw new Exception(DeveloperMenuUnavailable);
        check();invoke(enable);
    }
    static bool AvailableMenuControl(AutomationElement item) {
        return item!=null&&Owned(item.Current.ProcessId)&&!item.Current.IsOffscreen&&item.Current.IsEnabled;
    }
    static AutomationElement FindMenuControl(AutomationElement root,ControlType type,params string[] names) {
        var conditions=new Condition[names.Length];
        for(int i=0;i<names.Length;i++)conditions[i]=new PropertyCondition(AutomationElement.NameProperty,names[i]);
        var elements=root.FindAll(TreeScope.Descendants,new AndCondition(
            new PropertyCondition(AutomationElement.ControlTypeProperty,type),new OrCondition(conditions)));
        foreach(AutomationElement item in elements)if(AvailableMenuControl(item))return item;
        return null;
    }
    static void InvokeMenuControl(AutomationElement item) {
        CheckForeground();object pattern;
        if(!AvailableMenuControl(item)||!item.TryGetCurrentPattern(InvokePattern.Pattern,out pattern))throw new Exception(DeveloperMenuUnavailable);
        ((InvokePattern)pattern).Invoke();
    }
    static void ExpandMenuControl(AutomationElement item) {
        CheckForeground();object pattern;
        if(!AvailableMenuControl(item)||!item.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out pattern))throw new Exception(DeveloperMenuUnavailable);
        ((ExpandCollapsePattern)pattern).Expand();
    }
    static void EnableDeveloperMode(Process process) {
        var window=WaitAppWindow(process,true);
        inputWindow=window;
        Activate(window);
        var root=AutomationElement.FromHandle(window);
        EnableDeveloperMenu(delegate(string role) {
            if(role=="menu")return FindMenuControl(root,ControlType.Button,"Menu","\u83dc\u5355");
            if(role=="help")return FindMenuControl(root,ControlType.MenuItem,"Help","\u5e2e\u52a9");
            if(role=="troubleshooting")return FindMenuControl(root,ControlType.MenuItem,"Troubleshooting","\u6545\u969c\u6392\u9664");
            if(role=="enable")return FindMenuControl(root,ControlType.MenuItem,"Enable Developer Mode…","Enable Developer Mode...","\u542f\u7528\u5f00\u53d1\u8005\u6a21\u5f0f\u2026","\u542f\u7528\u5f00\u53d1\u8005\u6a21\u5f0f...");
            return null;
        },InvokeMenuControl,ExpandMenuControl,CheckForeground,()=>Thread.Sleep(100));
        // Preserve Claude's native Enable/Don't Enable confirmation.
        Stage("확인해주세요 Claude 개발자 모드에서는 완료 후에도 연결이 계속된다는 메시지가 표시됩니다.");
    }
    const string QuitMenuUnavailable="Claude 현재 검증 가능한 백엔드 엑시트가 없으며 엑시트가 아직 제출되지 않았습니다. 컴퓨터에서 정상적으로 종료하시거나, 강제종료를 별도로 확인해 주시기 바랍니다.";
    static bool QuitMenuName(ControlType type,string name) {
        return type==ControlType.MenuItem&&(name=="Exit"||name=="\u9000\u51fa"||name=="\u7d50\u675f");
    }
    static T UniqueQuitControl<T>(IEnumerable<T> items,Func<T,bool> matches) where T:class {
        T found=null;
        foreach(var item in items)if(matches(item)) {
            if(found!=null)throw new Exception("Claude 배경 출구 입구가 고유하지 않으며 출구가 아직 제출되지 않았습니다. 컴퓨터를 정상적으로 종료해주세요.");
            found=item;
        }
        return found;
    }
    static void InvokeExistingQuit<T>(Func<T> find,Func<T,T,bool> same,Action<T> invoke,Action check) where T:class {
        check();var exit=find();
        if(exit==null)throw new Exception(QuitMenuUnavailable);
        check();var current=find();
        if(current==null||!same(exit,current))throw new Exception("Claude 배경 출구 입구가 변경되었으며 출구가 아직 제출되지 않았습니다.");
        check();invoke(current);
    }
    static AutomationElement FindQuitControl(AutomationElement root,int pid) {
        var elements=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.MenuItem));
        var candidates=new List<AutomationElement>();
        foreach(AutomationElement item in elements)candidates.Add(item);
        return UniqueQuitControl(candidates,item=>item.Current.ProcessId==pid&&AvailableMenuControl(item)
            &&QuitMenuName(item.Current.ControlType,item.Current.Name));
    }
    static bool SameQuitTarget(bool exited,bool owned,long actualStart,long expectedStart,bool exists,int windowPid,int expectedPid) {
        return !exited&&owned&&actualStart==expectedStart&&exists&&windowPid==expectedPid;
    }
    static void CheckQuitNavigation(Process process,long started,IntPtr window) {
        CheckCancelled();
        uint pid;GetWindowThreadProcessId(window,out pid);
        if(!SameQuitTarget(process.HasExited,Owned(process.Id),process.StartTime.ToUniversalTime().Ticks,
            started,IsWindow(window),(int)pid,process.Id))
            throw new Exception("Claude 기본 프로세스 또는 창이 변경되었으며 종료 요청이 중지되었습니다. 다시 시도해 주세요.");
    }
    static void InvokeQuitControl(AutomationElement item,Action check,Action submitting) {
        check();
        if(item==null||item.Current.ProcessId!=quitPid||!AvailableMenuControl(item)||
           !QuitMenuName(item.Current.ControlType,item.Current.Name))throw new Exception(QuitMenuUnavailable);
        object pattern;
        if(!item.TryGetCurrentPattern(InvokePattern.Pattern,out pattern))throw new Exception(QuitMenuUnavailable);
        check();submitting();
        ((InvokePattern)pattern).Invoke();
    }
    sealed class QuitSubmission {
        public volatile bool Started,Finished;
        public Exception Error;
        readonly object gate=new object();
        bool cancelled;
        public bool CancelBeforeSubmit() {
            lock(gate) {if(Started)return false;cancelled=true;return true;}
        }
        public QuitSubmission() {}
        public void BeginSubmit(Action evidence,Func<bool> cancellationPending) {
            lock(gate) {
                if(cancelled||Started||cancellationPending())throw new OperationCanceledException();
                Started=true;evidence();
            }
        }
        public QuitSubmission(Process process,long started,IntPtr window) {
            Action check=delegate {
                lock(gate) {if(cancelled)throw new OperationCanceledException();}
                CheckQuitNavigation(process,started,window);
            };
            Action submitting=()=>BeginSubmit(delegate {
                // Flush evidence before Invoke: a lost reply cannot prove non-delivery.
                Stage("{\"quitPhase\":\"dispatching\",\"pid\":"+process.Id+"}");
            },()=>cancelFile!=null&&File.Exists(cancelFile));
            // UIA providers can block. Inspect only existing controls on an MTA
            // worker; do not open menus or retry after an uncertain invocation.
            var thread=new Thread(delegate() {
                try {
                    check();var root=AutomationElement.FromHandle(window);
                    InvokeExistingQuit(()=>FindQuitControl(root,process.Id),(a,b)=>Automation.Compare(a,b),
                        item=>InvokeQuitControl(item,check,submitting),check);
                }
                catch(Exception error) {Error=error;}
                finally {Finished=true;}
            });
            thread.IsBackground=true;thread.SetApartmentState(ApartmentState.MTA);thread.Start();
        }
    }
    static bool ProbeNativeDialog(Func<bool> inspect,Func<bool> exited,Func<bool> windowExists) {
        try {return inspect();}
        catch(ElementNotAvailableException) {return false;}
        catch(ArgumentException) {if(windowExists())throw;return false;}
        catch(COMException) {
            // UIA can return E_UNEXPECTED while a successfully submitted Exit
            // destroys the provider. An error on a live target stays an error.
            if(!exited()&&windowExists())throw;
            return false;
        }
    }
    static bool HasNativeDialog(Process process) {
        foreach(var window in ReadWindows(process.Id)) {
            if(!window.Visible||window.Cloaked||DevToolsTitle(window.Title))continue;
            if(ProbeNativeDialog(delegate {
                var root=AutomationElement.FromHandle(window.Handle);object pattern;
                if(root.Current.ProcessId!=process.Id||!Owned(process.Id))return false;
                bool modal=root.TryGetCurrentPattern(WindowPattern.Pattern,out pattern)&&((WindowPattern)pattern).Current.IsModal;
                if(modal)return true;
                if(window.ClassName!="#32770")return false;
                var buttons=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Button));
                foreach(AutomationElement button in buttons) {
                    string name=button.Current.Name;
                    if(button.Current.ProcessId==process.Id&&!button.Current.IsOffscreen&&
                       (name=="Quit anyway"||name=="\u4ecd\u8981\u9000\u51fa"||name=="\u4ecd\u8981\u7d50\u675f"||name=="Wait for Claude"||name=="\u7b49\u5f85 Claude"))return true;
                }
                return false;
            },()=>process.HasExited,()=>IsWindow(window.Handle)))return true;
        }
        return false;
    }
    static string ObserveQuit(Func<bool> exited,Func<bool> dialog,Action pause,int attempts) {
        for(int i=0;i<attempts;i++) {
            if(exited())return "exited";
            if(dialog())return "pending";
            if(i+1<attempts)pause();
        }
        return exited()?"exited":"submitted";
    }
    static void QuitResult(string state,string reason,int pid) {
        Console.WriteLine("{\"quitState\":"+JsonString(state)+",\"reason\":"+JsonString(reason)+",\"pid\":"+pid+"}");
    }
    static void QuitNative(Process process) {
        // Normal Quit must not restore windows, activate the App or open menus.
        long started=process.StartTime.ToUniversalTime().Ticks;
        if(HasNativeDialog(process)) {
            QuitResult("pending","Claude 보류 중인 기본 대화 상자가 있습니다. 컴퓨터에서 확인 또는 취소해 주세요.",process.Id);return;
        }
        CheckCancelled();
        var selected=SelectWindow(ReadWindows(process.Id),process.Id,GetForegroundWindow());
        if(selected.Handle==IntPtr.Zero)throw new Exception(QuitMenuUnavailable);
        var window=selected.Handle;
        CheckQuitNavigation(process,started,window);
        var submission=new QuitSubmission(process,started,window);string state=null;
        var timer=Stopwatch.StartNew();
        try {
            while(!submission.Started&&!submission.Finished&&timer.Elapsed.TotalSeconds<8) {
                CheckCancelled();
                if(process.HasExited) {state="exited";break;}
                if(HasNativeDialog(process)) {state="pending";break;}
                Thread.Sleep(100);
            }
        } catch {
            if(submission.CancelBeforeSubmit())throw;
            // Dispatch won the race; cancellation/error cannot establish failure.
            state="submitted";
        }
        if(state!=null)submission.CancelBeforeSubmit();
        else if(!submission.Started&&submission.CancelBeforeSubmit())
            throw submission.Error??new Exception("Claude 백그라운드 출구 입구 확인 시간이 초과되어 출구가 아직 제출되지 않았습니다. 컴퓨터를 정상적으로 종료해주세요.");
        // Never repeat Quit or accept a native busy-work confirmation.
        if(state==null)state=ObserveQuit(()=>process.HasExited,()=>HasNativeDialog(process),()=>Thread.Sleep(200),16);
        if(state=="submitted"&&!submission.Started)
            throw submission.Error??new Exception("Claude 종료 요청이 수신되지 않았습니다. 컴퓨터에서 정상적으로 종료해 주세요.");
        // An Invoke exception after dispatch may only mean its acknowledgement
        // was lost. The parent must keep observing the original process.
        bool uncertain=submission.Started&&submission.Finished&&submission.Error!=null;
        QuitResult(state,state=="exited"?"Claude 정상적으로 종료됨":state=="pending"?
            "Claude 컴퓨터 종료 확인을 기다리는 중입니다. 직접 확인하거나 취소하세요.":uncertain?
            "Claude 종료 명령 수신이 중단되었습니다. 저장 및 종료가 완료되기를 기다리는 중입니다.":"요청됨 Claude 정상적으로 종료하고 저장 및 종료가 완료되기를 기다립니다.",process.Id);
    }
    [StructLayout(LayoutKind.Sequential)] struct BackgroundRect {public int left,top,right,bottom;}
    [StructLayout(LayoutKind.Sequential)] struct BackgroundGui {public int size,flags;public IntPtr active,focus,capture,menuOwner,moveSize,caret;public BackgroundRect caretRect;}
    [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint thread,ref BackgroundGui value);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr window,EnumWindow callback,IntPtr data);
    static bool backgroundAction;
    static BackgroundOperation backgroundWork;
    sealed class BackgroundOperation {
        public volatile bool Started,Finished;public Exception Error;
        public volatile BackgroundResume Resume;
        readonly object gate=new object();bool cancelled;
        public void Check(){lock(gate){if(cancelled)throw new OperationCanceledException("취소 Claude 백그라운드 연결");}}
        public bool Cancel(){lock(gate){cancelled=true;return Started;}}
        public void ClaimDispatch(Action submitting){lock(gate){if(cancelled||Started||(cancelFile!=null&&File.Exists(cancelFile)))throw new OperationCanceledException("취소 Claude 백그라운드 연결");Started=true;submitting();}}
        public void Dispatch(int pid){ClaimDispatch(delegate{backgroundSubmission="uncertain";Stage("{\"connectPhase\":\"dispatching\",\"pid\":"+pid+"}");});}
        public void Start(Action action){var thread=new Thread(delegate(){try{action();}catch(Exception e){Error=e;}finally{Finished=true;}});thread.IsBackground=true;thread.SetApartmentState(ApartmentState.MTA);thread.Start();}
        public void Start(Process process,string text){Start(()=>ConnectBackground(process,text));}
    }
    static void RunBackgroundConnection(Process process,string text) {
        var operation=new BackgroundOperation();backgroundWork=operation;operation.Start(process,text);var timer=Stopwatch.StartNew();
        try {
            while(!operation.Finished&&timer.Elapsed.TotalSeconds<25){if(cancelFile!=null&&File.Exists(cancelFile)){operation.Cancel();break;}Thread.Sleep(50);}
            if(!operation.Finished){bool dispatched=operation.Cancel();backgroundSubmission=dispatched?"uncertain":"none";throw new Exception(dispatched?"Claude 연결 제출 결과를 확인해야 하며 연결 ​​수신을 기다리고 있습니다.":"Claude 백그라운드 초기화가 취소되었거나 시간 초과되어 연결 스크립트가 제출되지 않았습니다.");}
            if(operation.Error!=null)throw operation.Error;
        } finally {RestoreBackgroundMain(operation.Resume);}
        ConnectResult("submitted",backgroundSubmission,process.Id,"이미 다음 주소로 보냈습니다. Claude Console 연결 스크립트 제출, 연결 수신 대기 중");
    }
    static string VerifiedDevToolsTitle(string native,string accessible) {
        var first=DevToolsSource(native);var second=DevToolsSource(accessible);
        if(first!=null&&second!=null&&(AppDevToolsTitle(native)!=AppDevToolsTitle(accessible)||ShellDevToolsTitle(native)!=ShellDevToolsTitle(accessible)))
            throw new Exception("Claude 개발자 도구 소스가 일치하지 않고 백그라운드 연결이 중지되었습니다.");
        return first!=null?native:second!=null&&DevToolsTitle(native)?accessible:native;
    }
    static List<AppWindow> ReadBackgroundWindows(int pid) {
        var windows=ReadWindows(pid);
        foreach(var window in windows)if(window.Visible&&!window.Cloaked&&DevToolsTitle(window.Title)) {
            var root=AutomationElement.FromHandle(window.Handle);if(root.Current.ProcessId!=pid)throw new Exception("Claude 개발자 도구 프로세스가 변경되었습니다.");
            window.Title=VerifiedDevToolsTitle(window.Title,root.Current.Name);
        }
        return windows;
    }
    static string backgroundSubmission="none";
    static Uri DevToolsSource(string title) {
        foreach(string prefix in new[]{"DevTools - ","Developer Tools - ","\u5f00\u53d1\u8005\u5de5\u5177 - "})if(title.StartsWith(prefix,StringComparison.Ordinal)) {
            Uri source;return Uri.TryCreate(title.Substring(prefix.Length),UriKind.Absolute,out source)?source:null;
        }
        return null;
    }
    static bool AppDevToolsTitle(string title) {
        var source=DevToolsSource(title);
        return source!=null&&source.Scheme=="app"&&source.Host.Equals("localhost",StringComparison.OrdinalIgnoreCase)&&source.UserInfo.Length==0&&source.Port==-1;
    }
    static bool ShellDevToolsTitle(string title) {
        var source=DevToolsSource(title);
        return source!=null&&source.IsFile&&source.AbsolutePath.EndsWith("/main_window/index.html",StringComparison.OrdinalIgnoreCase);
    }
    static WindowSelection SelectBackgroundDevTools(IEnumerable<AppWindow> windows,int pid) {
        var selected=new WindowSelection();
        foreach(var window in windows)if(window.Pid==pid&&window.Handle!=IntPtr.Zero&&window.Visible&&!window.Cloaked&&AppDevToolsTitle(window.Title)) {
            selected.Count++;selected.Handle=window.Handle;
        }
        if(selected.Count!=1)selected.Handle=IntPtr.Zero;return selected;
    }
    static void CheckBackgroundProcess(Process process,long started) {
        if(backgroundWork!=null)backgroundWork.Check();
        if(cancelFile!=null&&File.Exists(cancelFile))throw new OperationCanceledException("취소 Claude 백그라운드 연결");
        if(process.HasExited||!Owned(process.Id)||process.StartTime.ToUniversalTime().Ticks!=started)
            throw new Exception("Claude 메인 프로세스가 변경되어 백그라운드 연결이 중지되었습니다.");
    }
    static void CheckBackgroundWindow(Process process,long started,IntPtr window) {
        CheckBackgroundProcess(process,started);uint pid;GetWindowThreadProcessId(window,out pid);
        if(!IsWindow(window)||pid!=process.Id)throw new Exception("Claude 대상 창이 변경되었으며 백그라운드 연결이 중지되었습니다.");
    }
    static AutomationElement BackgroundMenuControl(AutomationElement root,ControlType type,int pid,params string[] names) {
        var items=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,type));
        AutomationElement match=null;
        foreach(AutomationElement item in items) {
            bool name=false;foreach(string expected in names)if(item.Current.Name==expected){name=true;break;}
            if(!name||item.Current.ProcessId!=pid||!AvailableMenuControl(item))continue;
            if(match!=null)throw new Exception("Claude 개발자 메뉴가 고유하지 않고 백그라운드 연결이 중지되었습니다.");match=item;
        }
        return match;
    }
    static void BackgroundMenuAction(AutomationElement item,Action check,bool expand) {
        check();object pattern;
        if(item==null||!AvailableMenuControl(item))throw new Exception("먼저 부탁드립니다 Claude 개발자 모드를 활성화하고 연결 초기화를 다시 시도하세요.");
        if(expand&&item.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out pattern))((ExpandCollapsePattern)pattern).Expand();
        else if(item.TryGetCurrentPattern(InvokePattern.Pattern,out pattern))((InvokePattern)pattern).Invoke();
        else throw new Exception("Claude 개발자 메뉴는 백그라운드 작업을 지원하지 않습니다. 컴퓨터에서 개발자 도구를 열고 다시 시도해 보세요.");
    }
    static void OpenBackgroundDevTools(Process process,long started) {
        CheckBackgroundProcess(process,started);
        var before=ReadBackgroundWindows(process.Id);var prior=new HashSet<IntPtr>();foreach(var window in before)prior.Add(window.Handle);
        var selected=SelectWindow(before,process.Id,IntPtr.Zero);
        if(selected.Count!=1||selected.Handle==IntPtr.Zero)throw new Exception("유일한 것을 찾을 수 없습니다 Claude 메인 창, 컴퓨터에서 열어주세요 Claude 나중에 다시 시도해 보세요");
        IntPtr windowHandle=selected.Handle,foreground=GetForegroundWindow();Action check=()=>CheckBackgroundWindow(process,started,windowHandle);
        var root=AutomationElement.FromHandle(windowHandle);
        try {
            var developer=BackgroundMenuControl(root,ControlType.MenuItem,process.Id,"Developer","\u5f00\u53d1\u8005","\u958b\u767c\u8005");
            if(developer==null) {
                // Native resume publishes visibility before its renderer toolbar.
                var menuTimer=Stopwatch.StartNew();
                var menu=WaitBackgroundControl(()=>BackgroundMenuControl(root,ControlType.Button,process.Id,"Menu","\u83dc\u5355","\u9078\u55ae"),
                    check,()=>Thread.Sleep(100),()=>menuTimer.Elapsed.TotalSeconds>=4,"Claude 메인 창 메뉴가 아직 준비되지 않았습니다. 나중에 다시 초기화해 보세요.");
                BackgroundMenuAction(menu,check,false);
                developer=WaitMenuEntry(()=>BackgroundMenuControl(root,ControlType.MenuItem,process.Id,"Developer","\u5f00\u53d1\u8005","\u958b\u767c\u8005"),check,()=>Thread.Sleep(100));
            }
            BackgroundMenuAction(developer,check,true);
            var show=WaitMenuEntry(()=>BackgroundMenuControl(root,ControlType.MenuItem,process.Id,"Show All Dev Tools","\u663e\u793a\u6240\u6709\u5f00\u53d1\u8005\u5de5\u5177","\u986f\u793a\u6240\u6709\u958b\u767c\u8005\u5de5\u5177"),check,()=>Thread.Sleep(100));
            BackgroundMenuAction(show,check,false);
            for(int i=0;i<40;i++) {check();if(SelectBackgroundDevTools(ReadBackgroundWindows(process.Id),process.Id).Count!=0)break;Thread.Sleep(100);}
            // Close only the shell tool created by this invocation. Never close
            // pre-existing user DevTools or a Claude conversation window.
            foreach(var created in ReadBackgroundWindows(process.Id))if(!prior.Contains(created.Handle)&&ShellDevToolsTitle(created.Title)) {
                CheckBackgroundWindow(process,started,created.Handle);object pattern;
                var tool=AutomationElement.FromHandle(created.Handle);
                if(!tool.TryGetCurrentPattern(WindowPattern.Pattern,out pattern))throw new Exception("Claude 새 셸 개발자 도구를 닫을 수 없습니다. 컴퓨터에서 처리한 후 다시 시도해 주세요.");
                ((WindowPattern)pattern).Close();
                for(int i=0;i<30&&IsWindow(created.Handle);i++){CheckBackgroundProcess(process,started);Thread.Sleep(100);}
                if(IsWindow(created.Handle))throw new Exception("Claude 새 셸 개발자 도구가 닫히지 않았습니다. 나중에 다시 시도해 주세요.");
            }
        } finally {Stage("{\"connectPhase\":\"tools-navigation\",\"pid\":"+process.Id+",\"foregroundChanged\":"+(foreground!=GetForegroundWindow()?"true":"false")+"}");}
    }
    static IntPtr BackgroundRenderer(Process process,long started,IntPtr tools) {
        CheckBackgroundWindow(process,started,tools);var handles=new List<IntPtr>();
        EnumChildWindows(tools,delegate(IntPtr window,IntPtr data){uint pid;GetWindowThreadProcessId(window,out pid);var name=new StringBuilder(256);GetClassName(window,name,name.Capacity);if(pid==process.Id&&name.ToString()=="Chrome_RenderWidgetHostHWND")handles.Add(window);return true;},IntPtr.Zero);
        if(handles.Count!=1)throw new Exception("Claude 개발자 도구 렌더링 창이 고유하지 않고 백그라운드 입력이 중지되었습니다.");return handles[0];
    }
    static AutomationElement BackgroundPrompt(Process process,long started,IntPtr tools,IntPtr renderer,bool requireFocus) {
        CheckBackgroundWindow(process,started,tools);CheckBackgroundWindow(process,started,renderer);
        var selected=SelectBackgroundDevTools(ReadBackgroundWindows(process.Id),process.Id);
        if(selected.Count!=1||selected.Handle!=tools||BackgroundRenderer(process,started,tools)!=renderer)
            throw new Exception("Claude 개발자 도구 대상이 변경되고 백그라운드 입력이 중지되었습니다.");
        var root=AutomationElement.FromHandle(tools);var tabs=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.TabItem));
        int consoles=0;bool consoleSelected=false;
        foreach(AutomationElement tab in tabs)if(tab.Current.ProcessId==process.Id&&!tab.Current.IsOffscreen&&(tab.Current.AutomationId=="tab-console"||tab.Current.Name=="Console"||tab.Current.Name=="\u63a7\u5236\u53f0")) {
            consoles++;object pattern;consoleSelected=tab.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern)&&((SelectionItemPattern)pattern).Current.IsSelected;
        }
        if(consoles!=1||!consoleSelected)throw new Exception("Claude 개발자 도구가 멈추지 않습니다 Console，컴퓨터에서 선택해주세요 Console 나중에 다시 시도해 보세요");
        var elements=root.FindAll(TreeScope.Descendants,new OrCondition(new PropertyCondition(AutomationElement.AutomationIdProperty,"console-prompt"),new PropertyCondition(AutomationElement.NameProperty,"Console prompt"),new PropertyCondition(AutomationElement.NameProperty,"\u63a7\u5236\u53f0\u63d0\u793a"),new PropertyCondition(AutomationElement.NameProperty,"\u63a7\u5236\u53f0\u63d0\u793a\u7b26")));
        AutomationElement prompt=null;int count=0;
        foreach(AutomationElement element in elements)if(IsPrompt(element)&&element.Current.ProcessId==process.Id&&!element.Current.IsOffscreen&&element.Current.IsEnabled){prompt=element;count++;}
        if(count!=1)throw new Exception("Claude Console 입력 상자가 고유하지 않으며 백그라운드 입력이 중지되었습니다.");
        if(requireFocus) {
            uint pid;uint thread=GetWindowThreadProcessId(renderer,out pid);var gui=new BackgroundGui();gui.size=Marshal.SizeOf(gui);
            if(!prompt.Current.HasKeyboardFocus||!GetGUIThreadInfo(thread,ref gui)||gui.focus!=renderer)
                throw new Exception("Claude Console 내부 포커스가 변경되었으며 백그라운드 입력이 제출되지 않았습니다.");
        }
        return prompt;
    }
    static void ConnectResult(string state,string submission,int pid,string reason) {
        Stage("{\"setupState\":"+JsonString(state)+",\"submission\":"+JsonString(submission)+",\"pid\":"+pid+",\"reason\":"+JsonString(reason)+"}");
    }
    sealed class BackgroundConsoleSelection {public AutomationElement Tab;public SelectionItemPattern Pattern;}
    static T WaitBackgroundControl<T>(Func<T> find,Action check,Action pause,Func<bool> expired,string reason) where T:class {
        while(true) {
            check();T value=null;try{value=find();}catch(ElementNotAvailableException){}
            if(value!=null)return value;if(expired())throw new Exception(reason);pause();
        }
    }
    static void SelectReadyBackgroundConsole<T>(Func<T> find,Action<T> select,Func<T,bool> ready,Action check,Action pause,Func<bool> expired) where T:class {
        var selection=WaitBackgroundControl(find,check,pause,expired,"Claude Console 라벨이 아직 준비되지 않았습니다. 나중에 다시 초기화해 보세요.");
        check();select(selection);
        // Selection is attempted once. If the user changes tabs while the
        // prompt is appearing, wait/fail without overriding their selection.
        WaitBackgroundControl(()=>ready(selection)?selection:null,check,pause,expired,"Claude Console 입력 상자가 아직 준비되지 않았습니다. 나중에 다시 초기화를 시도하세요.");
        check();
    }
    static void SelectBackgroundConsole(Process process,long started,IntPtr tools) {
        var timer=Stopwatch.StartNew();
        Action check=delegate {
            CheckBackgroundWindow(process,started,tools);var selected=SelectBackgroundDevTools(ReadBackgroundWindows(process.Id),process.Id);
            if(selected.Count!=1||selected.Handle!=tools)throw new Exception("Claude 개발자 도구 대상이 변경되고 백그라운드 연결이 중지되었습니다.");
        };
        SelectReadyBackgroundConsole(delegate {
            var root=AutomationElement.FromHandle(tools);var tab=BackgroundMenuControl(root,ControlType.TabItem,process.Id,"Console","\u63a7\u5236\u53f0");object pattern;
            return tab!=null&&tab.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern)?new BackgroundConsoleSelection {Tab=tab,Pattern=(SelectionItemPattern)pattern}:null;
        },selection=>selection.Pattern.Select(),delegate(BackgroundConsoleSelection selection) {
            if(!selection.Pattern.Current.IsSelected||!AvailableMenuControl(selection.Tab))return false;
            var root=AutomationElement.FromHandle(tools);var items=root.FindAll(TreeScope.Descendants,new OrCondition(new PropertyCondition(AutomationElement.AutomationIdProperty,"console-prompt"),new PropertyCondition(AutomationElement.NameProperty,"Console prompt"),new PropertyCondition(AutomationElement.NameProperty,"\u63a7\u5236\u53f0\u63d0\u793a"),new PropertyCondition(AutomationElement.NameProperty,"\u63a7\u5236\u53f0\u63d0\u793a\u7b26")));
            int count=0;foreach(AutomationElement item in items)if(IsPrompt(item)&&item.Current.ProcessId==process.Id&&!item.Current.IsOffscreen&&item.Current.IsEnabled)count++;
            if(count>1)throw new Exception("Claude Console 입력 상자가 고유하지 않으며 백그라운드 연결이 중지되었습니다.");return count==1;
        },check,()=>Thread.Sleep(100),()=>timer.Elapsed.TotalSeconds>=4);
    }
    static void SubmitBackgroundVerifiedConsole(string text,Func<string> readDraft,Action<string> replace,Func<string> readDocument,
        Action check,Action pause,Func<bool> expired,Action reset,Func<bool> retryEmpty,Action submit) {
        for(int attempt=0;attempt<2;attempt++) {
            check();reset();check();if(!String.IsNullOrWhiteSpace(readDraft()))throw new Exception("Console 예약된 파일에 제출되지 않은 콘텐츠가 있습니다. 처리한 후 다시 연결해 보세요.");
            bool enteredSubmit=false;
            try {SubmitVerifiedConsole(text,readDraft,replace,readDocument,check,pause,expired,delegate{enteredSubmit=true;submit();},false);return;}
            catch {
                if(attempt!=0||enteredSubmit)throw;
                check();if(!String.IsNullOrWhiteSpace(readDraft())||!retryEmpty())throw;
                pause();check();if(!String.IsNullOrWhiteSpace(readDraft())||!retryEmpty())throw;
            }
        }
    }
    static bool BackgroundMainShape(AppWindow window,int pid) {
        return window.Pid==pid&&window.Handle!=IntPtr.Zero&&!window.Cloaked&&!window.ToolWindow&&window.Owner==IntPtr.Zero&&
            window.ClassName=="Chrome_WidgetWin_1"&&(window.Title=="Claude"||window.Title.EndsWith(" — Claude",StringComparison.Ordinal));
    }
    static WindowSelection SelectHiddenBackgroundMain(IEnumerable<AppWindow> windows,int pid) {
        var selected=new WindowSelection();
        foreach(var window in windows)if(!window.Visible&&BackgroundMainShape(window,pid)) {
            selected.Count++;selected.Handle=window.Handle;
        }
        if(selected.Count!=1)selected.Handle=IntPtr.Zero;return selected;
    }
    sealed class BackgroundResume {
        public Process Process;public long Started;public IntPtr Main;public uint InputTick;public bool InputKnown;
    }
    static bool ReadLastInput(out uint tick) {
        var input=new LastInput {size=(uint)Marshal.SizeOf(typeof(LastInput))};bool known=GetLastInputInfo(ref input);tick=input.tick;return known;
    }
    static bool CanRestoreBackgroundMain(IEnumerable<AppWindow> windows,int pid,IntPtr main,IntPtr foreground,bool unchangedInput,bool enabled) {
        if(!unchangedInput||!enabled||main==foreground)return false;
        bool found=false;
        foreach(var window in windows) {
            if(window.Handle==main) {if(!BackgroundMainShape(window,pid)||!window.Visible)return false;found=true;continue;}
            // Unknown owned windows and native dialogs can contain user work.
            // Do not hide their owner or infer modality through a COM provider.
            if(window.Pid==pid&&window.Visible&&!window.Cloaked&&(window.Owner!=IntPtr.Zero||window.ClassName=="#32770")&&
               !AppDevToolsTitle(window.Title)&&!ShellDevToolsTitle(window.Title))return false;
        }
        return found;
    }
    static void RestoreBackgroundMain(BackgroundResume resume) {
        if(resume==null)return;
        bool restored=false;
        try {
            var process=resume.Process;uint tick;
            // Native metadata only, including after cancellation/provider timeout.
            // Never wait for UIA, activate a window, or touch submission evidence.
            if(process.HasExited||!Owned(process.Id)||process.StartTime.ToUniversalTime().Ticks!=resume.Started)return;
            var windows=ReadWindows(process.Id);
            if(!CanRestoreBackgroundMain(windows,process.Id,resume.Main,GetForegroundWindow(),
                resume.InputKnown&&ReadLastInput(out tick)&&tick==resume.InputTick,IsWindowEnabled(resume.Main)))return;
            if(process.HasExited||!Owned(process.Id)||process.StartTime.ToUniversalTime().Ticks!=resume.Started)return;
            if(!CanRestoreBackgroundMain(ReadWindows(process.Id),process.Id,resume.Main,GetForegroundWindow(),
                ReadLastInput(out tick)&&tick==resume.InputTick,IsWindowEnabled(resume.Main)))return;
            ShowWindow(resume.Main,0);restored=!IsWindowVisible(resume.Main);
        } catch(Exception) {} // Preserving a window must not downgrade a submission.
        finally {Stage("{\"connectPhase\":\"main-window-restore\",\"restored\":"+(restored?"true":"false")+"}");}
    }
    static void ReopenBackgroundMain(Process process,long started,IntPtr main) {
        CheckBackgroundWindow(process,started,main);
        string applicationId=ApplicationId(process.Id);
        var launch=NativeLaunch(executable,applicationId,Environment.GetFolderPath(Environment.SpecialFolder.Windows));
        launch.CreateNoWindow=true;launch.WindowStyle=ProcessWindowStyle.Hidden;
        launch.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");launch.EnvironmentVariables.Remove("CLAUDE_DEV_TOOLS");
        CheckBackgroundWindow(process,started,main);
        var resume=new BackgroundResume {Process=process,Started=started,Main=main};
        resume.InputKnown=ReadLastInput(out resume.InputTick);
        var hidden=SelectHiddenBackgroundMain(ReadWindows(process.Id),process.Id);
        if(hidden.Count!=1||hidden.Handle!=main)throw new Exception("Claude 메인 창 숨기기가 변경되었으며 백그라운드 복구가 중지되었습니다.");
        CheckBackgroundWindow(process,started,main);backgroundWork.Resume=resume;
        IntPtr foreground=GetForegroundWindow();
        try {
            // Let the exact app's native second-instance handler release its
            // deferred renderer. Raw ShowWindow does not initialize that UI.
            // This normal launch can activate Claude; it sends no global input.
            using(var launched=Process.Start(launch)) {}
            CheckBackgroundWindow(process,started,main);
        } finally {Stage("{\"connectPhase\":\"native-reopen\",\"pid\":"+process.Id+",\"foregroundChanged\":"+(foreground!=GetForegroundWindow()?"true":"false")+"}");}
    }
    static List<AppWindow> WaitBackgroundReady(int pid,Func<List<AppWindow>> read,Action check,Action pause,Func<bool> expired,
        Action<IntPtr> reopen=null,Func<bool> reopenDue=null) {
        IntPtr resumed=IntPtr.Zero;
        while(true) {
            check();var windows=read();check();
            if(resumed!=IntPtr.Zero&&!windows.Exists(window=>window.Pid==pid&&window.Handle==resumed))
                throw new Exception("Claude 메인창이 바뀌고 백그라운드 연결이 멈췄어요");
            if(SelectBackgroundDevTools(windows,pid).Count>0||SelectWindow(windows,pid,IntPtr.Zero).Count>0)return windows;
            if(expired())throw new Exception("Claude 기본 프로세스가 시작되었습니다. 개발자 도구 또는 기본 창이 아직 준비되지 않았습니다. 나중에 다시 초기화해 보세요.");
            if(resumed==IntPtr.Zero&&reopen!=null&&reopenDue()) {
                // Re-read at the boundary: a cold launch's tools can appear
                // just as the grace period ends. They always take priority.
                check();windows=read();check();
                if(SelectBackgroundDevTools(windows,pid).Count>0||SelectWindow(windows,pid,IntPtr.Zero).Count>0)return windows;
                var hidden=SelectHiddenBackgroundMain(windows,pid);
                if(hidden.Count!=1||hidden.Handle==IntPtr.Zero)throw new Exception("숨겨진 고유한 항목을 찾았습니다. Claude 메인 창, 컴퓨터에서 열어주세요 Claude 나중에 다시 시도해 보세요");
                check();if(expired())throw new Exception("Claude 백그라운드 초기화 대기 시간이 초과되어 기본 창이 복원되지 않았습니다.");
                resumed=hidden.Handle;reopen(resumed);check();
            }
            pause();
        }
    }
    static double BackgroundColdGrace(TimeSpan age) {return age.TotalSeconds>=30?0:8;}
    static void ConnectBackground(Process process,string text) {
        long started=process.StartTime.ToUniversalTime().Ticks;CheckBackgroundProcess(process,started);
        // Give native --startup's automatic detached tools first priority.
        // An existing hidden instance needs one native second-instance resume
        // to release its deferred main renderer before targeted menu navigation.
        double grace=BackgroundColdGrace(DateTime.UtcNow-new DateTime(started,DateTimeKind.Utc));
        var readyTimer=Stopwatch.StartNew();
        var ready=WaitBackgroundReady(process.Id,()=>ReadBackgroundWindows(process.Id),()=>CheckBackgroundProcess(process,started),
            ()=>Thread.Sleep(100),()=>readyTimer.Elapsed.TotalSeconds>=grace+4,
            main=>ReopenBackgroundMain(process,started,main),()=>readyTimer.Elapsed.TotalSeconds>=grace);
        var tools=SelectBackgroundDevTools(ready,process.Id);
        bool opened=tools.Count==0;
        if(opened){OpenBackgroundDevTools(process,started);tools=SelectBackgroundDevTools(ReadBackgroundWindows(process.Id),process.Id);}
        if(tools.Count!=1||tools.Handle==IntPtr.Zero)throw new Exception("유일한 것을 찾을 수 없습니다 app://localhost Claude 개발자 도구를 사용하여 컴퓨터를 확인한 후 다시 시도해 주세요.");
        IntPtr window=tools.Handle;SelectBackgroundConsole(process,started,window);IntPtr renderer=BackgroundRenderer(process,started,window);
        AutomationElement prompt=null;ValuePattern value=null;TextPattern document=null;var timer=new Stopwatch();
        Action acquire=delegate {
            prompt=BackgroundPrompt(process,started,window,renderer,false);object valueObject,textObject;
            if(!prompt.TryGetCurrentPattern(ValuePattern.Pattern,out valueObject)||((ValuePattern)valueObject).Current.IsReadOnly||!prompt.TryGetCurrentPattern(TextPattern.Pattern,out textObject))
                throw new Exception("Claude Console 배경 쓰기 확인은 지원되지 않습니다. 컴퓨터에서 연결을 수동으로 초기화하십시오.");
            value=(ValuePattern)valueObject;document=(TextPattern)textObject;timer.Restart();
        };
        Action check=()=>BackgroundPrompt(process,started,window,renderer,false);
        SubmitBackgroundVerifiedConsole(text,()=>Contents(prompt),textValue=>value.SetValue(textValue),()=>document.DocumentRange.GetText(-1).TrimEnd('\r','\n'),check,()=>Thread.Sleep(50),()=>timer.Elapsed.TotalSeconds>=6,acquire,
            delegate {if(backgroundWork!=null&&backgroundWork.Started)return false;var current=BackgroundPrompt(process,started,window,renderer,true);return Automation.Compare(prompt,current);},delegate {
            var current=BackgroundPrompt(process,started,window,renderer,true);
            if(!Automation.Compare(prompt,current)||Contents(current)!=text)throw new Exception("Claude Console 콘텐츠가 변경되었으며 백그라운드 입력이 제출되지 않았습니다.");
            // This flushed marker precedes the only targeted input operation.
            // A lost helper response from this point is an uncertain submit.
            backgroundWork.Dispatch(process.Id);
            if(!PostMessage(renderer,0x0100,new IntPtr(13),new IntPtr(0x001c0001))){backgroundSubmission="none";throw new Exception("Windows 받지 못함 Claude Console 제출하세요. 권한을 확인한 후 다시 시도해 주세요.");}
            if(!PostMessage(renderer,0x0101,new IntPtr(13),new IntPtr(unchecked((int)0xc01c0001))))throw new Exception("Claude Console 제출 영수증이 불완전합니다. 연결 상태를 확인할 때까지 기다려 주세요.");
            backgroundSubmission="submitted";
        });
    }

    static bool backgroundCleanupAction;
    static void RunBackgroundCleanup(Process process) {
        var operation=new BackgroundOperation();backgroundWork=operation;
        operation.Start(()=>CloseBackgroundDevTools(process,operation));var timer=Stopwatch.StartNew();
        while(!operation.Finished&&timer.Elapsed.TotalSeconds<8) {
            if(cancelFile!=null&&File.Exists(cancelFile)){operation.Cancel();break;}
            Thread.Sleep(50);
        }
        if(!operation.Finished) {
            bool dispatched=operation.Cancel();
            throw new Exception(dispatched?"Claude 연결이 가능하고 개발자 도구가 닫혀 있으며 결과 확인이 보류 중입니다.":"Claude 연결이 가능합니다. 개발자 도구 정리가 취소되었거나 시간이 초과되었습니다. 나중에 다시 시도해 주세요.");
        }
        if(operation.Error!=null)throw operation.Error;
        Stage("Background DevTools closed");
    }
    static void CloseVerifiedBackgroundConsole(Func<string> readDraft,Action check,Action close) {
        check();if(!String.IsNullOrWhiteSpace(readDraft()))throw new Exception("Claude 연결 가능，Console 커밋되지 않은 콘텐츠가 있으며 개발자 도구가 예약되어 있습니다.");
        check();if(!String.IsNullOrWhiteSpace(readDraft()))throw new Exception("Claude 연결 가능，Console 콘텐츠가 변경되었으며 개발자 도구는 유지되었습니다.");
        close();
    }
    static void CloseBackgroundDevTools(Process process,BackgroundOperation operation) {
        long started=process.StartTime.ToUniversalTime().Ticks;CheckBackgroundProcess(process,started);
        var selected=SelectBackgroundDevTools(ReadBackgroundWindows(process.Id),process.Id);
        if(selected.Count==0)return;
        if(selected.Count!=1||selected.Handle==IntPtr.Zero)throw new Exception("Claude 연결 가능, 콘텐츠 개발자 도구가 고유하지 않음, 창 예약됨");
        IntPtr tools=selected.Handle,renderer=BackgroundRenderer(process,started,tools);
        var prompt=BackgroundPrompt(process,started,tools,renderer,false);
        Action check=delegate {
            var current=BackgroundPrompt(process,started,tools,renderer,false);
            if(!Automation.Compare(prompt,current))throw new Exception("Claude 연결 가능，Console 입력 상자가 변경되었으며 개발자 도구는 그대로 유지되었습니다.");
        };
        CloseVerifiedBackgroundConsole(()=>Contents(prompt),check,delegate {
            // Never close the main app or unrelated/pre-existing foreign tools.
            // This exact source window, process and empty draft were rechecked.
            check();if(!String.IsNullOrWhiteSpace(Contents(prompt)))throw new Exception("Claude 연결 가능，Console 콘텐츠가 변경되었으며 개발자 도구는 유지되었습니다.");
            operation.ClaimDispatch(delegate {
                if(!PostMessage(tools,0x0010,IntPtr.Zero,IntPtr.Zero))throw new Exception("Claude 연결 가능，Windows 개발자 도구 종료 요청이 수신되지 않았습니다.");
            });
        });
        var timer=Stopwatch.StartNew();
        while(IsWindow(tools)&&timer.Elapsed.TotalSeconds<3){CheckBackgroundProcess(process,started);Thread.Sleep(100);}
        if(IsWindow(tools))throw new Exception("Claude 연결이 가능합니다. 개발자 도구가 닫히지 않았습니다. 나중에 다시 시도해 주세요.");
    }

    static string ReadContents(string text,string value) {
        // Chromium contenteditable exposes an empty ValuePattern even when its
        // TextPattern contains the entire CodeMirror document.
        if(!String.IsNullOrEmpty(text)) return text;
        if(value!=null) return value;
        if(text!=null) return text;
        throw new Exception("확인할 수 없습니다 Console 콘텐츠, 입력이 중지되었습니다.");
    }
    static string Contents(AutomationElement prompt) {
        object pattern;string text=null,value=null;
        if(prompt.TryGetCurrentPattern(TextPattern.Pattern,out pattern)) text=((TextPattern)pattern).DocumentRange.GetText(-1);
        if(!String.IsNullOrEmpty(text))return text.TrimEnd('\r','\n');
        if(prompt.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)) value=((ValuePattern)pattern).Current.Value;
        return ReadContents(text,value).TrimEnd('\r','\n');
    }
    static bool ConsoleSourceShape(string text,bool background) {
        const string marker="/* codex bridge connector */";
        if(text==null||text.Length>300000||text.Contains("\r")||
           !text.StartsWith(marker,StringComparison.Ordinal))return false;
        if(!text.Contains("\n"))return true;
        if(background)return false;
        var lines=text.Split('\n');
        if(lines.Length<2||lines.Length>16)return false;
        for(int i=0;i<lines.Length;i++) {
            if(lines[i].Length==0||lines[i].Length>3500)return false;
            if(i<lines.Length-1&&!lines[i].EndsWith(";",StringComparison.Ordinal)&&
               !lines[i].EndsWith("{",StringComparison.Ordinal))return false;
        }
        return true;
    }
    static void SubmitVerifiedConsole(string text,Func<string> readDraft,Action<string> replace,
        Func<string> readDocument,Action check,Action pause,Func<bool> expired,Action submit,bool allowConnectorDraft=true) {
        check();
        string pending=readDraft().Trim('\r','\n',' ','\t','\u200b','\ufeff');
        if(!String.IsNullOrWhiteSpace(pending)&&(!allowConnectorDraft||!pending.StartsWith("/* codex bridge connector */")))
            throw new Exception("Console 예약된 파일에 제출되지 않은 콘텐츠가 있습니다. 처리한 후 다시 연결해 보세요.");
        check();replace(text);
        // Chromium applies accessibility edits asynchronously. ValuePattern may
        // echo the new value before CodeMirror's actual document has changed.
        while(true) {
            check();
            string observed=readDocument();
            if(observed==text)break;
            if(expired())throw new Exception("Console 스크립트가 완전히 작성되지 않았으며 실행되지도 않았습니다. 수동 초기화를 통해 다시 시도해주세요.");
            pause();
        }
        check();submit();
    }
    static void SubmitConsoleDirect(Action check,Action<INPUT[]> send) {
        check();send(new[]{Key(13,false),Key(13,true)});
    }
    static int UniqueSegmentStart(string expected,string observed) {
        if(String.IsNullOrEmpty(observed)||observed.Length<32)return -1;
        int start=expected.IndexOf(observed,StringComparison.Ordinal);
        return start>=0&&expected.LastIndexOf(observed,StringComparison.Ordinal)==start?start:-1;
    }
    static bool VirtualizedConsoleGap(string expected,string observed) {
        for(int split=observed.IndexOf('\n');split>=0;split=observed.IndexOf('\n',split+1)) {
            string before=observed.Substring(0,split),after=observed.Substring(split+1);
            int first=UniqueSegmentStart(expected,before),second=UniqueSegmentStart(expected,after);
            if(first>=0&&second>first+before.Length)return true;
        }
        return false;
    }
    static bool CompatibleConsoleView(string expected,string observed) {
        return UniqueSegmentStart(expected,observed)>=0||
            !String.IsNullOrEmpty(observed)&&VirtualizedConsoleGap(expected,observed);
    }
    static void SubmitForegroundConsole(string text,Func<string> readDraft,Action<string> replace,
        Func<string> readVisible,Action check,Action pause,Func<bool> settled,Func<bool> expired,Action<INPUT[]> submit) {
        check();
        string pending=readDraft().Trim('\r','\n',' ','\t','\u200b','\ufeff');
        if(!String.IsNullOrWhiteSpace(pending))
            throw new Exception("Console 예약된 파일에 제출되지 않은 콘텐츠가 있습니다. 처리한 후 다시 연결해 보세요.");
        check();replace(text);
        // A visible UIA slice is a compatibility check, not proof that the
        // complete script executed. Only the signed bridge receipt proves that.
        while(true) {
            check();
            string visible=readVisible();
            if(visible==text||CompatibleConsoleView(text,visible)&&settled())break;
            if(expired())throw new Exception("Console 이 스크립트는 표시되지 않으며 제출되지도 않았습니다. 컴퓨터를 확인하신 후 다시 시도해 주세요.");
            pause();
        }
        SubmitConsoleDirect(check,submit);
    }
    static void WriteConsoleOnce(AutomationElement prompt,string text) {
        CheckPrompt(prompt);
        object valueObject,textObject;
        if(!prompt.TryGetCurrentPattern(ValuePattern.Pattern,out valueObject)||
            ((ValuePattern)valueObject).Current.IsReadOnly||
            !prompt.TryGetCurrentPattern(TextPattern.Pattern,out textObject))
            throw new Exception("현재 Claude Console 일회성 쓰기는 지원되지 않습니다. 컴퓨터에서 연결을 수동으로 초기화하십시오.");
        var value=(ValuePattern)valueObject;var document=(TextPattern)textObject;
        var timer=new Stopwatch();
        SubmitForegroundConsole(text,()=>Contents(prompt),valueText=>{value.SetValue(valueText);timer.Restart();},
            ()=>document.DocumentRange.GetText(-1).TrimEnd('\r','\n'),()=>CheckPrompt(prompt),
            ()=>Thread.Sleep(50),()=>timer.ElapsedMilliseconds>=250,()=>timer.ElapsedMilliseconds>=1200,keys=>{
                Stage("스크립트가 작성되었습니다 Console，제출 및 연결 수신 대기 중");
                Send(keys);
            });
    }
    static void CheckWindowSelection() {
        var owned=new AppWindow {Handle=new IntPtr(11),Owner=new IntPtr(99),Pid=7,Visible=true,Title="Claude"};
        var other=new AppWindow {Handle=new IntPtr(12),Pid=7,Visible=true,Title="Claude conversation"};
        var excluded=new [] {
            new AppWindow {Handle=new IntPtr(13),Pid=8,Visible=true,Title="Claude"},
            new AppWindow {Handle=new IntPtr(14),Pid=7,Visible=false,Title="Claude"},
            new AppWindow {Handle=new IntPtr(15),Pid=7,Visible=true,Title="DevTools - app://localhost"},
            new AppWindow {Handle=new IntPtr(16),Pid=7,Visible=true,ToolWindow=true,Title="Claude"},
            new AppWindow {Handle=new IntPtr(17),Pid=7,Visible=true,Cloaked=true,Title="Claude"}};
        if(SelectWindow(new[]{owned},7,IntPtr.Zero).Handle!=owned.Handle||SelectWindow(excluded,7,IntPtr.Zero).Count!=0)
            throw new Exception("Claude 창 범위 자체 테스트에 실패했습니다.");
        var ambiguous=SelectWindow(new[]{owned,other},7,IntPtr.Zero);
        if(ambiguous.Count!=2||ambiguous.Handle!=IntPtr.Zero||SelectWindow(new[]{owned,other},7,other.Handle).Handle!=other.Handle)
            throw new Exception("Claude 다중 창 선택 자체 테스트에 실패했습니다.");
        int scans=0,restores=0,pauses=0;
        var result=WaitWindow(()=>++scans<3?new WindowSelection():new WindowSelection {Handle=owned.Handle,Count=1},
            ()=>restores++,()=>{},()=>pauses++,4);
        if(result!=owned.Handle||restores!=1||pauses!=2)throw new Exception("Claude 트레이 복구 자체 테스트 실패");
        restores=0;int checks=0;bool cancelled=false;
        try {WaitWindow(()=>new WindowSelection(),()=>restores++,()=>{if(++checks==3)throw new OperationCanceledException();},()=>{},4);}
        catch(OperationCanceledException){cancelled=true;}
        if(!cancelled||restores!=1)throw new Exception("Claude 자체 테스트 취소 대기 중 실패");
        restores=0;cancelled=false;
        try {WaitWindow(()=>new WindowSelection(),()=>restores++,()=>{throw new OperationCanceledException();},()=>{},4);}
        catch(OperationCanceledException){cancelled=true;}
        if(!cancelled||restores!=0)throw new Exception("Claude 시작하기 전에 자체 테스트 취소에 실패했습니다.");
        restores=0;bool rejected=false;
        try {WaitWindow(()=>ambiguous,()=>restores++,()=>{},()=>{},4);}
        catch(Exception){rejected=true;}
        if(!rejected||restores!=0)throw new Exception("Claude 모호성 창 복구 자체 테스트 실패");
    }
    static void CheckMenuNavigation() {
        var actions=new List<string>();int stage=0;
        Func<string,string> modern=role=>
            (role=="menu"&&stage==0||role=="help"&&stage==1||role=="troubleshooting"&&stage==2||role=="enable"&&stage==3)?role:null;
        Action<string> invoke=item=>{actions.Add("invoke:"+item);stage++;};
        Action<string> expand=item=>{actions.Add("expand:"+item);stage++;};
        EnableDeveloperMenu(modern,invoke,expand,()=>{},()=>{});
        if(String.Join(",",actions.ToArray())!="invoke:menu,expand:help,expand:troubleshooting,invoke:enable")
            throw new Exception("Claude 맞춤 메뉴 탐색 자체 테스트에 실패했습니다.");
        actions.Clear();stage=0;
        EnableDeveloperMenu(role=>role=="help"||role=="enable"&&stage==1?role:null,invoke,expand,()=>{},()=>{});
        if(String.Join(",",actions.ToArray())!="expand:help,invoke:enable")throw new Exception("Claude 클래식 메뉴 탐색 자체 테스트에 실패했습니다.");
        actions.Clear();stage=0;bool cancelled=false;
        try {EnableDeveloperMenu(modern,invoke,expand,()=>{if(stage==3)throw new OperationCanceledException();},()=>{});}
        catch(OperationCanceledException){cancelled=true;}
        if(!cancelled||actions.Contains("invoke:enable"))throw new Exception("Claude 메뉴 취소 셀프 테스트 실패");
        actions.Clear();stage=0;bool unavailable=false;
        try {EnableDeveloperMenu(role=>role=="help"?role:null,invoke,expand,()=>{},()=>{});}
        catch(Exception){unavailable=true;}
        if(!unavailable||String.Join(",",actions.ToArray())!="expand:help")throw new Exception("Claude 메뉴 허용 목록 자체 테스트 실패");
    }
    static void CheckNativeLaunch() {
        var standalone=NativeLaunch(@"C:\Programs\Claude\Claude.exe",null,@"C:\Windows");
        if(standalone.FileName!=@"C:\Programs\Claude\Claude.exe"||standalone.Arguments!=""||standalone.UseShellExecute)
            throw new Exception("Claude 독립 실행형 응용 프로그램 시작 자체 테스트에 실패했습니다.");
        var store=NativeLaunch(@"C:\Program Files\WindowsApps\Claude\app\Claude.exe","Claude_fixturepublisher!Claude",@"C:\Windows");
        if(store.FileName!=@"C:\Windows\explorer.exe"||store.Arguments!=@"shell:AppsFolder\Claude_fixturepublisher!Claude"||
            store.UseShellExecute||!store.CreateNoWindow||store.WindowStyle!=ProcessWindowStyle.Hidden)
            throw new Exception("Claude 스토어 앱 시작 자체 테스트 실패");
        bool rejected=false;
        try {NativeLaunch(@"C:\Claude.exe","Claude_fixturepublisher!Claude --other",@"C:\Windows");}
        catch(Exception){rejected=true;}
        if(!rejected)throw new Exception("Claude 포털 허용 목록 시작 자체 테스트에 실패했습니다.");
    }
    static void CheckDirectSubmission() {
        const string marker="/* codex bridge connector */";
        string text=marker+"(async()=>{\nvoid 0;\n})();";
        if(!ConsoleSourceShape(text,false)||ConsoleSourceShape(text,true)||
           ConsoleSourceShape(text.Replace("\n","\r\n"),false)||
           ConsoleSourceShape(marker+"void 0\n();",false)||
           ConsoleSourceShape(marker+new String('x',3500)+";\nvoid 0;",false)||
           !ConsoleSourceShape(marker+"void 0;",true))
            throw new Exception("Console 제한된 라인 형식 자체 테스트에 실패했습니다.");
        int writes=0,enters=0,pauses=0,checks=0;INPUT[] keys=null;
        SubmitForegroundConsole(text,()=>"",value=>{if(value!=text)throw new Exception("wrong source");writes++;},
            ()=>pauses==0?"":pauses==1?text.Substring(10,1):pauses==2?text.Substring(10,31):text.Substring(10,32),
            ()=>checks++,()=>pauses++,()=>pauses>=4,()=>pauses>=6,
            sent=>{enters++;keys=sent;});
        if(writes!=1||enters!=1||pauses!=4||keys.Length!=2||
           keys[0].data.key.vk!=13||keys[0].data.key.flags!=0||
           keys[1].data.key.vk!=13||keys[1].data.key.flags!=2)
            throw new Exception("Console 조각 표시 및 단일 직접 Enter 자체 테스트 실패");
        writes=0;enters=0;pauses=0;
        SubmitForegroundConsole(text,()=>"",value=>writes++,()=>pauses<2?"":text,
            ()=>{},()=>pauses++,()=>false,()=>pauses>=5,sent=>enters++);
        if(writes!=1||enters!=1||pauses!=2)throw new Exception("Console 비동기 블랭킹이 자체 검사에 실패한 직후 전문 제출");
        writes=0;enters=0;pauses=0;bool refused=false;
        try {SubmitForegroundConsole(text,()=>"",value=>writes++,()=>text.Substring(10,1),
            ()=>{},()=>pauses++,()=>true,()=>pauses>=2,sent=>enters++);}
        catch(Exception){refused=true;}
        if(!refused||writes!=1||enters!=0)throw new Exception("Console 단일 문자 조각은 자체 테스트 실패에 제출되어서는 안 됩니다.");
        writes=0;enters=0;pauses=0;refused=false;
        try {SubmitForegroundConsole(text,()=>"",value=>writes++,()=>"foreign Console draft",
            ()=>{},()=>pauses++,()=>true,()=>pauses>=2,sent=>enters++);}
        catch(Exception){refused=true;}
        if(!refused||writes!=1||enters!=0)throw new Exception("Console 관련없는 콘텐츠 제출이 거부되었습니다. 자체 점검에 실패했습니다.");
        writes=0;enters=0;refused=false;
        try {SubmitForegroundConsole(text,()=>"userCommand()",value=>writes++,()=>text,
            ()=>{},()=>{},()=>true,()=>false,sent=>enters++);}
        catch(Exception){refused=true;}
        if(!refused||writes!=0||enters!=0)throw new Exception("Console 사용자 초안 보호 자체 테스트에 실패했습니다.");
        writes=0;enters=0;
        SubmitForegroundConsole(text,()=>"\u200b\ufeff",value=>writes++,()=>text,
            ()=>{},()=>{},()=>false,()=>false,sent=>enters++);
        if(writes!=1||enters!=1)throw new Exception("Console 보이지 않는 빈 초안 자체 테스트 실패");
        writes=0;enters=0;checks=0;refused=false;
        try {SubmitForegroundConsole(text,()=>"",value=>writes++,()=>text,
            ()=>{if(++checks==3)throw new Exception("focus changed");},()=>{},()=>true,()=>false,sent=>enters++);}
        catch(Exception){refused=true;}
        if(!refused||writes!=1||enters!=0)throw new Exception("Console 제출 전 디포커스 보호 자가 테스트 실패");
        writes=0;enters=0;checks=0;refused=false;
        try {SubmitForegroundConsole(text,()=>"",value=>writes++,()=>"",
            ()=>{if(++checks==4)throw new OperationCanceledException();},()=>{},()=>false,()=>false,sent=>enters++);}
        catch(OperationCanceledException){refused=true;}
        if(!refused||writes!=1||enters!=0)throw new Exception("Console 자체 테스트 취소 대기 중 실패");
        writes=0;enters=0;refused=false;
        try {SubmitForegroundConsole(text,()=>"",value=>{writes++;throw new Exception("write failed");},()=>text,
            ()=>{},()=>{},()=>true,()=>false,sent=>enters++);}
        catch(Exception){refused=true;}
        if(!refused||writes!=1||enters!=0)throw new Exception("Console 쓰기 실패는 자체 테스트 실패를 제출해서는 안 됩니다.");
        writes=0;enters=0;refused=false;
        try {SubmitForegroundConsole(text,()=>"",value=>writes++,()=>text,
            ()=>{},()=>{},()=>true,()=>false,sent=>{enters++;throw new Exception("submit uncertain");});}
        catch(Exception){refused=true;}
        if(!refused||writes!=1||enters!=1)throw new Exception("Console 제출이 확실하지 않은 경우 자체 테스트 실패를 재생해서는 안 됩니다.");
    }
    static void CheckDetachedReuse() {
        var tools=new AppWindow {Handle=new IntPtr(21),Pid=7,Visible=true,Title="DevTools - app://localhost"};
        var main=new AppWindow {Handle=new IntPtr(22),Pid=7,Visible=true,Title="Claude"};
        var foreign=new AppWindow {Handle=new IntPtr(23),Pid=8,Visible=true,Title="DevTools - app://localhost"};
        var duplicate=new AppWindow {Handle=new IntPtr(24),Pid=7,Visible=true,Title="Developer Tools - app://localhost"};
        if(SelectDevTools(new[]{main,foreign,tools},7).Handle!=tools.Handle||SelectDevTools(new[]{main,foreign},7).Count!=0)
            throw new Exception("Claude 기존 개발자 도구 소유권 자체 테스트에 실패했습니다.");
        var ambiguous=SelectDevTools(new[]{tools,duplicate},7);
        if(ambiguous.Count!=2||ambiguous.Handle!=IntPtr.Zero)throw new Exception("Claude 개발자 도구 모호성 자체 테스트 실패");
        tools.Visible=false;
        if(SelectDevTools(new[]{tools},7).Count!=0)throw new Exception("Claude 숨겨진 개발자 도구 자체 테스트 실패");
    }
    static void CheckNativeQuit() {
        if(!SameQuitTarget(false,true,11,11,true,7,7)||SameQuitTarget(true,true,11,11,true,7,7)||
           SameQuitTarget(false,false,11,11,true,7,7)||SameQuitTarget(false,true,12,11,true,7,7)||
           SameQuitTarget(false,true,11,11,false,7,7)||SameQuitTarget(false,true,11,11,true,8,7))
            throw new Exception("Claude 기본 종료 대상 ID 자체 확인에 실패했습니다.");
        var actions=new List<string>();int reads=0,checks=0;
        Func<string> find=()=>{reads++;return "exit";};
        Action<string> invoke=item=>actions.Add("invoke:"+item);
        InvokeExistingQuit(find,(a,b)=>a==b,invoke,()=>checks++);
        if(String.Join(",",actions.ToArray())!="invoke:exit"||reads!=2||checks!=3)
            throw new Exception("Claude 기존 백그라운드 출구 진입 셀프체크 실패");
        actions.Clear();reads=0;checks=0;bool cancelled=false;
        try {InvokeExistingQuit(find,(a,b)=>a==b,invoke,()=>{if(++checks==2)throw new OperationCanceledException();});}
        catch(OperationCanceledException){cancelled=true;}
        if(!cancelled||actions.Count!=0)throw new Exception("Claude 자체 테스트를 취소하기 위한 백그라운드 종료 실패");
        foreach(string mode in new[]{"missing","hidden","changed","disappeared"}) {
            actions.Clear();reads=0;bool refused=false;
            Func<string> existing=()=>{reads++;return mode=="missing"||mode=="hidden"?null:reads==1?"exit":mode=="changed"?"replacement":null;};
            try {InvokeExistingQuit(existing,(a,b)=>a==b,invoke,()=>{});}catch(Exception){refused=true;}
            if(!refused||actions.Count!=0)throw new Exception("Claude 누락되거나 변경된 출구는 자체 테스트 실패로 인해 탐색되거나 제출되어서는 안 됩니다.");
        }
        actions.Clear();reads=0;bool uncertain=false;
        try {InvokeExistingQuit(find,(a,b)=>a==b,item=>{invoke(item);throw new Exception("lost acknowledgement");},()=>{});}
        catch(Exception){uncertain=true;}
        if(!uncertain||actions.Count!=1||reads!=2)throw new Exception("Claude 불확실한 종료를 재시도해서는 안 됩니다. 자체 테스트에 실패했습니다.");
        if(!QuitMenuName(ControlType.MenuItem,"Exit")||!QuitMenuName(ControlType.MenuItem,"\u9000\u51fa")||
           !QuitMenuName(ControlType.MenuItem,"\u7d50\u675f")||QuitMenuName(ControlType.Button,"Exit")||
           QuitMenuName(ControlType.Button,"Quit anyway")||QuitMenuName(ControlType.MenuItem,"Close Window"))
            throw new Exception("Claude 종료 항목 허용 목록 자체 테스트 실패");
        bool ambiguous=false;
        try {UniqueQuitControl(new[]{"exit","exit"},item=>item=="exit");}catch(Exception){ambiguous=true;}
        if(!ambiguous)throw new Exception("Claude 종료 메뉴 모호성 자체 테스트 실패");
        checks=0;
        if(ObserveQuit(()=>++checks==2,()=>false,()=>{},3)!="exited"||
           ObserveQuit(()=>false,()=>true,()=>{},3)!="pending"||
           ObserveQuit(()=>false,()=>false,()=>{},3)!="submitted")throw new Exception("Claude 종료 결과 자체 테스트 실패");
        var unavailable=new COMException("UIA provider terminated",unchecked((int)0x8000FFFF));
        Func<bool> failedProbe=()=>{throw unavailable;};
        if(ProbeNativeDialog(failedProbe,()=>true,()=>true)||ProbeNativeDialog(failedProbe,()=>false,()=>false))
            throw new Exception("Claude 파괴된 대화 상자 감지 자체 테스트 실패");
        bool propagated=false;
        try {ProbeNativeDialog(failedProbe,()=>false,()=>true);}
        catch(COMException error) {propagated=Object.ReferenceEquals(error,unavailable);}
        if(!propagated)throw new Exception("Claude 생존 창 오류 보호 자체 테스트에 실패했습니다.");
        bool exited=false;
        if(ObserveQuit(()=>exited,()=>ProbeNativeDialog(()=>{exited=true;throw unavailable;},
                ()=>exited,()=>false),()=>{},2)!="exited"||
           ObserveQuit(()=>false,()=>ProbeNativeDialog(failedProbe,()=>false,()=>false),()=>{},2)!="submitted")
            throw new Exception("Claude 종료하는 동안 창이 파괴되고 자체 테스트가 실패합니다.");
    }
    static void CheckQuitSubmissionCancellation() {
        int evidence=0,invocations=0;bool cancelledNow=false;
        var stopped=new QuitSubmission();bool rejected=false;
        cancelledNow=true;
        try {stopped.BeginSubmit(()=>evidence++,()=>cancelledNow);invocations++;}
        catch(OperationCanceledException){rejected=true;}
        if(!rejected||stopped.Started||evidence!=0||invocations!=0)
            throw new Exception("Claude 배포 잠금으로 인해 파일 확인 취소 자체 테스트가 실패했습니다.");
        using(var checkedTarget=new ManualResetEvent(false))using(var proceed=new ManualResetEvent(false)) {
            var before=new QuitSubmission();Exception failure=null;
            var worker=new Thread(delegate() {
                try {
                    checkedTarget.Set();if(!proceed.WaitOne(2000))throw new Exception("barrier timeout");
                    before.BeginSubmit(()=>evidence++,()=>false);invocations++;
                } catch(OperationCanceledException) {} catch(Exception error){failure=error;}
            });
            worker.IsBackground=true;worker.Start();
            if(!checkedTarget.WaitOne(2000))throw new Exception("Claude 시차적 장벽 자체 테스트 시간 초과 취소");
            bool cancelled=before.CancelBeforeSubmit();proceed.Set();
            if(!worker.Join(2000)||failure!=null||!cancelled||before.Started||evidence!=0||invocations!=0)
                throw new Exception("Claude 마지막 신원 확인 후 자체 검사 취소에 실패했습니다.");
        }
        var after=new QuitSubmission();bool cancellationWon=true;
        after.BeginSubmit(()=>{evidence++;cancellationWon=after.CancelBeforeSubmit();},()=>false);invocations++;
        bool repeated=false;
        try {after.BeginSubmit(()=>evidence++,()=>false);invocations++;}catch(OperationCanceledException){repeated=true;}
        if(!after.Started||cancellationWon||!repeated||evidence!=1||invocations!=1)
            throw new Exception("Claude 발송 취소 및 중복 제출 방지 자체 테스트 실패");
    }
    static void CheckBackgroundConnection() {
        foreach(string title in new[]{"DevTools - app://localhost","Developer Tools - app://localhost/new?example=1","\u5f00\u53d1\u8005\u5de5\u5177 - app://localhost/"})
            if(!AppDevToolsTitle(title))throw new Exception("Claude 백그라운드 소스 허용 목록 자체 검사 실패");
        foreach(string title in new[]{"DevTools - app://localhost.evil","DevTools - app://user@localhost","DevTools - app://localhost:80","DevTools - https://localhost","Developer Tools - file:///C:/Claude/.vite/renderer/main_window/index.html","Claude"})
            if(AppDevToolsTitle(title))throw new Exception("Claude 백엔드 소스 거부 목록 자체 테스트 실패");
        var content=new AppWindow {Handle=new IntPtr(31),Pid=7,Visible=true,Title="Developer Tools - app://localhost/new"};
        var shell=new AppWindow {Handle=new IntPtr(32),Pid=7,Visible=true,Title="Developer Tools - file:///C:/Claude/.vite/renderer/main_window/index.html"};
        var foreign=new AppWindow {Handle=new IntPtr(33),Pid=8,Visible=true,Title=content.Title};
        if(SelectBackgroundDevTools(new[]{content,shell,foreign},7).Handle!=content.Handle||!ShellDevToolsTitle(shell.Title))throw new Exception("Claude 백그라운드 콘텐츠 및 셸 격리 자체 테스트에 실패했습니다.");
        var duplicate=new AppWindow {Handle=new IntPtr(34),Pid=7,Visible=true,Title=content.Title};
        if(SelectBackgroundDevTools(new[]{content,duplicate},7).Handle!=IntPtr.Zero)throw new Exception("Claude 배경 소스 모호성 자체 검사에 실패했습니다.");
        content.Visible=false;if(SelectBackgroundDevTools(new[]{content,shell},7).Count!=0)throw new Exception("Claude 배경 숨겨진 창에서 자체 검사 실패를 거부합니다.");
        bool rejected=false;try{VerifiedDevToolsTitle(content.Title,shell.Title);}catch(Exception){rejected=true;}
        if(!rejected||VerifiedDevToolsTitle("Developer Tools",content.Title)!=content.Title)throw new Exception("Claude 백엔드 소스 교차 검증 자체 테스트 실패");
        const string text="/* codex bridge connector */void 0;";
        foreach(string mode in new[]{"ready","blank-first","partial","draft","raced-draft","interrupted","submit-error","cancelled","always-blank"}) {
            int writes=0,submits=0,resets=0,retries=0,reads=0;bool failed=false;
            Func<string> read=()=>mode=="raced-draft"&&++reads>1?"/* codex bridge connector */user draft":mode=="draft"?"user draft":mode=="partial"&&writes>0?"partial":mode=="interrupted"&&retries>=2?"new user draft":"";
            try {SubmitBackgroundVerifiedConsole(text,read,value=>writes++,()=>mode=="ready"||mode=="submit-error"||mode=="blank-first"&&writes==2?text:mode=="partial"?"partial":"",()=>{},()=>{},()=>true,()=>resets++,
                delegate{retries++;if(mode=="cancelled")throw new OperationCanceledException();return true;},delegate{submits++;if(mode=="submit-error")throw new Exception("lost callback");});}
            catch(Exception){failed=true;}
            if(mode=="ready"&&(failed||writes!=1||submits!=1)||mode=="blank-first"&&(failed||writes!=2||submits!=1)||
               (mode=="draft"||mode=="raced-draft")&&(!failed||writes!=0||submits!=0)||mode=="submit-error"&&(!failed||writes!=1||submits!=1)||
               mode=="always-blank"&&(!failed||writes!=2||submits!=0)||
               (mode=="partial"||mode=="interrupted"||mode=="cancelled")&&(!failed||writes!=1||submits!=0))
                throw new Exception("Claude 백그라운드 전체 섹션 제출 및 제한된 공백 재시도 자체 테스트 실패: "+mode);
        }
        int dispatches=0;var cancelled=new BackgroundOperation();cancelled.Cancel();rejected=false;
        try{cancelled.ClaimDispatch(()=>dispatches++);}catch(OperationCanceledException){rejected=true;}
        if(!rejected||dispatches!=0)throw new Exception("Claude 백그라운드 취소 및 상호 배제 제출 자체 테스트 실패");
        var dispatched=new BackgroundOperation();dispatched.ClaimDispatch(()=>dispatches++);if(!dispatched.Cancel()||dispatches!=1)throw new Exception("Claude 불확실한 상태 자체 테스트의 백그라운드 제출 실패");
        rejected=false;try{dispatched.ClaimDispatch(()=>dispatches++);}catch(OperationCanceledException){rejected=true;}
        if(!rejected||dispatches!=1||String.IsNullOrWhiteSpace(FailureMessage(new COMException(""),true)))throw new Exception("Claude 백그라운드 반복 제출 및 Null 오류 방지 자체 테스트 실패");
    }
    static void CheckBackgroundCleanup() {
        foreach(string mode in new[]{"empty","draft","late-draft","cancelled","connector-draft"}) {
            int reads=0,checks=0,closes=0;bool failed=false;
            try {CloseVerifiedBackgroundConsole(delegate {
                reads++;return mode=="draft"||mode=="late-draft"&&reads>=2?"user draft":mode=="connector-draft"?"/* codex bridge connector */unsent":"";
            },delegate {checks++;if(mode=="cancelled"&&checks==2)throw new OperationCanceledException();},()=>closes++);}
            catch(Exception){failed=true;}
            if(mode=="empty"&&(failed||closes!=1)||mode!="empty"&&(!failed||closes!=0))throw new Exception("Claude 백그라운드 도구 정리 초안 및 보호 해제 자체 확인에 실패했습니다.: "+mode);
        }
    }
    static void CheckBackgroundStartupReadiness() {
        var hidden=new AppWindow {Handle=new IntPtr(41),Pid=7,Title="Claude"};
        var main=new AppWindow {Handle=new IntPtr(42),Pid=7,Visible=true,Title="Claude"};
        var tools=new AppWindow {Handle=new IntPtr(43),Pid=7,Visible=true,Title="Developer Tools - app://localhost/new"};
        foreach(string mode in new[]{"tools-later","main-later","ready","timeout","cancelled"}) {
            int reads=0,pauses=0,checks=0;bool failed=false;List<AppWindow> result=null;
            try {result=WaitBackgroundReady(7,delegate {
                reads++;return new List<AppWindow>(mode=="ready"||mode=="tools-later"&&reads>=3?new[]{hidden,tools}:mode=="main-later"&&reads>=2?new[]{main}:new[]{hidden});
            },delegate{if(mode=="cancelled"&&++checks==3)throw new OperationCanceledException();},()=>pauses++,()=>reads>=4);}
            catch(Exception){failed=true;}
            if(mode=="tools-later"&&(failed||reads!=3||pauses!=2||SelectBackgroundDevTools(result,7).Handle!=tools.Handle)||
               mode=="main-later"&&(failed||reads!=2||pauses!=1||SelectWindow(result,7,IntPtr.Zero).Handle!=main.Handle)||
               mode=="ready"&&(failed||reads!=1||pauses!=0)||mode=="timeout"&&(!failed||reads!=4||pauses!=3)||
               mode=="cancelled"&&(!failed||reads!=1||pauses!=1))throw new Exception("Claude 백그라운드 시작 준비 및 자체 검사 실패: "+mode);
        }
    }
    static void CheckBackgroundNativeResume() {
        var hidden=new AppWindow {Handle=new IntPtr(51),Pid=7,Title="Claude",ClassName="Chrome_WidgetWin_1"};
        var named=new AppWindow {Handle=new IntPtr(52),Pid=7,Title="Fixture — Claude",ClassName="Chrome_WidgetWin_1"};
        var utility=new AppWindow {Handle=new IntPtr(53),Pid=7,ClassName="Chrome_WidgetWin_1"};
        var visible=new AppWindow {Handle=hidden.Handle,Pid=7,Visible=true,Title="Claude",ClassName="Chrome_WidgetWin_1"};
        var replaced=new AppWindow {Handle=new IntPtr(54),Pid=7,Visible=true,Title="Claude",ClassName="Chrome_WidgetWin_1"};
        var tools=new AppWindow {Handle=new IntPtr(55),Pid=7,Visible=true,Title="Developer Tools - app://localhost/new"};
        if(SelectHiddenBackgroundMain(new[]{hidden,utility},7).Handle!=hidden.Handle||
           SelectHiddenBackgroundMain(new[]{named,utility},7).Handle!=named.Handle||
           SelectHiddenBackgroundMain(new[]{hidden,named,utility},7).Handle!=IntPtr.Zero)
            throw new Exception("Claude 기본 창 및 보조 창 숨기기 격리 자가 테스트 실패");
        foreach(string mode in new[]{"visible","owned","tool","cloaked","foreign","class","title"}) {
            var invalid=new AppWindow {Handle=new IntPtr(56),Pid=mode=="foreign"?8:7,Title=mode=="title"?"Utility":"Claude",
                ClassName=mode=="class"?"Other":"Chrome_WidgetWin_1",Visible=mode=="visible",Owner=mode=="owned"?new IntPtr(1):IntPtr.Zero,
                ToolWindow=mode=="tool",Cloaked=mode=="cloaked"};
            if(SelectHiddenBackgroundMain(new[]{invalid},7).Count!=0)throw new Exception("Claude 기본 창 ID 숨기기 자체 확인에 실패했습니다.: "+mode);
        }
        foreach(string mode in new[]{"cold-tools","racing-tools","resume","never-ready","ambiguous","missing","cancel-before","cancel-after","identity-before","identity-after","expired-before"}) {
            int reads=0,reopens=0;bool failed=false;List<AppWindow> result=null;
            try {result=WaitBackgroundReady(7,delegate {
                reads++;
                if(mode=="cold-tools"&&reads>=2||mode=="racing-tools"&&reads>=3)return new List<AppWindow>(new[]{hidden,tools});
                if(mode=="resume"&&reopens>0)return new List<AppWindow>(new[]{visible});
                if(mode=="identity-after"&&reopens>0)return new List<AppWindow>(new[]{replaced,tools});
                return new List<AppWindow>(mode=="ambiguous"?new[]{hidden,named,utility}:mode=="missing"?new[]{utility}:new[]{hidden,utility});
            },delegate {
                if(mode=="cancel-before"&&reads>=3||mode=="cancel-after"&&reopens>0)throw new OperationCanceledException();
                if(mode=="identity-before"&&reads>=3)throw new Exception("changed process");
            },()=>{},()=>mode=="expired-before"&&reads>=3||reads>=6,
            delegate(IntPtr window){if(window!=hidden.Handle)throw new Exception("wrong window");reopens++;},()=>reads>=2);}
            catch(Exception){failed=true;}
            bool success=mode=="cold-tools"||mode=="racing-tools"||mode=="resume";
            int expectedReopens=mode=="resume"||mode=="never-ready"||mode=="cancel-after"||mode=="identity-after"?1:0;
            if(failed==success||reopens!=expectedReopens||success&&result==null)
                throw new Exception("Claude 숨겨진 인스턴스의 단일 복구 및 자체 점검 실패: "+mode);
        }
    }
    static void CheckBackgroundWindowRestore() {
        var main=new AppWindow {Handle=new IntPtr(61),Pid=7,Visible=true,Title="Claude",ClassName="Chrome_WidgetWin_1"};
        var tool=new AppWindow {Handle=new IntPtr(62),Owner=main.Handle,Pid=7,Visible=true,Title="Developer Tools - app://localhost/new"};
        var modal=new AppWindow {Handle=new IntPtr(63),Owner=main.Handle,Pid=7,Visible=true,Title="Confirmation"};
        var native=new AppWindow {Handle=new IntPtr(64),Pid=7,Visible=true,ClassName="#32770"};
        foreach(string mode in new[]{"tools","other-foreground","no-foreground","user-input","disabled","main-foreground","owned-modal","native-dialog","missing-main","changed-shape"}) {
            main.ClassName=mode=="changed-shape"?"Other":"Chrome_WidgetWin_1";
            var windows=mode=="owned-modal"?new[]{main,tool,modal}:mode=="native-dialog"?new[]{main,tool,native}:mode=="missing-main"?new[]{tool}:new[]{main,tool};
            IntPtr foreground=mode=="main-foreground"?main.Handle:mode=="no-foreground"?IntPtr.Zero:mode=="other-foreground"?new IntPtr(65):tool.Handle;
            bool result=CanRestoreBackgroundMain(windows,7,main.Handle,foreground,mode!="user-input",mode!="disabled");
            if(result!=(mode=="tools"||mode=="other-foreground"||mode=="no-foreground"))throw new Exception("Claude 기본 창 숨기기 보존 복원 자체 테스트 실패: "+mode);
        }
        foreach(double age in new[]{-1,0,8,29.999,30,600})
            if(BackgroundColdGrace(TimeSpan.FromSeconds(age))!=(age>=30?0:8))throw new Exception("Claude 콜드 스타트 ​​유예 및 기존 인스턴스 자체 검사 실패");
    }
    static void CheckBackgroundConsoleReadiness() {
        foreach(string mode in new[]{"ready","delayed","missing-tab","missing-prompt","cancelled","provider-late"}) {
            int tabs=0,prompts=0,selections=0,pauses=0,checks=0;bool failed=false;
            try {SelectReadyBackgroundConsole(delegate {
                tabs++;if(mode=="provider-late"&&tabs<3)throw new ElementNotAvailableException();
                return mode=="missing-tab"||mode=="delayed"&&tabs<3?null:"Console";
            },tab=>selections++,delegate(string tab){prompts++;return mode!="missing-prompt"&&(mode!="delayed"||prompts>=3);},
            delegate{checks++;if(mode=="cancelled"&&checks==2)throw new OperationCanceledException();},()=>pauses++,()=>tabs+prompts>=8);}
            catch(Exception){failed=true;}
            if(mode=="ready"&&(failed||tabs!=1||prompts!=1||selections!=1||pauses!=0)||
               mode=="delayed"&&(failed||tabs!=3||prompts!=3||selections!=1||pauses!=4)||
               mode=="provider-late"&&(failed||tabs!=3||prompts!=1||selections!=1)||
               mode=="missing-tab"&&(!failed||tabs!=8||selections!=0)||
               mode=="missing-prompt"&&(!failed||selections!=1)||
               mode=="cancelled"&&(!failed||tabs!=1||selections!=0))throw new Exception("Claude Console 제어 준비 완료 및 단일 선택 자체 테스트 실패: "+mode);
        }
    }
    static string FailureMessage(Exception error,bool quitting) {
        if(error is System.ComponentModel.Win32Exception)return "읽을 수 없음 Claude 창에서 실행 권한을 확인해주세요";
        return !String.IsNullOrWhiteSpace(error.Message)?error.Message:quitting?"Claude 기본 종료 메뉴 작업에 실패했습니다. 컴퓨터에서 확인한 후 다시 시도해 주세요.":"Claude 기본 연결 작업에 실패했습니다. 컴퓨터에서 확인한 후 다시 시도하세요.";
    }
    [STAThread] static int Main(string[] args) {
        Console.OutputEncoding=new UTF8Encoding(false);
        try {
            if(args.Length==1&&args[0]=="--self-check") {
                if(OwnerIssue("Error: BRIDGE_OWNER_BUSY [current]","current")!="OWNER_BUSY"||
                   OwnerIssue("Error: BRIDGE_OWNER_UNCONFIRMED [current]","current")!="OWNER_UNCONFIRMED"||
                   OwnerIssue("Error: BRIDGE_OWNER_LEGACY [current]","current")!="OWNER_LEGACY"||
                   OwnerIssue("Error: Claude \u6865\u63a5\u8fde\u63a5\u88ab\u5176\u4ed6\u7f51\u5173\u5360\u7528 [current]","current")!="OWNER_LEGACY"||
                   OwnerIssue("Error: BRIDGE_OWNER_BUSY [old]","current")!=null||
                   OwnerIssue("Error: BRIDGE_OWNER_BUSY", "current")!=null)throw new Exception("브리지 오류 격리 자체 테스트 실패");
                if(Marshal.SizeOf(typeof(INPUT))!=(IntPtr.Size==8?40:28)||!PromptName("Console prompt","")||PromptName("Message Claude","")) throw new Exception("키보드 구성 요소 자체 테스트 실패");
                if(ReadContents("script","")!="script"||ReadContents("","value")!="value"||ReadContents(null,"value")!="value"||ReadContents("",null)!="")throw new Exception("Console 텍스트 읽기 자체 테스트에 실패했습니다.");
                if(!DevToolsTitle("Developer Tools - app://localhost/new")||!DevToolsTitle("DevTools - app://localhost")||DevToolsTitle("Claude"))throw new Exception("개발자 도구 창 일치 자체 테스트에 실패했습니다.");
                Func<string,string> parent=value=>value=="editor-child"?"expected-console":value=="other-editor"?"other-console":null;
                if(!FocusedWithin("expected-console","editor-child",parent,(a,b)=>a==b)||FocusedWithin("expected-console","other-editor",parent,(a,b)=>a==b)||FocusedWithin("expected-console","other-console",parent,(a,b)=>a==b))throw new Exception("Console 정확한 초점 자체 테스트 실패");
                CheckWindowSelection();
                CheckMenuNavigation();
                CheckNativeLaunch();
                CheckDirectSubmission();
                CheckDetachedReuse();
                CheckNativeQuit();
                CheckQuitSubmissionCancellation();
                CheckBackgroundConnection();
                CheckBackgroundCleanup();
                CheckBackgroundStartupReadiness();
                CheckBackgroundNativeResume();
                CheckBackgroundWindowRestore();
                CheckBackgroundConsoleReadiness();
                Console.WriteLine("keyboard ABI, Console allowlist and contenteditable text fallback OK; window selection and cancellable restore OK; menu navigation OK; packaged launch OK; atomic console submission OK; detached console reuse OK; existing background quit guards OK; atomic quit cancellation guards OK; background console guards OK; background cleanup guards OK; background startup readiness OK; background native resume OK; background window restore OK; background Console readiness OK");return 0;
            }
            if(args.Length!=3 && args.Length!=4) throw new Exception("잘못된 키보드 연결 매개변수");
            quitAction=args[1]=="--quit";
            backgroundAction=args[1].StartsWith("--connect-background=",StringComparison.Ordinal);
            backgroundCleanupAction=args[1]=="--close-background-devtools";
            cancelFile=args.Length==4?args[3]:null;
            executable=Path.GetFullPath(args[2]);
            var process=Process.GetProcessById(Int32.Parse(args[0]));
            quitPid=process.Id;
            if(!Owned(process.Id)) throw new Exception("목표는 Claude");
            if(quitAction) {QuitNative(process);return 0;}
            if(args[1]=="--inspect-window") {InspectWindow(process);return 0;}
            if(args[1]=="--close-devtools") {CloseDevTools();return 0;}
            if(backgroundCleanupAction){RunBackgroundCleanup(process);return 0;}
            if(args[1]=="--enable-devtools") {GetAsyncKeyState(27);EnableDeveloperMode(process);return 0;}
            if(args[1]=="--inspect-error") {
                var texts=AutomationElement.FromHandle(WaitAppWindow(process,false)).FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Text));
                foreach(AutomationElement item in texts) {
                    string value=item.Current.Name;
                    string ownerIssue=args.Length==4?OwnerIssue(value,args[3]):null;
                    if(ownerIssue!=null) {Stage(ownerIssue);return 0;}
                    if((value.StartsWith("Error:")||value.StartsWith("Uncaught"))&&(value.Contains("아직 신뢰할 수 없는 디렉터리")||value.Contains("WorkspaceTrustError")||value.Contains("trust_required"))) {Stage("NEEDS_TRUST");return 0;}
                }
                Stage("NO_TRUST_ERROR");return 0;
            }
            string script=backgroundAction?args[1].Substring("--connect-background=".Length):args[1];
            string text=File.ReadAllText(script,Encoding.UTF8);
            if(!ConsoleSourceShape(text,backgroundAction))throw new Exception("잘못된 연결 스크립트 형식");
            if(backgroundAction){RunBackgroundConnection(process,text);return 0;}
            Stage("대기 중 Claude 창문");
            GetAsyncKeyState(27); // Clear an old Escape press, subsequent presses cancel.
            var existingTools=SelectDevTools(ReadWindows(process.Id),process.Id);
            if(existingTools.Count>1)throw new Exception("여러 개 감지됨 Claude 개발자 도구 창, 중복된 창을 닫고 다시 시도하세요.");
            bool reuseTools=existingTools.Handle!=IntPtr.Zero;
            IntPtr window=reuseTools?existingTools.Handle:WaitAppWindow(process,true);
            inputWindow=window;
            Activate(window);
            Stage("타겟 Claude 창문");
            if(reuseTools)SelectConsoleTab();
            var prompt=ConsolePrompt();
            var previousWindows=new System.Collections.Generic.HashSet<IntPtr>();
            EnumWindows(delegate(IntPtr handle,IntPtr data){previousWindows.Add(handle);return true;},IntPtr.Zero);
            if(prompt==null&&!reuseTools) {Shortcut();inputWindow=IntPtr.Zero;}
            Stage("기다리다 Console 입력 상자");
            var deadline=DateTime.UtcNow.AddSeconds(8);
            while(prompt==null&&DateTime.UtcNow<deadline) {
                Thread.Sleep(250);CheckForeground();
                var current=GetForegroundWindow();
                if(current!=window) {
                    var title=new StringBuilder(512);GetWindowText(current,title,title.Capacity);
                    if(previousWindows.Contains(current)||!DevToolsTitle(title.ToString()))throw new Exception("Claude 창이 바뀌어 자동연결이 멈췄습니다. 다시 시도해 주세요.");
                }
                SelectConsoleTab();prompt=ConsolePrompt();
            }
            if(prompt==null) throw new Exception("찾을 수 없음 Claude Console 입력 상자, 개발자 도구가 허용되는지 확인하고 제목을 통해 다시 시도하십시오.");
            inputWindow=GetForegroundWindow();
            Stage("타겟 Console 입력 상자");
            // This foreground bootstrap is used only for explicit manual
            // initialization. Reconnects never launch this keyboard helper.
            FocusPrompt(prompt);WriteConsoleOnce(prompt,text);
            Console.WriteLine("스크립트가 입력되었습니다. 연결 수신을 기다리는 중입니다.");return 0;
        } catch(Exception e) {
            string message=FailureMessage(e,quitAction);
            if(quitAction)QuitResult("failed",message,quitPid);else if(backgroundAction)ConnectResult("failed",backgroundSubmission,quitPid,message);else Console.WriteLine(message);
            return 1;
        }
    }
}
