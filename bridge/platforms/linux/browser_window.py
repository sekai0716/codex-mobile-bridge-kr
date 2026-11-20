"""Local, consented sharing of a single detached Codex web document on X11."""
import base64
import hashlib
import io
import json
import math
import os
import select
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit


def descendants(node, limit=2500):
    stack = [node]
    while stack and limit:
        item = stack.pop()
        limit -= 1
        if item is not None:
            yield item
            stack.extend(item.get_child_at_index(i) for i in reversed(range(min(item.get_child_count(), 256))))


def document_url(doc):
    attributes = doc.get_document_attributes() or {}
    value = attributes.get('URI') or attributes.get('DocURL') or ''
    return value if urlsplit(value).scheme in ('http', 'https') else ''


def page_documents(frame, ax):
    pending = [frame]
    budget = 2000
    while pending and budget:
        node = pending.pop()
        budget -= 1
        if node is None:
            continue
        if node.get_role() == ax.Role.DOCUMENT_WEB and document_url(node):
            yield node
            continue  # Embedded frames are part of the same displayed web page.
        pending.extend(node.get_child_at_index(i) for i in range(min(node.get_child_count(), 256)))


def window_identity(window, display):
    from Xlib.ext.res import LocalClientPIDMask
    def prop(name):
        value = window.get_full_property(display.intern_atom(name), 0)
        return value.value if value else None
    pid = int(prop('_NET_WM_PID')[0])
    # WM properties are supplied by the client. Verify the local connection
    # owner reported independently by the X server before accepting a window.
    if not display.has_extension('X-Resource'):
        raise ValueError('Cannot verify the browser window owner.')
    clients = display.res_query_client_ids([{'client':window.id,'mask':LocalClientPIDMask}]).ids
    if not any(entry.spec.mask & LocalClientPIDMask and list(entry.value) == [pid] for entry in clients):
        raise ValueError('Cannot verify the browser window owner.')
    proc = Path('/proc') / str(pid)
    title = bytes(prop('_NET_WM_NAME')).decode('utf-8')
    if (proc.stat().st_uid != os.getuid() or os.readlink(proc / 'exe') != '/usr/lib/chatgpt/ChatGPT'
            or 'chatgpt' not in [name.lower() for name in (window.get_wm_class() or ())]
            or not title.strip() or title.strip().split()[-1].lower() in ('chatgpt', 'codex')):
        raise ValueError('Select a detached Codex browser window.')
    return pid, (proc / 'stat').read_text().rsplit(')', 1)[1].split()[19], title


