// Invoke Codex's normal application-menu Quit command, never close or kill a window.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

class CodexQuit {
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window,uint command);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder value,int size);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,StringBuilder value,int size);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
    [DllImport("user32.dll",EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr window,int index);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window,uint attribute,out uint value,uint size);
    delegate bool EnumWindow(IntPtr window,IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback,IntPtr data);


    [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(uint pid);
    [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr window,uint message,IntPtr wparam,IntPtr lparam,uint flags,uint milliseconds,out IntPtr receipt);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window,uint message,IntPtr wparam,IntPtr lparam);
    [StructLayout(LayoutKind.Sequential)] struct IconId {public uint size;public IntPtr hwnd;public uint id;public Guid guid;}
    [StructLayout(LayoutKind.Sequential)] struct Rect {public int left,top,right,bottom;}
    [DllImport("shell32.dll")] static extern int Shell_NotifyIconGetRect(ref IconId id,out Rect rect);
    static bool tray;
    static string executable,cancelFile;
    static readonly int session=Process.GetCurrentProcess().SessionId;
    static string Json(string text) {return "\""+text.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r","\\r").Replace("\n","\\n").Replace("\t","\\t")+"\"";}
    static void Stage(string text) {Console.WriteLine(text);Console.Out.Flush();}
    static void Reply(string state,int pid,string reason) {Stage("{\"quitState\":"+Json(state)+",\"pid\":"+pid+",\"reason\":"+Json(reason)+"}");}
    sealed class Window {
        public IntPtr Handle,Owner;public bool Visible,Tool,Cloaked;public string ClassName,Title;
    }
    static List<Window> Windows(int pid) {
        var result=new List<Window>();
        EnumWindows(delegate(IntPtr handle,IntPtr data) {
            uint actual;GetWindowThreadProcessId(handle,out actual);if(actual!=pid)return true;
            var title=new StringBuilder(512);var name=new StringBuilder(128);
            GetWindowText(handle,title,title.Capacity);GetClassName(handle,name,name.Capacity);
            long style=IntPtr.Size==8?GetWindowLongPtr(handle,-20).ToInt64():GetWindowLong(handle,-20);uint cloaked;
            result.Add(new Window {Handle=handle,Owner=GetWindow(handle,4),Visible=IsWindowVisible(handle),Tool=(style&0x80)!=0,
                Cloaked=DwmGetWindowAttribute(handle,14,out cloaked,4)==0&&cloaked!=0,ClassName=name.ToString(),Title=title.ToString()});return true;
        },IntPtr.Zero);return result;
    }
    static bool MainWindow(Window window) {return window.Visible&&MainShape(window);}
    static bool MainShape(Window window) {
        return !window.Tool&&!window.Cloaked&&window.Owner==IntPtr.Zero&&window.ClassName=="Chrome_WidgetWin_1"&&
            !String.IsNullOrWhiteSpace(window.Title)&&!window.Title.StartsWith("DevTools",StringComparison.Ordinal)&&
            !window.Title.StartsWith("Developer Tools",StringComparison.Ordinal)&&!window.Title.StartsWith("\u5f00\u53d1\u8005\u5de5\u5177",StringComparison.Ordinal);
    }
    static bool PendingDialog(IEnumerable<Window> windows) {
        foreach(var window in windows) {
            if(!window.Visible||window.Cloaked)continue;
            if(window.ClassName=="#32770"||window.Owner!=IntPtr.Zero&&!window.Tool||MainWindow(window)&&!IsWindowEnabled(window.Handle))return true;
        }
        return false;
    }
    static bool Owned(Process process,long started) {
        try {return !process.HasExited&&process.SessionId==session&&process.StartTime.ToUniversalTime().Ticks==started&&
            String.Equals(Path.GetFullPath(process.MainModule.FileName),executable,StringComparison.OrdinalIgnoreCase);}
        catch {return false;}
    }
    sealed class Operation {
        readonly object gate=new object();bool cancelled;
        public volatile bool Submitted,Finished;public Exception Error;public string State,Reason;
        public void Cancel() {lock(gate){cancelled=true;}}
        public void Check() {lock(gate){if(cancelled||cancelFile!=null&&File.Exists(cancelFile))throw new OperationCanceledException("취소 Codex 종료");}}
        public void Dispatch(int pid,Action invoke) {
            lock(gate) {
                if(cancelled||Submitted||cancelFile!=null&&File.Exists(cancelFile))throw new OperationCanceledException("취소 Codex 종료");
                Submitted=true;Stage("{\"quitPhase\":\"dispatching\",\"pid\":"+pid+"}");
            }
            // UIA may block or throw after delivery. It must not hold the gate,
            // and a lost return value must never trigger a second invocation.
            invoke();
        }
        public void Start(Process process,long started) {
            var thread=new Thread(delegate() {try {if(tray)QuitTray(process,started,this);else Quit(process,started,this);}catch(Exception error){Error=error;}finally{Finished=true;}});
            thread.IsBackground=true;thread.SetApartmentState(ApartmentState.MTA);thread.Start();
        }
    }
    static void Check(Process process,long started,Operation operation,IntPtr window) {
        operation.Check();
        if(!Owned(process,started))throw new Exception("Codex 기본 프로세스가 변경되어 종료 요청이 중지되었습니다.");
        if(window!=IntPtr.Zero) {
            uint pid;GetWindowThreadProcessId(window,out pid);
            if(!IsWindow(window)||pid!=process.Id)throw new Exception("Codex 메인 창이 변경되어 종료 요청이 중지되었습니다.");
        }
    }
    static bool Available(AutomationElement item,int pid) {return item!=null&&item.Current.ProcessId==pid&&item.Current.IsEnabled&&!item.Current.IsOffscreen;}
    static AutomationElement Unique(AutomationElement root,Condition condition,int pid) {
        var items=root.FindAll(TreeScope.Descendants,condition);AutomationElement selected=null;
        foreach(AutomationElement item in items)if(Available(item,pid)) {
            if(selected!=null)throw new Exception("Codex 종료 메뉴가 고유하지 않으며 종료가 아직 제출되지 않았습니다.");selected=item;
        }
        return selected;
    }
    static AutomationElement Wait(Func<AutomationElement> find,Action check,int milliseconds) {
        var timer=Stopwatch.StartNew();
        do {
            check();AutomationElement found=null;
            try {found=find();}catch(ElementNotAvailableException) {}
            check();if(found!=null)return found;Thread.Sleep(100);
        } while(timer.ElapsedMilliseconds<milliseconds);
        throw new Exception("Codex 아직 애플리케이션 종료 메뉴가 준비되지 않았습니다. 컴퓨터에서 확인 후 다시 시도해 주세요.");
    }
    static string Compact(string text) {
        var result=new StringBuilder();foreach(char value in text??"")if(!Char.IsWhiteSpace(value))result.Append(value);return result.ToString();
    }
    // Codex/ZCode의 실제 창·종료 메뉴 이름은 외부 계약이므로 번역하지 않습니다.
    static readonly string[] QuitLabels={"\u9000\u51fa Codex","Quit Codex","\u9000\u51fa ChatGPT","Quit ChatGPT"};
    static bool QuitLabel(string text) {
        foreach(string label in QuitLabels)if(text==label)return true;return false;
    }
    static bool QuitName(string name,string accelerator) {
        foreach(string label in QuitLabels) {
            if(Compact(name)==Compact(label+"Ctrl+Q"))return true;
            if(Compact(name)==Compact(label)&&Compact(accelerator)=="Ctrl+Q")return true;
        }
        return false;
    }
    static bool QuitItem(AutomationElement item,int pid) {
        if(!Available(item,pid)||item.Current.ControlType!=ControlType.MenuItem)return false;
        if(QuitName(item.Current.Name,item.Current.AcceleratorKey))return true;
        if(!QuitLabel(item.Current.Name))return false;
        var texts=item.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Text));
        int accelerators=0;
        foreach(AutomationElement text in texts)if(text.Current.ProcessId==pid&&Compact(text.Current.Name)=="Ctrl+Q")accelerators++;
        return accelerators==1;
    }
    static AutomationElement FindQuit(AutomationElement content,int pid) {
        var items=content.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.MenuItem));
        AutomationElement result=null;
        foreach(AutomationElement item in items)if(QuitItem(item,pid)) {
            if(result!=null)throw new Exception("Codex 종료 명령이 고유하지 않으며 종료가 아직 제출되지 않았습니다.");result=item;
        }
        return result;
    }
    static void QuitTray(Process process,long started,Operation operation) {
        // Electron's notification icon HWND belongs to this process. Open only its
        // registered icon menu; do not send keyboard input or click screen positions.
        Window host=null;
        var before=Windows(process.Id);
        if(PendingDialog(before))throw new Exception("먼저 처리해주세요 ZCode 확인창");
        foreach(var window in before)if(window.ClassName=="Electron_NotifyIconHostWindow") {
            if(host!=null)throw new Exception("ZCode 트레이 창이 고유하지 않습니다.");host=window;
        }
        if(host==null)throw new Exception("찾을 수 없음 ZCode 기본 트레이 메뉴");
        Action check=()=>Check(process,started,operation,host.Handle);
        check();
        // Electron allocates increasing IDs for an app's tray entries. Explorer
        // returns S_FALSE for a registered icon in the overflow area.
        uint selected=0;Rect rect;
        for(uint id=2;id<=32;id++){
            var icon=new IconId {size=(uint)Marshal.SizeOf(typeof(IconId)),hwnd=host.Handle,id=id};
            int code=Shell_NotifyIconGetRect(ref icon,out rect);
            if(code!=0&&code!=1)continue;
            if(selected!=0)throw new Exception("ZCode 기본 트레이 아이콘이 고유하지 않습니다.");
            selected=id;
        }
        if(selected==0)throw new Exception("ZCode 트레이 아이콘이 등록되지 않았습니다");
        check();
        // Electron's tray callback asks Windows to foreground its own menu HWND.
        // Pass only this PID the caller's existing foreground grant, if any.
        AllowSetForegroundWindow((uint)process.Id);
        IntPtr receipt;
        if(SendMessageTimeout(host.Handle,0x8001,new IntPtr(selected),new IntPtr(0x0204),0x22,1500,out receipt)==IntPtr.Zero||receipt!=new IntPtr(1))
            throw new Exception("ZCode 트레이 메뉴 열기가 확인되지 않았으며 종료를 요청하지 않았습니다.");
        IntPtr popup=IntPtr.Zero;
        Func<AutomationElement> find=()=>{
            AutomationElement quit=null;
            foreach(var window in Windows(process.Id)){
                if(!window.Visible||window.Cloaked||before.Exists(previous=>previous.Handle==window.Handle&&previous.Visible))continue;
                if(window.ClassName!="#32768"&&!window.ClassName.StartsWith("Chrome_WidgetWin_",StringComparison.Ordinal))continue;
                var root=AutomationElement.FromHandle(window.Handle);
                var items=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.MenuItem));
                bool zcodeMenu=false;
                foreach(AutomationElement item in items)if(Available(item,process.Id)&&
                    (item.Current.Name=="\u6253\u5f00 ZCode"||item.Current.Name=="Open ZCode"))zcodeMenu=true;
                if(!zcodeMenu)continue;
                foreach(AutomationElement item in items){
                    if(!Available(item,process.Id)||(item.Current.Name!="\u9000\u51fa"&&item.Current.Name!="Quit"))continue;
                    if(quit!=null)throw new Exception("ZCode 종료 메뉴 항목이 고유하지 않습니다.");
                    quit=item;popup=window.Handle;
                }
            }
            return quit;
        };
        try{
            var item=Wait(find,check,3500);
            var current=find();object invoke;
            if(current==null||!Automation.Compare(item,current)||!current.TryGetCurrentPattern(InvokePattern.Pattern,out invoke))
                throw new Exception("ZCode 종료 메뉴가 변경되었으며 아직 종료가 요청되지 않았습니다.");
            check();Check(process,started,operation,popup);
            operation.Dispatch(process.Id,()=>((InvokePattern)invoke).Invoke());
            operation.State="submitted";operation.Reason="요청됨 ZCode 정상적으로 종료하려면 컴퓨터에 나타날 수 있는 확인을 처리하십시오.";
        }finally{
            if(!operation.Submitted&&popup!=IntPtr.Zero&&Owned(process,started)){
                uint owner;GetWindowThreadProcessId(popup,out owner);
                if(owner==process.Id)PostMessage(popup,0x001f,IntPtr.Zero,IntPtr.Zero);
            }
        }
    }
    static void Quit(Process process,long started,Operation operation) {
        Action check=()=>Check(process,started,operation,IntPtr.Zero);
        var timer=Stopwatch.StartNew();IntPtr main=IntPtr.Zero;
        check();var windows=Windows(process.Id);
        if(PendingDialog(windows)){operation.State="pending";operation.Reason="Codex 보류 중인 기본 대화 상자가 있습니다. 컴퓨터에서 확인 또는 취소해 주세요.";return;}
        foreach(var window in windows)if(MainWindow(window)) {
            if(main!=IntPtr.Zero)throw new Exception("Codex 메인창이 고유하지 않습니다. 컴퓨터에서 확인 후 다시 시도해 주세요.");main=window.Handle;
        }
        if(main==IntPtr.Zero)throw new Exception("호출할 수 있는 백그라운드가 없습니다. Codex 아직 제출되지 않은 상태로 입구를 나가세요. 컴퓨터 쪽에서 정상적으로 종료해 주세요");
        check=()=>Check(process,started,operation,main);
        check();var root=AutomationElement.FromHandle(main);
        var condition=new PropertyCondition(AutomationElement.AutomationIdProperty,"application-menu-content");
        var content=Unique(root,condition,process.Id);
        var exit=content==null?null:FindQuit(content,process.Id);
        if(exit==null)throw new Exception("호출할 수 있는 백그라운드가 없습니다. Codex 아직 제출되지 않은 상태로 입구를 나가세요. 컴퓨터 쪽에서 정상적으로 종료해 주세요");
        object pattern;
        if(!exit.TryGetCurrentPattern(InvokePattern.Pattern,out pattern))throw new Exception("Codex 종료 메뉴는 일반 호출을 지원하지 않으며 종료가 아직 제출되지 않았습니다.");
        check();
        if(PendingDialog(Windows(process.Id))){operation.State="pending";operation.Reason="Codex 대기 중인 기본 대화상자";return;}
        var currentContent=Unique(AutomationElement.FromHandle(main),condition,process.Id);
        var current=currentContent==null?null:FindQuit(currentContent,process.Id);
        if(!IsWindowVisible(main)||current==null||!Automation.Compare(currentContent,content)||!Automation.Compare(current,exit))
            throw new Exception("Codex 종료 메뉴가 변경되었습니다. 종료가 아직 제출되지 않았습니다.");
        check();operation.Dispatch(process.Id,()=>((InvokePattern)pattern).Invoke());
        timer.Restart();
        while(timer.Elapsed.TotalSeconds<3) {
            operation.Check();
            if(process.HasExited){operation.State="exited";operation.Reason="Codex 정상적으로 종료됨";return;}
            if(!Owned(process,started))throw new Exception("Codex 메인 프로세스가 변경되어 종료 결과를 기다리고 있습니다.");
            if(PendingDialog(Windows(process.Id))){operation.State="pending";operation.Reason="Codex 기본 종료 확인을 기다리는 중입니다. 컴퓨터에서 확인하거나 취소하세요.";return;}
            Thread.Sleep(100);
        }
        operation.State="submitted";operation.Reason="요청됨 Codex 정상적으로 종료하고 저장 및 종료가 완료되기를 기다립니다.";
    }
    static void SelfCheck() {
        if(!QuitName("\u9000\u51fa Codex Ctrl+Q","")||!QuitName("\u9000\u51fa ChatGPT Ctrl+Q","")||!QuitName("Quit Codex","Ctrl+Q")||QuitName("Quit Codex","Alt+F4")||
            QuitName("Close Codex Ctrl+Q","")||QuitName("Quit Codex Ctrl+Q extra","")||QuitName("Quit Claude Ctrl+Q","")||QuitName("\u6ce8\u9500 Ctrl+Q",""))throw new Exception("quit selector failed");
        var cancelled=new Operation();cancelled.Cancel();int invoked=0;
        try{cancelled.Dispatch(0,()=>invoked++);}catch(OperationCanceledException){}
        if(invoked!=0||cancelled.Submitted)throw new Exception("cancel guard failed");
        Stage("Codex menu selectors and cancellation guards OK");
    }
    static int Main(string[] args) {
        Console.OutputEncoding=new UTF8Encoding(false);int pid=0;Operation operation=null;
        try {
            if(args.Length==1&&args[0]=="--self-check"){SelfCheck();return 0;}
            if((args.Length!=4&&args.Length!=5)||(args[1]!="--quit"&&args[1]!="--quit-zcode"))throw new Exception("Codex 잘못된 이탈 매개변수");
            tray=args[1]=="--quit-zcode";pid=Int32.Parse(args[0]);executable=Path.GetFullPath(args[2]);
            if(tray&&!String.Equals(Path.GetFileName(executable),"ZCode.exe",StringComparison.OrdinalIgnoreCase))throw new Exception("ZCode 프로그램 ID가 잘못되었습니다.");long expectedFileTime=Int64.Parse(args[3]);cancelFile=args.Length==5?args[4]:null;
            using(var process=Process.GetProcessById(pid)) {
                if(expectedFileTime<=0||process.StartTime.ToFileTimeUtc()!=expectedFileTime)throw new Exception("Codex 시작 ID가 변경되었으며 종료 요청이 중지되었습니다.");
                long started=process.StartTime.ToUniversalTime().Ticks;operation=new Operation();
                Check(process,started,operation,IntPtr.Zero);operation.Start(process,started);var timer=Stopwatch.StartNew();
                while(!operation.Finished&&timer.Elapsed.TotalSeconds<20) {
                    if(cancelFile!=null&&File.Exists(cancelFile)){operation.Cancel();break;}Thread.Sleep(50);
                }
                if(!operation.Finished) {operation.Cancel();throw new Exception("Codex 기본 종료 메뉴 작업이 취소되었거나 시간이 초과되었습니다.");}
                if(operation.Error!=null)throw operation.Error;
                Reply(operation.State,pid,operation.Reason);return 0;
            }
        } catch(Exception error) {
            bool submitted=operation!=null&&operation.Submitted;
            string reason=submitted?"Codex 종료 명령 수신이 중단되었습니다. 저장 및 종료가 완료되기를 기다리는 중입니다.":
                error is OperationCanceledException?"취소 Codex 종료":String.IsNullOrWhiteSpace(error.Message)?"Codex 기본 종료 메뉴를 사용할 수 없습니다. 컴퓨터에서 확인한 후 다시 시도해 주세요.":error.Message;
            Reply(submitted?"submitted":"failed",pid,reason);return submitted?0:1;
        }
    }
}
