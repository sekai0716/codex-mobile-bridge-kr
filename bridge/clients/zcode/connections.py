"""The selected transport and its non-secret setup information."""

MODES = ('private-pipe', 'official-remote')


def selected_mode(config):
    mode = config.get('zcodeConnectionMode')
    if mode in MODES:
        return mode
    return 'official-remote' if config.get('zcodeOfficialRemote') is True else 'private-pipe'


def connection_modes(config, *, installed, pipe_supported, official, official_supported):
    selected = selected_mode(config)
    paired = official.get('configured') is True or official.get('loginSaved') is True and official.get('loginDeferred') is True
    return {
        'connectionMode': selected,
        'connectionModes': [
            {'id': 'private-pipe', 'label': '로컬 연결',
             'description': '게이트웨이로 시작됨 ZCode，추가 로그인이 필요하지 않습니다. 자체적으로 시작된 경우 작업을 종료하고 연결을 초기화하여 정상적으로 다시 시작하시기 바랍니다.。',
             'configured': bool(installed and pipe_supported), 'available': bool(installed and pipe_supported),
             'connected': False,
             'reason': '' if pipe_supported else '현재 설치에서는 로컬 연결을 사용할 수 없습니다.'},
            {'id': 'official-remote', 'label': "공식 원격 연결",
             'description': '원본을 컴퓨터 게이트웨이에 저장 App 원격 제어 링크 및 동일한 계정으로 로그인 완료 세션 데이터 전달 ZCode 공식 릴레이。',
             'configured': paired,
             'available': bool(official_supported and paired),
             'connected': selected == 'official-remote' and official.get('connected') is True,
             'reason': ('이 시스템은 현재 공식 원격 제어를 지원하지 않습니다.' if not official_supported else
                        '' if paired else '먼저 컴퓨터 게이트웨이를 구성하고 공식 원격 제어에 로그인하십시오.')},
        ],
    }
