"""Connection credentials in the native OS vault; no plaintext fallback."""
import hashlib
import json
import sys
from pathlib import Path

from bridge.features.notifications.channels import read_json, write_json

FIELDS = ('password', 'passphrase', 'tunnelToken')


def backend():
    try:
        if sys.platform == 'darwin':
            from keyring.backends.macOS import Keyring
        elif sys.platform == 'win32':
            from keyring.backends.Windows import WinVaultKeyring as Keyring
        else:
            from keyring.backends.SecretService import Keyring
        return Keyring()
    except Exception as exc:
        raise ValueError("시스템 자격 증명 저장소를 사용할 수 없습니다. 키체인을 잠금 해제하거나 비밀 서비스를 활성화하세요. 비밀번호는 일반 텍스트로 저장되지 않습니다.") from exc


def service(data_dir):
    return 'io.github.try2love.codexmobilebridge.' + hashlib.sha256(str(Path(data_dir).resolve()).encode()).hexdigest()[:24]


def read(data_dir, connection_id):
    if not read_json(Path(data_dir)/'connection-vault.json', {}).get(connection_id):
        return {}
    try:
        value = backend().get_password(service(data_dir), connection_id)
        return json.loads(value) if value else {}
    except Exception as exc:
        raise ValueError("연결 자격 증명을 읽을 수 없습니다. 시스템 자격 증명 저장소를 잠금 해제하고 다시 시도하세요.") from exc


def save(data_dir, connection_id, changes):
    if not isinstance(changes, dict) or set(changes) - set(FIELDS) - {'clear'}:
        raise ValueError("연결 자격 증명 형식이 잘못되었습니다.")
    for key in FIELDS:
        value = changes.get(key, '')
        if not isinstance(value, str) or len(value) > 16384 or '\x00' in value:
            raise ValueError("연결 자격 증명 형식이 잘못되었습니다.")
    clear = changes.get('clear', False)
    if not isinstance(clear, bool):
        raise ValueError("자격 증명 지우기 옵션이 잘못되었습니다.")
    index_path = Path(data_dir)/'connection-vault.json'
    index = read_json(index_path, {})
    if clear and not index.get(connection_id) and not any(changes.get(k) for k in FIELDS):
        return
    vault = backend()
    try:
        old = vault.get_password(service(data_dir), connection_id)
        values = {} if clear else json.loads(old or '{}')
        values.update({key: changes[key] for key in FIELDS if changes.get(key)})
        if values:
            vault.set_password(service(data_dir), connection_id, json.dumps(values))
        elif old:
            vault.delete_password(service(data_dir), connection_id)
        if values:
            index[connection_id] = True
        else:
            index.pop(connection_id, None)
        write_json(index_path, index)
    except Exception as exc:
        raise ValueError("연결 자격 증명을 저장할 수 없습니다. 시스템 자격 증명 저장소를 잠금 해제하고 다시 시도하세요.") from exc
