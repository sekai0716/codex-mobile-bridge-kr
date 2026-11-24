import contextlib
import io
import http.client
import json
import os
import shutil
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from bridge.features.workspace.workspace import Workspace, GitWorkspace, git_project, operate, MAX_PREVIEW
from bridge.app.service import Bridge
from bridge.clients.codex.remote import RemoteStore
import test_bridge as support


class GitWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=support.ROOT / '.tmp')
        self.root = Path(self.temp.name) / 'project'; self.root.mkdir()
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.name', 'Fixture'); self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'commit.gpgsign', 'false'); self.git('config', 'core.hooksPath', '.git/hooks')
        self.work = Workspace(self.root)

    def tearDown(self): self.temp.cleanup()
    def git(self, *args, check=True):
        return subprocess.run(['git', *args], cwd=self.root, env={**os.environ, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': os.devnull}, capture_output=True, check=check)
    def status(self): return GitWorkspace(self.work).status()
    def diff(self, path, section): return GitWorkspace(self.work).diff(path, section)
    def baseline(self):
        (self.root / 'hello.txt').write_text('first\nsecond\n')
        self.git('add', '.'); self.git('commit', '-qm', 'fixture baseline')

    def test_repository_picker_uses_selected_checkout_for_status_history_and_diff(self):
        self.baseline()
        second = self.root.parent / 'second'
        shutil.copytree(self.root, second)
        parent = self.root.parent
        self.assertFalse(operate(parent, 'git-status', {})['available'])
        repositories = operate(parent, 'git-repositories', {})['repositories']
        self.assertEqual([row['path'] for row in repositories], ['project', 'second'])
        (self.root / 'hello.txt').write_text('first repository changed\n')
        (second / 'hello.txt').write_text('second repository changed\n')
        for selected, expected in [('project', 'first repository changed'), ('second', 'second repository changed')]:
            state = operate(parent, 'git-status', {'repository': selected})
            self.assertTrue(state['available']); self.assertEqual(state['project'], selected)
            self.assertEqual([row['path'] for row in state['entries']], ['hello.txt'])
            diff = operate(parent, 'git-diff', {'repository': selected, 'path': 'hello.txt', 'section': 'unstaged'})
            self.assertIn('+' + expected, diff['text'])
            history = operate(parent, 'git-history', {'repository': selected})
            detail = operate(parent, 'git-commit', {'repository': selected, 'revision': history['commits'][0]['id']})
            self.assertEqual(detail['message'].strip(), 'fixture baseline')
        before_second = GitWorkspace(Workspace(second)).status()
        state = operate(parent, 'git-status', {'repository': 'project'})
        operate(parent, 'git-action', {'repository': 'project', 'action': 'stage-all', 'version': state['version']})
        self.assertEqual(operate(parent, 'git-status', {'repository': 'project'})['entries'][0]['index'], 'M')
        self.assertEqual(GitWorkspace(Workspace(second)).status(), before_second)

    def test_partial_changes_preserve_other_blocks_index_files_and_review_snapshot(self):
        folder = self.root / 'nested'; folder.mkdir()
        name = '변경 파일.txt'; target = folder / name
        lines = ['line %d\n' % i for i in range(70)]
        target.write_text(''.join(lines)); other = self.root / 'other.txt'; other.write_text('original\n')
        self.git('add', '.'); self.git('commit', '-qm', 'initial files')
        lines[55] = 'already staged\n'; target.write_text(''.join(lines)); self.git('add', '.')
        staged = lines.copy()
        lines[8] = 'first edit\n'; lines[35] = 'second edit\n'; target.write_text(''.join(lines)); other.write_text('unrelated edit\n')
        def preview(section): return operate(folder, 'git-diff', {'path': name, 'section': section})
        def apply(action, diff, which):
            return operate(folder, 'git-action', {'action': action, 'path': name, 'version': diff['version'], 'hunk': diff['hunks'][which]})
        def index_text(): return self.git('show', ':nested/' + name).stdout.decode()
        first = preview('unstaged')
        self.assertEqual(len(first['hunks']), 2)
        apply('stage-hunk', first, 1); staged[35] = lines[35]
        self.assertEqual(index_text(), ''.join(staged)); self.assertEqual(target.read_text(), ''.join(lines))
        with self.assertRaises(ValueError): apply('stage-hunk', first, 0)
        apply('unstage-hunk', preview('staged'), 0); staged[35] = 'line 35\n'
        self.assertEqual(index_text(), ''.join(staged)); self.assertEqual(target.read_text(), ''.join(lines))
        before = preview('unstaged'); lines[35] = 'external edit\n'; target.write_text(''.join(lines))
        with self.assertRaises(ValueError): apply('discard-hunk', before, 1)
        self.assertEqual(index_text(), ''.join(staged)); self.assertEqual(target.read_text(), ''.join(lines))
        apply('discard-hunk', preview('unstaged'), 0); lines[8] = 'line 8\n'
        self.assertEqual(index_text(), ''.join(staged)); self.assertEqual(target.read_text(), ''.join(lines))
        self.assertEqual(other.read_text(), 'unrelated edit\n'); self.assertEqual(self.git('show', ':other.txt').stdout, b'original\n')

    def test_partial_changes_reject_ambiguous_stale_and_unapplicable_patches(self):
        target = self.root / 'repeat.txt'; section = ['same %d\n' % i for i in range(15)]
        initial = section * 3; target.write_text(''.join(initial))
        self.git('add', '.'); self.git('commit', '-qm', 'repeated contexts')
        modified = initial[:]; modified[7] = modified[22] = 'edit\n'
        target.write_text(''.join(modified))
        self.assertEqual(self.diff(target.name, 'unstaged')['hunks'], [None, None])
        modified[22] = 'distinct edit\n'; target.write_text(''.join(modified))
        diff = self.diff(target.name, 'unstaged')
        params = {'action':'stage-hunk','path':target.name,'version':diff['version'],'hunk':diff['hunks'][0]}
        with self.assertRaises(ValueError): operate(self.root,'git-action',{**params,'hunk':'f'*64})
        # Native Git cannot acquire the index lock. No other part of this patch
        # can be written and the browser must obtain a fresh diff before retry.
        lock = self.root / '.git/index.lock'; lock.touch()
        try:
            with self.assertRaises(ValueError): operate(self.root,'git-action',params)
        finally: lock.unlink()
        self.assertEqual(target.read_text(), ''.join(modified)); self.assertEqual(self.git('show', ':'+target.name).stdout.decode(), ''.join(initial))
        self.git('add', '.')
        with self.assertRaises(ValueError): operate(self.root,'git-action',params)
        self.assertEqual(self.git('show', ':'+target.name).stdout.decode(), ''.join(modified))

    def test_partial_discard_does_not_normalize_unselected_line_endings(self):
        self.git('config','core.autocrlf','true')
        target=self.root/'mixed.txt'; lines=[b'%d\r\n'%i for i in range(50)]
        target.write_bytes(b''.join(lines));self.git('add','.');self.git('commit','-qm','consistent CRLF')
        lines[3]=b'first\r\n';lines[37]=b'second\n';target.write_bytes(b''.join(lines))
        diff=self.diff(target.name,'unstaged');self.assertEqual(len(diff['hunks']),2)
        self.assertFalse(diff['canDiscardHunk'])
        with self.assertRaises(ValueError):
            operate(self.root,'git-action',{'action':'discard-hunk','path':target.name,'version':diff['version'],'hunk':diff['hunks'][0]})
        self.assertEqual(target.read_bytes(),b''.join(lines))
        operate(self.root,'git-action',{'action':'stage-hunk','path':target.name,'version':diff['version'],'hunk':diff['hunks'][0]})
        self.assertEqual(target.read_bytes(),b''.join(lines))

    def test_repository_versions_cannot_be_replayed_against_an_identical_checkout(self):
        self.baseline()
        second = self.root.parent / 'second'; shutil.copytree(self.root, second)
        parent = self.root.parent
        first = operate(parent, 'git-status', {'repository': 'project'})
        other = operate(parent, 'git-status', {'repository': 'second'})
        self.assertNotEqual(first['version'], other['version'])
        with self.assertRaises(ValueError):
            operate(parent, 'git-action', {'repository': 'second', 'action': 'stage-all', 'version': first['version']})
        self.assertEqual(operate(parent, 'git-status', {'repository': 'second'})['entries'], [])

    def test_repository_selection_rejects_escape_metadata_and_symlink_targets(self):
        self.baseline(); parent = self.root.parent
        outside = parent / 'outside'; outside.mkdir()
        (outside / 'private.txt').write_text('private')
        (parent / 'linked').symlink_to(outside, target_is_directory=True)
        self.assertEqual([row['path'] for row in operate(parent, 'git-repositories', {})['repositories']], ['project'])
        for selected in ['../outside', str(outside), 'project/.git', 'linked', 'project/../outside']:
            with self.subTest(selected=selected), self.assertRaises((ValueError, PermissionError, OSError)):
                operate(parent, 'git-status', {'repository': selected})

    @unittest.skipUnless(os.name == 'posix', 'directory handles are a POSIX boundary')
    def test_selected_git_directory_stays_bound_when_its_path_is_replaced(self):
        self.baseline(); parent = self.root.parent
        outside = parent / 'outside'; outside.mkdir(); (outside / 'hello.txt').write_text('outside private bytes')
        held = parent / 'held'
        with git_project(Workspace(parent), 'project') as selected:
            self.root.rename(held)
            self.root.symlink_to(outside, target_is_directory=True)
            try:
                self.assertEqual(selected.run(['show', 'HEAD:hello.txt'])[1], b'first\nsecond\n')
                self.assertEqual(selected.working('hello.txt'), b'first\nsecond\n')
            finally:
                self.root.unlink(); held.rename(self.root)

    def test_unborn_clean_and_detached(self):
        self.assertEqual(self.status()['commit'], '(initial)')
        (self.root / 'new.txt').write_text('new\n'); self.git('add', '.')
        self.assertIn('+new', self.diff('new.txt', 'staged')['text'])
        self.git('commit', '-qm', 'first')
        self.assertEqual(self.status()['entries'], [])
        self.git('checkout', '-q', '--detach')
        self.assertEqual(self.status()['branch'], '(detached)')

    def test_staged_unstaged_and_read_only_index(self):
        self.baseline(); target = self.root / 'hello.txt'
        target.write_text('staged\nsecond\n'); self.git('add', '.')
        target.write_text('working\nsecond\n')
        before = (self.root / '.git/index').read_bytes()
        self.assertEqual(self.status()['entries'][0]['index'], 'M')
        self.assertEqual(self.status()['entries'][0]['worktree'], 'M')
        self.assertIn('+staged', self.diff('hello.txt', 'staged')['text'])
        self.assertNotIn('+working', self.diff('hello.txt', 'staged')['text'])
        self.assertIn('-staged', self.diff('hello.txt', 'unstaged')['text'])
        self.assertIn('+working', self.diff('hello.txt', 'unstaged')['text'])
        self.assertEqual(before, (self.root / '.git/index').read_bytes())

    def test_untracked_ignored_binary_large_and_no_newline(self):
        self.baseline(); (self.root / '.gitignore').write_text('ignored.txt\n'); (self.root / 'ignored.txt').write_text('private')
        name = '중국어 [x].txt' if os.name == 'nt' else '중국어 [x]*.txt'
        (self.root / name).write_text('<img src=x>')
        self.assertIn('+<img src=x>\n\\ No newline', self.diff(name, 'untracked')['text'])
        self.assertNotIn('ignored.txt', [e['path'] for e in self.status()['entries']])
        with self.assertRaises(ValueError): self.diff('ignored.txt', 'untracked')
        (self.root / 'binary').write_bytes(b'\x00\xff')
        self.assertEqual(self.diff('binary', 'untracked')['kind'], 'binary')
        (self.root / 'big').write_bytes(b'a' * (MAX_PREVIEW + 1))
        self.assertEqual(self.diff('big', 'untracked')['kind'], 'large')
        self.git('add', 'big')
        self.assertEqual(self.diff('big', 'staged')['kind'], 'large')

    def test_rename_delete_and_intent_to_add(self):
        self.baseline(); self.git('mv', 'hello.txt', 'renamed.txt')
        entry = self.status()['entries'][0]; self.assertEqual(entry['oldPath'], 'hello.txt')
        self.assertTrue(self.diff('renamed.txt', 'staged')['metadataOnly'])
        (self.root / 'renamed.txt').unlink()
        self.assertIn('-first', self.diff('renamed.txt', 'unstaged')['text'])
        (self.root / 'intent.txt').write_text('intent\n'); self.git('add', '-N', 'intent.txt')
        self.assertIn('+intent', self.diff('intent.txt', 'unstaged')['text'])

    def test_project_subdirectory_scope_and_inherited_git_environment(self):
        self.baseline(); (self.root / 'nested').mkdir(); (self.root / 'nested/file.txt').write_text('nested\n')
        self.git('add', '.'); self.git('commit', '-qm', 'nested')
        (self.root / 'hello.txt').write_text('outside\n'); (self.root / 'nested/file.txt').write_text('inside\n')
        nested = GitWorkspace(Workspace(self.root / 'nested'))
        state = nested.status(); self.assertEqual([e['path'] for e in state['entries']], ['file.txt'])
        self.assertIn('+inside', nested.diff('file.txt', 'unstaged')['text'])
        for path in ('../hello.txt', '/etc/passwd', 'file.txt/../../hello.txt'):
            with self.assertRaises((ValueError, PermissionError)): nested.diff(path, 'unstaged')
        with patch.dict(os.environ, {'GIT_DIR': '/nonexistent', 'GIT_WORK_TREE': '/nonexistent'}):
            self.assertTrue(self.status()['available'])

    def test_conflicts_and_symlink_boundary(self):
        self.baseline(); self.git('checkout', '-qb', 'other'); (self.root / 'hello.txt').write_text('other\n'); self.git('commit', '-qam', 'other')
        self.git('checkout', '-q', 'main'); (self.root / 'hello.txt').write_text('main\n'); self.git('commit', '-qam', 'main')
        self.git('merge', 'other', check=False)
        self.assertTrue(self.status()['entries'][0]['conflict'])
        self.assertIn('<<<<<<<', self.diff('hello.txt', 'conflict')['text'])
        with self.assertRaises(ValueError): self.diff('hello.txt', 'staged')
        (self.root / 'external').symlink_to(self.root.parent / 'private.txt')
        (self.root.parent / 'private.txt').write_text('secret')
        with self.assertRaises((ValueError, OSError)): self.diff('external', 'untracked')

    def test_configured_filters_are_not_executed(self):
        self.baseline(); marker = self.root / 'filter-ran'
        (self.root / '.gitattributes').write_text('hello.txt filter=fixture\n')
        self.git('config', 'filter.fixture.clean', 'touch filter-ran; cat')
        self.git('config', 'filter.fixture.required', 'true')
        (self.root / 'hello.txt').write_text('changed content\n')
        self.status(); self.diff('hello.txt', 'unstaged')
        self.assertFalse(marker.exists())
        self.assertEqual(self.git('config', 'filter.fixture.required').stdout.strip(), b'true')

    def test_nonrepo_and_missing_git(self):
        plain = Path(self.temp.name) / 'plain'; plain.mkdir()
        # Stop discovery at this fixture rather than finding the enclosing source repo.
        subprocess.run(['git', 'init', '--bare', '-q', str(plain)], check=True)
        self.assertFalse(GitWorkspace(Workspace(plain)).status()['available'])
        with patch('bridge.features.workspace.workspace.subprocess.Popen', side_effect=FileNotFoundError):
            with self.assertRaisesRegex(ValueError, "이\\ 컴퓨터나\\ SSH\\ 서버가\\ 설치되지\\ 않았습니다\\ Git"): self.status()

    def test_remote_routing_does_not_activate_owner(self):
        self.baseline(); (self.root / 'hello.txt').write_text('remote change\n')
        store = RemoteStore('fixture-host'); store.get = lambda _: {'cwd': str(self.root)}
        bridge = SimpleNamespace(host='remote:fixture', local=False, store=store)
        def execute(alias, source, timeout):
            self.assertEqual(alias, 'fixture-host'); output = io.StringIO()
            with contextlib.redirect_stdout(output): exec(compile(source, '<remote-git>', 'exec'), {})
            return json.loads(output.getvalue())
        with patch('bridge.app.service.ssh_read', side_effect=execute):
            self.assertEqual(Bridge.workspace(bridge, support.THREAD, 'git-status', {})['branch'], 'main')
            self.assertIn('+remote change', Bridge.workspace(bridge, support.THREAD, 'git-diff', {'path': 'hello.txt', 'section': 'unstaged'})['text'])

    def mutate(self, action, **params):
        return GitWorkspace(self.work).mutate(action, self.status()['version'], **params)

    def test_management_staging_commit_preserves_unstaged_content(self):
        self.baseline(); path = self.root / 'hello.txt'; path.write_text('staged version\n')
        self.mutate('stage', path='hello.txt'); path.write_text('later working version\n')
        snapshot = self.status()['version']
        result = GitWorkspace(self.work).mutate('commit', snapshot, message='Commit staged content')
        self.assertEqual(result['outcome'], 'success')
        self.assertEqual(self.git('show', 'HEAD:hello.txt').stdout, os.linesep.join(['staged version', '']).encode())
        self.assertEqual(path.read_text(), 'later working version\n')
        self.assertEqual(self.status()['entries'][0]['worktree'], 'M')
        with self.assertRaisesRegex(ValueError, "창고가\\ 변경되었습니다\\.\\ 새로고침\\ 후\\ 확인\\ 후\\ 다시\\ 운영하시기\\ 바랍니다\\."):
            GitWorkspace(self.work).mutate('commit', snapshot, message='Do not duplicate')
        self.assertEqual(self.git('rev-list', '--count', 'HEAD').stdout.strip(), b'2')
        self.mutate('stage-all'); self.mutate('unstage-all')
        self.assertEqual(self.git('diff', '--cached').stdout, b'')

    def test_management_unborn_unstage_and_deleted_directory(self):
        (self.root / 'new.txt').write_text('first')
        self.mutate('stage', path='new.txt'); (self.root / 'new.txt').write_text('second')
        self.mutate('unstage', path='new.txt')
        self.assertEqual((self.root / 'new.txt').read_text(), 'second')
        self.mutate('stage-all'); self.mutate('commit', message='First commit')
        (self.root / 'folder').mkdir(); (self.root / 'folder/a.txt').write_text('file')
        self.mutate('stage-all'); self.mutate('commit', message='Folder')
        (self.root / 'folder/a.txt').unlink(); (self.root / 'folder').rmdir()
        # Exercise the Windows path-walking fallback on every CI platform.
        with patch('bridge.features.workspace.workspace.os.supports_dir_fd', set()):
            self.mutate('stage', path='folder/a.txt')
        self.assertEqual(self.status()['entries'][0]['index'], 'D')

    def test_management_rejects_stale_state_and_dirty_branch_switch(self):
        self.baseline(); self.mutate('create-branch', branch='feature/demo')
        self.assertEqual(self.status()['branch'], 'feature/demo')
        path = self.root / 'hello.txt'; path.write_text('one')
        stale = self.status()['version']; path.write_text('two changed')
        with self.assertRaisesRegex(ValueError, "창고가\\ 변경되었습니다\\.\\ 새로고침\\ 후\\ 확인\\ 후\\ 다시\\ 운영하시기\\ 바랍니다\\."):
            GitWorkspace(self.work).mutate('stage', stale, path='hello.txt')
        with self.assertRaisesRegex(ValueError, "지점을\\ 운영하기\\ 전에\\ 커밋되지\\ 않은\\ 변경\\ 사항을\\ 컴퓨터에\\ 제출하거나\\ 저장하세요\\."):
            self.mutate('switch-branch', branch='main')
        self.assertEqual(path.read_text(), 'two changed')
        with self.assertRaises(ValueError): self.mutate('reset', branch='main')

    def test_management_merge_conflict_abort_and_resolved_commit(self):
        self.baseline(); self.mutate('create-branch', branch='feature/demo')
        (self.root / 'hello.txt').write_text('feature\n'); self.mutate('stage-all'); self.mutate('commit', message='Feature')
        self.mutate('switch-branch', branch='main')
        (self.root / 'hello.txt').write_text('main\n'); self.mutate('stage-all'); self.mutate('commit', message='Main')
        result = self.mutate('merge', branch='feature/demo')
        self.assertEqual(result['outcome'], 'conflict'); self.assertEqual(self.status()['operation'], 'merge')
        with self.assertRaisesRegex(ValueError, "충돌을\\ 해결하고\\ 먼저\\ 파일을\\ 준비하십시오\\."): self.mutate('commit', message='Cannot commit unresolved conflict')
        self.mutate('abort-merge'); self.assertEqual((self.root / 'hello.txt').read_text(), 'main\n')
        self.assertIsNone(self.status()['operation'])
        self.mutate('merge', branch='feature/demo'); (self.root / 'hello.txt').write_text('main\n')
        self.mutate('stage-all'); self.assertEqual(self.status()['entries'], [])
        self.mutate('commit', message='Resolve merge while retaining current content')
        self.assertIsNone(self.status()['operation'])
        self.assertEqual(len(self.git('show', '-s', '--format=%P', 'HEAD').stdout.split()), 2)

    def test_history_graph_details_and_first_parent_merge_diff(self):
        self.baseline(); initial = self.git('rev-parse', 'HEAD').stdout.decode().strip()
        self.mutate('create-branch', branch='feature/demo')
        (self.root / 'feature.txt').write_text('feature\n'); self.mutate('stage-all'); self.mutate('commit', message='Feature work')
        self.mutate('switch-branch', branch='main')
        (self.root / 'main.txt').write_text('main\n'); self.mutate('stage-all'); self.mutate('commit', message='Main work')
        self.mutate('merge', branch='feature/demo'); self.git('tag', 'fixture-v1')
        work = GitWorkspace(self.work); history = work.history(limit=2)
        self.assertEqual(len(history['commits']), 2); self.assertTrue(history['hasMore'])
        tip = history['commits'][0]; self.assertEqual(len(tip['parents']), 2); self.assertIn('fixture-v1', tip['refs'])
        self.assertEqual({c['id'] for c in work.history(limit=40)['commits']}, set(self.git('rev-list', '--all').stdout.decode().split()))
        detail = work.commit_detail(tip['id']); self.assertEqual([e['path'] for e in detail['entries']], ['feature.txt'])
        self.assertIn('+feature', work.historical_diff(tip['id'], 'feature.txt')['text'])
        self.assertIn('+first', work.historical_diff(initial, 'hello.txt')['text'])
        with self.assertRaises(ValueError): work.historical_diff(tip['id'], 'hello.txt')
        with self.assertRaises(ValueError): work.commit_detail('--all')
        self.assertEqual(len(work.branches()['branches']), 2)

    def test_history_remains_available_when_worktree_status_exceeds_output_limit(self):
        self.baseline()
        (self.root / 'hello.txt').write_text('second\n')
        self.git('add', 'hello.txt'); self.git('commit', '-qm', 'second commit')
        directory = self.root / 'untracked'
        directory.mkdir()
        for index in range(23000):
            (directory / (f'{index:05d}-' + 'x' * 80)).write_text('untracked\n')

        work = GitWorkspace(self.work)
        code, _, truncated = work.run(['status', '--porcelain=v2', '--branch', '-z',
                                       '--untracked-files=all', '--renames',
                                       '--ignore-submodules=dirty', '--', '.'])
        self.assertTrue(truncated, 'fixture reproduces the oversized change-list condition')
        history = work.history(limit=1)
        self.assertEqual(len(history['commits']), 1)
        self.assertTrue(history['hasMore'])
        self.assertEqual(work.commit_detail(history['commits'][0]['id'])['id'], history['commits'][0]['id'])

    def test_management_subdirectory_cannot_commit_other_project_files(self):
        self.baseline(); (self.root / 'nested').mkdir(); (self.root / 'nested/a.txt').write_text('nested')
        self.git('add', 'hello.txt'); (self.root / 'hello.txt').write_text('outside'); self.git('add', 'hello.txt')
        nested = GitWorkspace(Workspace(self.root / 'nested'))
        state = nested.status(); nested.mutate('stage-all', state['version'])
        with self.assertRaisesRegex(ValueError, "이\\ 작업은\\ 전체\\ 창고에\\ 영향을\\ 미칩니다\\.\\ 창고의\\ 루트디렉토리에\\ 해당하는\\ 채팅에서\\ 작업해주세요\\."):
            nested.mutate('commit', nested.status()['version'], message='Do not include outside files')
        self.assertIn(b'hello.txt', self.git('diff', '--cached', '--name-only').stdout)
        self.assertEqual(self.git('rev-list', '--count', 'HEAD').stdout.strip(), b'1')

    def test_management_commit_hooks_are_respected_and_failures_keep_index(self):
        self.baseline(); hook = self.root / '.git/hooks/pre-commit'
        hook.write_text('#!/bin/sh\nexit 1\n'); hook.chmod(0o700)
        (self.root / 'hello.txt').write_text('pending'); self.mutate('stage-all')
        with self.assertRaisesRegex(ValueError, "Git\\ 작업이\\ 완료되지\\ 않았거나\\ 결과가\\ 확인되지\\ 않았습니다\\.\\ 상태와\\ 기록을\\ 새로\\ 고치십시오\\.\\ 변경\\ 사항이\\ 없으면\\ 컴퓨터에서\\ 확인하세요\\.\\ Git\\ 신원,\\ 서명、hooks\\ 아니면\\ 창고를\\ 잠근\\ 후\\ 다시\\ 시도해\\ 보세요\\.。"): self.mutate('commit', message='Blocked by hook')
        self.assertEqual(self.git('rev-list', '--count', 'HEAD').stdout.strip(), b'1')
        self.assertEqual(self.status()['entries'][0]['index'], 'M')


    def test_remote_management_and_history_use_remote_repository(self):
        self.baseline(); (self.root / 'hello.txt').write_text('remote staged change\n')
        store = RemoteStore('fixture-host'); store.get = lambda _: {'cwd': str(self.root)}
        bridge = SimpleNamespace(host='remote:fixture', local=False, store=store)
        def execute(alias, source, timeout):
            self.assertEqual(alias, 'fixture-host'); output = io.StringIO()
            with contextlib.redirect_stdout(output): exec(compile(source, '<remote-git>', 'exec'), {})
            return json.loads(output.getvalue())
        with patch('bridge.app.service.ssh_read', side_effect=execute):
            state = Bridge.workspace(bridge, support.THREAD, 'git-status', {})
            staged = Bridge.workspace(bridge, support.THREAD, 'git-action', {'action':'stage-all', 'version':state['version']})
            committed = Bridge.workspace(bridge, support.THREAD, 'git-action', {'action':'commit', 'version':staged['state']['version'], 'message':'Remote fixture commit'})
            self.assertEqual(committed['outcome'], 'success')
            history = Bridge.workspace(bridge, support.THREAD, 'git-history', {})
            self.assertEqual(history['commits'][0]['subject'], 'Remote fixture commit')

    def test_concurrent_mobile_writes_are_serialized(self):
        self.baseline(); (self.root / 'hello.txt').write_text('pending')
        owner = GitWorkspace(self.work); state = owner.require_repository()
        with owner.mutation_lock():
            with self.assertRaisesRegex(ValueError, "또\\ 다른\\ Git\\ 작업이\\ 실행\\ 중입니다\\.\\ 나중에\\ 새로고침하세요\\."):
                GitWorkspace(self.work).mutate('stage-all', state['version'])
        self.assertEqual(self.git('diff', '--cached').stdout, b'')

    def test_stage_and_unstage_reject_case_variants_of_git_directory(self):
        self.baseline(); owner = GitWorkspace(self.work); state = owner.require_repository()
        for action in ('stage', 'unstage'):
            for path in ('.git/config', '.GIT/hooks/pre-commit', 'nested/.Git/HEAD'):
                with self.subTest(action=action, path=path):
                    with self.assertRaisesRegex(ValueError, '请选择项目中的变更文件'):
                        owner.mutate(action, state['version'], path)


class GitHttpTests(unittest.TestCase):
    setUpClass = classmethod(support.HttpTests.setUpClass.__func__)
    request = support.HttpTests.request
    login = support.HttpTests.login
    def setUp(self):
        support.HttpTests.setUp(self)
        self.calls = []
        def workspace(thread, action, params):
            self.calls.append((thread, action, params)); return {'available': True, 'entries': []}
        self.server.bridge.workspace = workspace
        self.path = '/api/sessions/' + support.THREAD + '/workspace/'
    def tearDown(self): support.HttpTests.tearDown(self)
    def test_auth_routing_and_no_write_endpoint(self):
        self.assertEqual(self.request('GET', self.path + 'git-status')[0], 401)
        auth = self.login()
        self.assertEqual(self.request('GET', self.path + 'git-status', headers=auth)[0], 200)
        self.assertEqual(self.calls[-1][1:], ('git-status', {}))
        self.assertEqual(self.request('GET', self.path + 'git-diff?path=a.txt&section=staged', headers=auth)[0], 200)
        self.assertEqual(self.calls[-1][2], {'path': 'a.txt', 'section': 'staged'})
        self.assertEqual(self.request('POST', self.path + 'git-diff', {}, auth)[0], 405)
        self.assertEqual(self.request('GET', self.path + 'git-status?host=wrong', headers=auth)[0], 404)
        self.assertEqual(self.request('GET', self.path + 'git-repositories', headers=auth)[0], 200)
        self.assertEqual(self.calls[-1][1:], ('git-repositories', {}))
        for action in ['git-status', 'git-branches', 'git-history', 'git-commit', 'git-history-diff', 'git-diff']:
            self.assertEqual(self.request('GET', self.path + action + '?repository=nested%2Frepo', headers=auth)[0], 200)
            self.assertEqual(self.calls[-1][2]['repository'], 'nested/repo')
        connection = http.client.HTTPConnection('127.0.0.1', self.port)
        connection.request('GET', '/git-panel.js'); response = connection.getresponse()
        self.assertEqual(response.status, 200); self.assertIn(b'class GitPanel', response.read()); connection.close()

    def test_mutations_require_csrf_and_explicit_action(self):
        target = self.path + 'git-action'
        auth = self.login()
        self.assertEqual(self.request('GET', target, headers=auth)[0], 405)
        self.assertEqual(self.request('POST', target, {'action':'commit','version':'fixture'}, {'Cookie':auth['Cookie']})[0], 403)
        self.assertEqual(self.request('POST', target, {'action':'commit','version':'fixture'}, {**auth,'Origin':'https://evil.example'})[0], 403)
        self.assertEqual(self.calls, [])
        self.assertEqual(self.request('POST', target, {'action':'stage','version':'fixture','path':'a.txt'}, auth)[0], 200)
        self.assertEqual(self.calls[-1][1], 'git-action')
        self.assertEqual(self.request('POST', target, {'action':'stage','version':'fixture','root':'/outside'}, auth)[0], 400)
        self.assertEqual(self.request('POST', target, {'action':'stage','version':'fixture','repository':'nested/repo','path':'a.txt'}, auth)[0], 200)
        self.assertEqual(self.calls[-1][2]['repository'], 'nested/repo')
