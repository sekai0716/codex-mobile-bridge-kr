(() => {
  // Android can inject again after same-document navigation.
  if (window !== window.top || window.BridgeNativeClipboard) return;
  window.BridgeNativeClipboard = true;
  const nativePrompt = window.prompt.bind(window);
  const command = 'codexbridge-copy:__BRIDGE_CLIPBOARD_TOKEN__';
  let nativeLanguage = '__BRIDGE_NATIVE_LANGUAGE__';
  const syncLanguage = () => {
    if (typeof BridgeI18n === 'undefined') return;
    const language = BridgeI18n.language();
    if (language !== nativeLanguage && nativePrompt('codexbridge-language:__BRIDGE_CLIPBOARD_TOKEN__', language) === 'saved') nativeLanguage = language;
  };
  document.addEventListener('bridge-language', syncLanguage); syncLanguage();
  let clicked = false;
  document.addEventListener('click', event => {
    clicked = event.isTrusted && !!event.target.closest?.('.message-copy, .code-copy');
  }, true);
  const install = () => {
    if (!window.BridgeClipboard) return;
    window.BridgeClipboard.copy = async (getText, button) => {
      if (button.disabled || !clicked) return;
      clicked = false;
      const translate = text => typeof BridgeI18n === 'undefined' ? text : BridgeI18n.t(text);
      const label = button.textContent;
      button.disabled = true;
      button.textContent = translate("로드 중…");
      try {
        const text = await getText();
        if (typeof text !== 'string') throw new Error('복사된 콘텐츠를 읽을 수 없습니다.');
        if (text.length > 262144) throw new Error('내용이 너무 길어요. 부분적으로 복사해주세요.');
        if (nativePrompt(command, text) !== 'copied') throw new Error('복사하지 못했습니다. 다시 시도해 주세요.');
        button.textContent = translate('복사됨');
        setTimeout(() => { button.textContent = label; }, 1500);
      } catch (error) {
        button.textContent = label;
        document.dispatchEvent(new CustomEvent('bridge-message-error', { detail: error.message }));
      } finally {
        button.disabled = false;
      }
    };
  };
  install();
  document.addEventListener('DOMContentLoaded', install, { once: true });
})();
