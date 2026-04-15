// 弹出窗口脚本

// 发送消息到内容脚本
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

// 更新状态
function updateStatus(status) {
  document.getElementById('status').textContent = status;
}

// 更新朗读状态显示
function updateReadingStatus(isReading, isScrolling) {
  const statusDiv = document.getElementById('reading-status');
  const readingButton = document.getElementById('toggle-reading');
  const scrollButton = document.getElementById('toggle-scroll');
  
  if (isReading) {
    statusDiv.textContent = '正在朗读...';
    statusDiv.className = 'reading-status reading';
    readingButton.textContent = '停止朗读';
    readingButton.classList.add('reading');
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

// 从content script获取状态
function syncState() {
  sendMessageToContentScript({ type: 'GET_STATE' }, (response) => {
    if (response && !response.error) {
      updateReadingStatus(response.isReading, response.isAutoScrolling);
      if (response.scrollSpeed) {
        document.getElementById('scroll-speed').value = response.scrollSpeed;
        document.getElementById('scroll-speed-display').textContent = response.scrollSpeed;
      }
    } else {
      updateReadingStatus(false, false);
    }
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  const toggleReadingButton = document.getElementById('toggle-reading');
  const toggleScrollButton = document.getElementById('toggle-scroll');
  const testReadingButton = document.getElementById('test-reading');
  const testTextArea = document.getElementById('test-text');
  const speechEngineSelect = document.getElementById('speech-engine');
  const voiceSelect = document.getElementById('voice-select');
  const speechSpeedInput = document.getElementById('speech-speed');
  const speedDisplay = document.getElementById('speed-display');
  const chunkSizeInput = document.getElementById('chunk-size');
  const chunkSizeDisplay = document.getElementById('chunk-size-display');
  const scrollSpeedInput = document.getElementById('scroll-speed');
  const scrollSpeedDisplay = document.getElementById('scroll-speed-display');
  
  // 同步状态
  syncState();
  
  // 切换朗读状态
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
  
  // 切换自动翻页状态
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
  
  // 测试朗读功能
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
      
      chrome.runtime.sendMessage({ 
        type: 'SYNTHESIZE_SPEECH', 
        payload: { text: testText, voice: selectedVoice, speed: selectedSpeed } 
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
  
  // 加载保存的设置
  chrome.storage.local.get(['speechEngine', 'voice', 'speechSpeed', 'chunkSize', 'scrollSpeed', 'filterKeywords'], (result) => {
    if (result.speechEngine) speechEngineSelect.value = result.speechEngine;
    if (result.voice) voiceSelect.value = result.voice;
    if (result.speechSpeed) {
      speechSpeedInput.value = result.speechSpeed;
      speedDisplay.textContent = result.speechSpeed;
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
  });
  
  // 保存过滤关键词
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
  
  // 检查本地TTS服务状态
  async function checkLocalTTSService() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_TTS_SERVICE' }, (response) => {
        resolve(response?.isAvailable || false);
      });
    });
  }
  
  // 显示本地TTS服务状态
  async function updateTTSServiceStatus() {
    const isAvailable = await checkLocalTTSService();
    const statusElement = document.getElementById('tts-service-status');
    if (statusElement) {
      statusElement.textContent = isAvailable ? '本地TTS服务: 可用' : '本地TTS服务: 不可用';
      statusElement.className = isAvailable ? 'status success' : 'status error';
    }
  }
  
  // 监听语音引擎变化
  speechEngineSelect.addEventListener('change', () => {
    const selectedEngine = speechEngineSelect.value;
    chrome.storage.local.set({ speechEngine: selectedEngine });
    if (selectedEngine === 'openai') updateTTSServiceStatus();
    updateStatus(`已切换到${selectedEngine === 'browser' ? '浏览器内置' : 'OpenAI TTS'}引擎`);
    sendMessageToContentScript({ type: 'SET_SPEECH_ENGINE', payload: { engine: selectedEngine } });
  });
  
  // 监听音色变化
  voiceSelect.addEventListener('change', () => {
    const selectedVoice = voiceSelect.value;
    chrome.storage.local.set({ voice: selectedVoice });
    updateStatus(`已切换音色为: ${selectedVoice}`);
    sendMessageToContentScript({ type: 'SET_VOICE', payload: { voice: selectedVoice } });
  });
  
  // 监听语速变化
  speechSpeedInput.addEventListener('input', () => {
    const speed = parseFloat(speechSpeedInput.value);
    speedDisplay.textContent = speed.toFixed(1);
    chrome.storage.local.set({ speechSpeed: speed });
    sendMessageToContentScript({ type: 'SET_SPEECH_SPEED', payload: { speed } });
  });
  
  // 监听分割字数变化
  chunkSizeInput.addEventListener('input', () => {
    const size = parseInt(chunkSizeInput.value);
    chunkSizeDisplay.textContent = size;
    chrome.storage.local.set({ chunkSize: size });
    sendMessageToContentScript({ type: 'SET_CHUNK_SIZE', payload: { chunkSize: size } });
  });
  
  // 监听翻页速度变化
  scrollSpeedInput.addEventListener('input', () => {
    const speed = parseInt(scrollSpeedInput.value);
    scrollSpeedDisplay.textContent = speed;
    chrome.storage.local.set({ scrollSpeed: speed });
    sendMessageToContentScript({ type: 'SET_SCROLL_SPEED', payload: { speed } });
  });
  
  // 页面加载时检查本地TTS服务状态
  updateTTSServiceStatus();
});
