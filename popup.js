// 弹出窗口脚本

let allVoiceNames = [];

function toVoiceLabel(item) {
  let s = item.ShortName
  switch (s) {
    case "zh-CN-XiaoxiaoNeural": s = "晓晓"; break
    case "zh-CN-XiaoyiNeural": s = "晓伊"; break
    case "zh-CN-YunxiNeural": s = "云希"; break
    case "zh-CN-YunyeNeural": s = "云野"; break
    case "zh-CN-YunxiaNeural": s = "云霞"; break
    case "zh-CN-YunyangNeural": s = "云阳"; break
    case "zh-CN-YunjianNeural": s = "云健"; break
    case "zh-CN-YunxiaoNeural": s = "云晓"; break
    case "zh-CN-liaoning-XiaobeiNeural": s = "小贝(辽宁)"; break
    case "zh-CN-shaanxi-XiaoniNeural": s = "晓妮(陕西)"; break
  }
  return (item.Gender === "Male" ? "男)" : "女)") + s
}

async function fetchVoiceNames() {
  try {
    const response = await fetch('http://localhost:5050/api/tts/list');
    if (response.ok) {
      allVoiceNames = await response.json();
      return true;
    }
  } catch (error) {
    console.log('获取音色列表失败:', error);
  }
  return false;
}

function updateVoiceSelect() {
  const languageSelect = document.getElementById('language-select');
  const genderSelect = document.getElementById('gender-select');
  const voiceSelect = document.getElementById('voice-select');
  
  const selectedLang = languageSelect.value;
  const selectedGender = genderSelect.value;
  
  const filteredVoices = allVoiceNames.filter(v => 
    (!selectedLang || v.Locale.startsWith(selectedLang)) &&
    (!selectedGender || v.Gender === selectedGender)
  );
  
  voiceSelect.innerHTML = '';
  filteredVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.ShortName;
    option.textContent = toVoiceLabel(voice);
    voiceSelect.appendChild(option);
  });
  
  if (filteredVoices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '暂无音色';
    voiceSelect.appendChild(option);
  }
}

function sendMessageToContentScript(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) {
          console.log('发送消息失败:', chrome.runtime.lastError.message);
          if (callback) callback({ error: true, message: chrome.runtime.lastError.message });
        } else {
          if (callback) callback(response);
        }
      });
    } else {
      if (callback) callback({ error: true, message: '没有活动标签页' });
    }
  });
}

function updateStatus(status) {
  document.getElementById('status').textContent = status;
}

function updateReadingStatus(isReading, isScrolling, hasPausedAudio) {
  const statusDiv = document.getElementById('reading-status');
  const readingButton = document.getElementById('toggle-reading');
  const scrollButton = document.getElementById('toggle-scroll');
  
  if (isReading) {
    statusDiv.textContent = '正在朗读...';
    statusDiv.className = 'reading-status reading';
    readingButton.textContent = '暂停朗读';
    readingButton.classList.add('reading');
  } else if (hasPausedAudio) {
    statusDiv.textContent = '已暂停';
    statusDiv.className = 'reading-status idle';
    readingButton.textContent = '继续朗读';
    readingButton.classList.remove('reading');
  } else {
    statusDiv.textContent = isScrolling ? '自动翻页中' : '就绪';
    statusDiv.className = isScrolling ? 'reading-status scrolling' : 'reading-status idle';
    readingButton.textContent = '开始朗读';
    readingButton.classList.remove('reading');
  }
  
  if (isScrolling) {
    scrollButton.textContent = '停止自动翻页';
    scrollButton.classList.add('scrolling');
  } else {
    scrollButton.textContent = '开始自动翻页';
    scrollButton.classList.remove('scrolling');
  }
}

function syncState() {
  sendMessageToContentScript({ type: 'GET_STATE' }, (response) => {
    if (response && !response.error) {
      updateReadingStatus(response.isReading, response.isAutoScrolling, response.hasPausedAudio);
      if (response.scrollSpeed) {
        document.getElementById('scroll-speed').value = response.scrollSpeed;
        document.getElementById('scroll-speed-display').textContent = response.scrollSpeed;
      }
    } else {
      updateReadingStatus(false, false);
    }
  });
  
  // 同步预加载状态
  sendMessageToContentScript({ type: 'GET_PRELOAD_STATE' }, (response) => {
    if (response && !response.error) {
      updatePreloadStatus(response);
    }
  });
}