class BrowserWindow:
    def __init__(self, thread):
        from gi import require_version
        require_version('Atspi', '2.0')
        from gi.repository import Atspi
        from Xlib import X, display
        from PIL import Image
        self.X, self.ax, self.image = X, Atspi, Image
        self.display = display.Display()
        self.root = self.display.screen().root
        if not self.display.has_extension('Composite'):
            raise ValueError('This desktop cannot capture individual windows.')
        self.display.composite_query_version()
        windows = self.root.get_full_property(self.atom('_NET_CLIENT_LIST'), 0)
        choices = []
        for xid in windows.value if windows else ():
            w = self.display.create_resource_object('window', int(xid))
            try:
                identity = window_identity(w, self.display)
            except (AttributeError, IndexError, OSError, TypeError, ValueError):
                continue
            choices.append((w, identity))
        if not choices:
            raise ValueError('Move the Codex browser tab to a new window on the PC first.')
        args = ['/usr/bin/zenity', '--list', '--title=Codex Bridge',
                '--text=Share a detached browser page with the paired device for chat ' + thread
                + '? The device can view this page and request control until sharing ends.',
                '--column=ID', '--column=Browser window', '--hide-column=1', '--print-column=1', '--']
        for index, (_, identity) in enumerate(choices):
            args.extend([str(index), identity[2]])
        picked = subprocess.run(args, capture_output=True, text=True, timeout=85).stdout.strip()
        if not picked.isdecimal() or int(picked) >= len(choices):
            raise ValueError('Sharing was cancelled on the PC.')
        self.window, self.identity = choices[int(picked)]
        self.window.change_attributes(event_mask=X.StructureNotifyMask)
        wid = str(self.window.id)
        for options in (['-b', 'add,maximized_vert,maximized_horz'], ['-a']):
            cmd = (['-ir', wid] + options if options[0] == '-b' else ['-ia', wid])
            subprocess.run(['/usr/bin/wmctrl', *cmd], check=True, timeout=3, stdout=subprocess.DEVNULL)
        for _ in range(30):
            states = self.window.get_full_property(self.atom('_NET_WM_STATE'), 0)
            if states and all(self.atom('_NET_WM_STATE_MAXIMIZED_' + k) in states.value for k in ('VERT','HORZ')):
                break
            time.sleep(.1)
        else:
            raise ValueError('The selected browser window could not be maximized.')
        self.frame = None
        self.drag_active = False
        self.check_window()
        apps = Atspi.get_desktop(0)
        docs = []
        for i in range(apps.get_child_count()):
            app = apps.get_child_at_index(i)
            if not app or app.get_process_id() != self.identity[0]:
                continue
            for j in range(app.get_child_count()):
                frame = app.get_child_at_index(j)
                if not frame or frame.get_name() != self.identity[2]:
                    continue
                docs.extend(page_documents(frame, Atspi))
        if len(docs) != 1:
            raise ValueError('A single browser page could not be identified in the selected window.')
        self.doc = docs[0]
        self.url = document_url(self.doc)
        self.bounds()

    def atom(self, name):
        return self.display.intern_atom(name)

    def check_window(self):
        while not self.drag_active and self.display.pending_events():
            if self.display.next_event().type == self.X.DestroyNotify:
                raise ValueError('The shared browser window was closed.')
        active = self.root.get_full_property(self.atom('_NET_ACTIVE_WINDOW'), 0)
        if (not active or int(active.value[0]) != self.window.id
                or window_identity(self.window, self.display) != self.identity
                or self.window.get_attributes().map_state != self.X.IsViewable):
            raise ValueError('The shared browser window changed or lost focus.')

    def bounds(self):
        self.check_window()
        self.doc.clear_cache_single()
        states = self.doc.get_state_set()
        if (document_url(self.doc) != self.url or states.contains(self.ax.StateType.DEFUNCT)
                or not states.contains(self.ax.StateType.SHOWING)):
            raise ValueError('The shared browser page changed.')
        area = self.doc.get_extents(self.ax.CoordType.SCREEN)
        origin = self.root.translate_coords(self.window, 0, 0)
        geom = self.window.get_geometry()
        x, y = area.x - origin.x, area.y - origin.y
        if (x < 0 or y < 0 or area.width < 1 or area.height < 1 or x + area.width > geom.width
                or y + area.height > geom.height or area.width * area.height > 16000000):
            raise ValueError('The browser page bounds could not be verified.')
        return (x, y, area.width, area.height, origin.x, origin.y)

    def capture(self):
        x, y, w, h, ox, oy = bounds = self.bounds()
        self.require_uncovered((ox+x, oy+y, w, h))
        pixmap = self.window.composite_name_window_pixmap()
        try:
            raw = pixmap.get_image(x, y, w, h, self.X.ZPixmap, 0xffffffff)
        finally:
            pixmap.free()
        if (not raw or raw.depth not in (24, 32) or len(raw.data) != w*h*4
                or self.display.display.info.image_byte_order != self.X.LSBFirst):
            raise ValueError('Unsupported window pixel format.')
        if bounds != self.bounds():
            raise ValueError('The browser page moved.')
        return bounds, raw.data

    def require_uncovered(self, area):
        """Ignore the WM frame, but reject mapped sibling windows above it."""
        X, (x,y,w,h) = self.X, area
        frame = self.window
        while True:
            parent = frame.query_tree().parent
            if parent.id == self.root.id:
                break
            frame = parent
        stack = self.root.query_tree().children
        above = stack[next(i for i,other in enumerate(stack) if other.id == frame.id)+1:]
        for other in above:
            attr = other.get_attributes()
            if attr.map_state != X.IsViewable or attr.win_class == X.InputOnly:
                continue
            rect = other.get_geometry()
            if min(x+w,rect.x+rect.width)>max(x,rect.x) and min(y+h,rect.y+rect.height)>max(y,rect.y):
                raise ValueError('The browser page is covered.')

    def pointer(self, x, y, button, count):
        from Xlib.ext import xtest
        d, X = self.display, self.X
        d.grab_server()
        try:
            self.check_window()
            if self.root.query_pointer().mask & (X.ShiftMask|X.ControlMask|X.Mod1Mask|X.Mod4Mask|
                                                 X.Button1Mask|X.Button2Mask|X.Button3Mask):
                raise ValueError('The browser input is in use on the PC.')
            focus = d.get_input_focus().focus
            if not self.belongs(focus):
                raise ValueError('Browser input focus changed.')
            xtest.fake_input(d, X.MotionNotify, x=x, y=y)
            d.sync()
            target = self.root
            while getattr(target, 'id', None):
                child = target.query_pointer().child
                if not getattr(child, 'id', None):
                    break
                target = child
            if not self.belongs(target):
                raise ValueError('The browser page is covered.')
            for _ in range(count):
                xtest.fake_input(d, X.ButtonPress, button)
                xtest.fake_input(d, X.ButtonRelease, button)
            d.sync()
        finally:
            d.ungrab_server()
            d.flush()

    def belongs(self, window):
        while getattr(window, 'id', None) and window.id != self.root.id:
            if window.id == self.window.id:
                return True
            window = window.query_tree().parent
        return False

    def drop_text(self, field, text):
        """Chromium exposes HTML inputs as Text, but often omits EditableText.

        Deliver UTF-8 using the target window's native drag-and-drop protocol.
        This never takes ownership of the user's clipboard or sends key events.
        """
        from Xlib.protocol import event
        d, X = self.display, self.X
        selection = self.atom('XdndSelection')
        if d.get_selection_owner(selection) or not d.has_extension('X-Resource'):
            return False
        client = next((c for c in d.res_query_clients().clients
                       if self.window.id & ~c.resource_mask == c.resource_base), None)
        if client is None:
            return False
        x, y, w, h, ox, oy = self.bounds()
        field_rect = field.get_extents(self.ax.CoordType.SCREEN)
        px, py = field_rect.x+field_rect.width//2, field_rect.y+field_rect.height//2
        if not (ox+x <= px < ox+x+w and oy+y <= py < oy+y+h):
            return False
        types = [self.atom(k) for k in ('text/plain;charset=utf-8','UTF8_STRING','text/plain')]
        source = self.root.create_window(0,0,1,1,0,0,X.InputOnly,X.CopyFromParent)
        def message(name, data):
            self.window.send_event(event.ClientMessage(window=self.window, client_type=self.atom(name),
                                                       data=(32,[source.id,*data])))
            d.flush()
        entered = dropped = delivered = False
        try:
            self.drag_active = True
            source.change_property(self.atom('XdndActionList'),self.atom('ATOM'),32,[self.atom('XdndActionCopy')])
            source.change_property(self.atom('XdndTypeList'),self.atom('ATOM'),32,types)
            source.change_property(self.atom('XdndAware'),self.atom('ATOM'),32,[5])
            source.set_selection_owner(selection,X.CurrentTime)
            if getattr(d.get_selection_owner(selection),'id',None) != source.id:
                return False
            message('XdndEnter',[5<<24,*types])
            entered = True
            message('XdndPosition',[0,(px<<16)|(py&0xffff),X.CurrentTime,self.atom('XdndActionCopy')])
            deadline = time.monotonic()+2
            positions = 1
            while time.monotonic() < deadline:
                if not d.pending_events() and not select.select([d.fileno()],[],[],max(0,deadline-time.monotonic()))[0]:
                    break
                ev = d.next_event()
                if ev.type == X.DestroyNotify:
                    raise ValueError('The shared browser window was closed.')
                if ev.type == X.ClientMessage and ev.data[1][0] == self.window.id:
                    if ev.client_type == self.atom('XdndStatus') and not dropped:
                        if not ev.data[1][1] & 1:
                            if positions < 3:
                                positions += 1
                                message('XdndPosition',[0,(px<<16)|(py&0xffff),X.CurrentTime,self.atom('XdndActionCopy')])
                                continue
                            return False
                        self.bounds()
                        field.clear_cache()
                        if not field.get_state_set().contains(self.ax.StateType.FOCUSED):
                            return False
                        message('XdndDrop',[0,X.CurrentTime,0,0])
                        dropped = True
                    elif ev.client_type == self.atom('XdndFinished'):
                        return delivered and bool(ev.data[1][1]&1)
                elif ev.type == X.SelectionRequest:
                    prop = 0
                    if (ev.selection == selection and ev.property and ev.target in types
                            and ev.requestor.id & ~client.resource_mask == client.resource_base):
                        self.bounds()
                        ev.requestor.change_property(ev.property,ev.target,8,text.encode('utf-8'))
                        prop, delivered = ev.property, True
                    ev.requestor.send_event(event.SelectionNotify(time=ev.time,requestor=ev.requestor,
                                             selection=ev.selection,target=ev.target,property=prop))
                    d.flush()
            return None if dropped and delivered else False
        finally:
            self.drag_active = False
            if entered and not dropped:
                message('XdndLeave',[0,0,0,0])
            source.destroy()
            d.flush()

    def execute(self, body):
        bounds, pixels = self.capture()
        x, y, w, h, ox, oy = bounds
        digest = hashlib.sha256(pixels).digest()
        op = body['op']
        if op == 'frame':
            out = io.BytesIO()
            self.image.frombytes('RGB', (w,h), pixels, 'raw','BGRX').save(out, 'JPEG', quality=85)
            self.frame = bounds, digest, time.monotonic()
            return {'width':w, 'height':h, 'jpeg':base64.b64encode(out.getvalue()).decode('ascii')}
        last, self.frame = self.frame, None
        if not last or last[:2] != (bounds, digest) or time.monotonic()-last[2] > 5:
            return {'stale':True}
        if op == 'text':
            text = body['text']
            self.doc.clear_cache()
            fields = [n for n in descendants(self.doc) if n.get_state_set().contains(self.ax.StateType.FOCUSED)
                      and n.get_state_set().contains(self.ax.StateType.EDITABLE)]
            if len(fields) != 1:
                return {'inputUnavailable':True}
            field = fields[0]
            self.check_window()
            if field.get_editable_text_iface():
                inserted = (not field.get_n_selections() and
                            self.ax.EditableText.insert_text(field, field.get_caret_offset(), text, len(text.encode())))
            else:
                inserted = self.drop_text(field, text)
            if inserted is None:
                return {'inputUnconfirmed':True}
            if not inserted:
                return {'inputUnavailable':True}
        else:
            px = ox+x+min(w-1, math.floor(body['x']*w))
            py = oy+y+min(h-1, math.floor(body['y']*h))
            self.pointer(px, py, 1 if op == 'click' else (4 if body['delta'] < 0 else 5),
                         1 if op == 'click' else min(6, abs(body['delta'])))
        return {'applied':True}


def emit(value):
    print(json.dumps(value, separators=(',', ':')), flush=True)


if __name__ == '__main__':
    try:
        browser = BrowserWindow(sys.argv[1])
        emit({'ready':True})
        for line in sys.stdin:
            emit(browser.execute(json.loads(line)))
    except ValueError as error:
        emit({'error':str(error)})
    except Exception:
        emit({'error':'Browser sharing is unavailable. Check the PC window and accessibility permissions.'})