function updatePreloadStatus(state) {
  const preloadStatus = document.getElementById('preload-status');
  const preloadSwitch = document.getElementById('preload-switch');
  const preloadInfo = document.getElementById('preload-info');
  
  if (preloadSwitch) {
    preloadSwitch.checked = state.preloadEnabled;
  }
  
  if (preloadInfo) {
    let infoText = '';
    if (state.isPreloading) {
      infoText = '正在预加载...';
    } else if (state.hasPreloadedNextChapter) {
      infoText = `下一章已预加载 | 预缓存: ${state.preloadedChunksCount}个`;
    } else if (state.preloadedChunksCount > 0) {
      infoText = `预缓存: ${state.preloadedChunksCount}个`;
    } else {
      infoText = '未预加载';
    }
    preloadInfo.textContent = infoText;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggleReadingButton = document.getElementById('toggle-reading');
  const toggleScrollButton = document.getElementById('toggle-scroll');
  const testReadingButton = document.getElementById('test-reading');
  const testTextArea = document.getElementById('test-text');
  const speechEngineSelect = document.getElementById('speech-engine');
  const languageSelect = document.getElementById('language-select');
  const genderSelect = document.getElementById('gender-select');
  const voiceSelect = document.getElementById('voice-select');
  const styleSelect = document.getElementById('style-select');
  const speechSpeedInput = document.getElementById('speech-speed');
  const speedDisplay = document.getElementById('speed-display');
  const speechPitchInput = document.getElementById('speech-pitch');
  const pitchDisplay = document.getElementById('pitch-display');
  const chunkSizeInput = document.getElementById('chunk-size');
  const chunkSizeDisplay = document.getElementById('chunk-size-display');
  const scrollSpeedInput = document.getElementById('scroll-speed');
  const scrollSpeedDisplay = document.getElementById('scroll-speed-display');
  
  await fetchVoiceNames();
  updateVoiceSelect();
  
  syncState();
  
  toggleReadingButton.addEventListener('click', () => {
    sendMessageToContentScript({ type: 'TOGGLE_READING' }, (response) => {
      if (response?.error) {
        updateStatus('请在小说页面上使用此功能');
        updateReadingStatus(false, false);
      } else {
        updateStatus('命令已发送');
        setTimeout(syncState, 500);
      }
    });
  });
  
  toggleScrollButton.addEventListener('click', () => {
    sendMessageToContentScript({ type: 'TOGGLE_AUTO_SCROLL' }, (response) => {
      if (response?.error) {
        updateStatus('请在小说页面上使用此功能');
      } else {
        updateStatus('命令已发送');
        setTimeout(syncState, 500);
      }
    });
  });
  
  testReadingButton.addEventListener('click', async () => {
    console.log('=== 开始测试朗读 ===');
    const testText = testTextArea.value.trim();
    console.log('测试文本:', testText);
    if (!testText) {
      updateStatus('请输入测试文本');
      return;
    }
    
    const selectedEngine = speechEngineSelect.value;
    
    if (selectedEngine === 'browser') {
      if ('speechSynthesis' in window) {
        const speechSynth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.lang = 'zh-CN';
        utterance.rate = parseFloat(speechSpeedInput.value);
        
        utterance.onstart = () => updateStatus('正在朗读...');
        utterance.onend = () => {
          updateStatus('朗读完成');
          setTimeout(() => updateStatus('就绪'), 1000);
        };
        utterance.onerror = () => {
          updateStatus('朗读失败');
          setTimeout(() => updateStatus('就绪'), 1000);
        };
        
        speechSynth.speak(utterance);
      } else {
        updateStatus('浏览器不支持语音合成');
      }
    } else if (selectedEngine === 'openai') {
      updateStatus('使用本地TTS服务朗读...');
      const selectedVoice = voiceSelect.value;
      const selectedSpeed = parseFloat(speechSpeedInput.value);
      const selectedPitch = parseFloat(speechPitchInput.value);
      const selectedStyle = styleSelect.value;
      
      chrome.runtime.sendMessage({ 
        type: 'SYNTHESIZE_SPEECH', 
        payload: { 
          text: testText, 
          voice: selectedVoice, 
          speed: selectedSpeed,
          pitch: selectedPitch,
          style: selectedStyle
        } 
      }, (response) => {
        const audioUrl = response?.audioUrl;
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.onplay = () => updateStatus('正在朗读...');
          audio.onended = () => {
            updateStatus('朗读完成');
            setTimeout(() => updateStatus('就绪'), 1000);
          };
          audio.onerror = () => {
            updateStatus('播放失败');
            setTimeout(() => updateStatus('就绪'), 1000);
          };
          audio.play();
        } else {
          updateStatus('TTS服务失败');
          setTimeout(() => updateStatus('就绪'), 1000);
        }
      });
    }
  });
  
  chrome.storage.local.get(['speechEngine', 'language', 'gender', 'voice', 'style', 'speechSpeed', 'speechPitch', 'chunkSize', 'scrollSpeed', 'filterKeywords', 'preloadEnabled'], (result) => {
    if (result.speechEngine) speechEngineSelect.value = result.speechEngine;
    if (result.language) languageSelect.value = result.language;
    if (result.gender) genderSelect.value = result.gender;
    updateVoiceSelect();
    if (result.voice) voiceSelect.value = result.voice;
    if (result.style) styleSelect.value = result.style;
    if (result.speechSpeed) {
      speechSpeedInput.value = result.speechSpeed;
      speedDisplay.textContent = result.speechSpeed;
    }
    if (result.speechPitch !== undefined) {
      speechPitchInput.value = result.speechPitch;
      pitchDisplay.textContent = result.speechPitch;
    }
    if (result.chunkSize) {
      chunkSizeInput.value = result.chunkSize;
      chunkSizeDisplay.textContent = result.chunkSize;
    }
    if (result.scrollSpeed) {
      scrollSpeedInput.value = result.scrollSpeed;
      scrollSpeedDisplay.textContent = result.scrollSpeed;
    }
    if (result.filterKeywords && Array.isArray(result.filterKeywords)) {
      document.getElementById('filter-keywords').value = result.filterKeywords.join('\n');
    }
    if (result.preloadEnabled !== undefined) {
      const preloadSwitch = document.getElementById('preload-switch');
      if (preloadSwitch) preloadSwitch.checked = result.preloadEnabled;
    }
  });
  
  const saveFilterKeywordsButton = document.getElementById('save-filter-keywords');
  const filterKeywordsTextarea = document.getElementById('filter-keywords');
  
  saveFilterKeywordsButton.addEventListener('click', () => {
    const keywordsText = filterKeywordsTextarea.value.trim();
    const keywords = keywordsText.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    
    chrome.storage.local.set({ filterKeywords: keywords }, () => {
      updateStatus('过滤关键词已保存');
      sendMessageToContentScript({ type: 'SET_FILTER_KEYWORDS', payload: { keywords } });
    });
  });
  
  async function checkLocalTTSService() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_TTS_SERVICE' }, (response) => {
        resolve(response?.isAvailable || false);
      });
    });
  }
  
  async function updateTTSServiceStatus() {
    const isAvailable = await checkLocalTTSService();
    const statusElement = document.getElementById('tts-service-status');
    if (statusElement) {
      statusElement.textContent = isAvailable ? '本地TTS服务: 可用' : '本地TTS服务: 不可用';
      statusElement.className = isAvailable ? 'status success' : 'status error';
    }
  }
  
  speechEngineSelect.addEventListener('change', () => {
    const selectedEngine = speechEngineSelect.value;
    chrome.storage.local.set({ speechEngine: selectedEngine });
    if (selectedEngine === 'openai') updateTTSServiceStatus();
    updateStatus(`已切换到${selectedEngine === 'browser' ? '浏览器内置' : 'Azure TTS'}引擎`);
    sendMessageToContentScript({ type: 'SET_SPEECH_ENGINE', payload: { engine: selectedEngine } });
  });
  
  languageSelect.addEventListener('change', () => {
    const selectedLang = languageSelect.value;
    chrome.storage.local.set({ language: selectedLang });
    updateVoiceSelect();
    const currentVoice = voiceSelect.value;
    if (currentVoice) {
      chrome.storage.local.set({ voice: currentVoice });
      sendMessageToContentScript({ type: 'SET_VOICE', payload: { voice: currentVoice } });
    }
    updateStatus(`已切换语言为: ${selectedLang}`);
  });
  
  genderSelect.addEventListener('change', () => {
    const selectedGender = genderSelect.value;
    chrome.storage.local.set({ gender: selectedGender });
    updateVoiceSelect();
    const currentVoice = voiceSelect.value;
    if (currentVoice) {
      chrome.storage.local.set({ voice: currentVoice });
      sendMessageToContentScript({ type: 'SET_VOICE', payload: { voice: currentVoice } });
    }
    updateStatus(`已切换性别为: ${selectedGender || '全部'}`);
  });
  
  voiceSelect.addEventListener('change', () => {
    const selectedVoice = voiceSelect.value;
    chrome.storage.local.set({ voice: selectedVoice });
    updateStatus(`已切换音色为: ${selectedVoice}`);
    sendMessageToContentScript({ type: 'SET_VOICE', payload: { voice: selectedVoice } });
  });
  
  styleSelect.addEventListener('change', () => {
    const selectedStyle = styleSelect.value;
    chrome.storage.local.set({ style: selectedStyle });
    updateStatus(`已切换语音风格为: ${selectedStyle || '默认'}`);
    sendMessageToContentScript({ type: 'SET_STYLE', payload: { style: selectedStyle } });
  });
  
  speechSpeedInput.addEventListener('input', () => {
    const speed = parseFloat(speechSpeedInput.value);
    speedDisplay.textContent = speed.toFixed(1);
    chrome.storage.local.set({ speechSpeed: speed });
    sendMessageToContentScript({ type: 'SET_SPEECH_SPEED', payload: { speed } });
  });
  
  speechPitchInput.addEventListener('input', () => {
    const pitch = parseFloat(speechPitchInput.value);
    pitchDisplay.textContent = pitch.toFixed(1);
    chrome.storage.local.set({ speechPitch: pitch });
    sendMessageToContentScript({ type: 'SET_SPEECH_PITCH', payload: { pitch } });
  });
  
  chunkSizeInput.addEventListener('input', () => {
    const size = parseInt(chunkSizeInput.value);
    chunkSizeDisplay.textContent = size;
    chrome.storage.local.set({ chunkSize: size });
    sendMessageToContentScript({ type: 'SET_CHUNK_SIZE', payload: { chunkSize: size } });
  });
  
  scrollSpeedInput.addEventListener('input', () => {
    const speed = parseInt(scrollSpeedInput.value);
    scrollSpeedDisplay.textContent = speed;
    chrome.storage.local.set({ scrollSpeed: speed });
    sendMessageToContentScript({ type: 'SET_SCROLL_SPEED', payload: { speed } });
  });
  
  // 预加载开关
  const preloadSwitch = document.getElementById('preload-switch');
  if (preloadSwitch) {
    preloadSwitch.addEventListener('change', () => {
      const enabled = preloadSwitch.checked;
      chrome.storage.local.set({ preloadEnabled: enabled });
      sendMessageToContentScript({ type: 'SET_PRELOAD_ENABLED', payload: { enabled } });
      updateStatus(`预加载已${enabled ? '开启' : '关闭'}`);
    });
  }
  
  updateTTSServiceStatus();
  
  // 定期更新预加载状态（改为10秒，减少日志刷屏）
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      sendMessageToContentScript({ type: 'GET_PRELOAD_STATE' }, (response) => {
        if (response && !response.error) {
          updatePreloadStatus(response);
        }
      });
    }
  }, 10000);
});
