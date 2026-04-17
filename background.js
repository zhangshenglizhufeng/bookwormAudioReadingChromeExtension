// 后台脚本，用于处理本地TTS服务的调用

// 创建右键菜单
function createContextMenu() {
  console.log('=== 开始创建右键菜单 ===');
  // 先移除可能存在的旧菜单项
  chrome.contextMenus.removeAll(() => {
    console.log('已移除旧菜单项');
    // 创建从当前位置开始朗读菜单项
    const menuId = chrome.contextMenus.create({
      id: 'start-reading-here',
      title: '从这里开始阅读',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*/*']
    });
    console.log('右键菜单创建完成，菜单ID:', menuId);
  });
}

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('=== 右键菜单点击 ===');
  console.log('菜单项ID:', info.menuItemId);
  console.log('点击位置:', info.x, info.y);
  console.log('选择的文本:', info.selectionText);
  console.log('标签页ID:', tab.id);
  
  if (info.menuItemId === 'start-reading-here') {
    console.log('发送START_READING_HERE消息');
    // 从点击位置开始朗读
    chrome.tabs.sendMessage(tab.id, { 
      type: 'START_READING_HERE',
      payload: { 
        clickX: info.x, 
        clickY: info.y,
        selectionText: info.selectionText
      } 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送消息失败:', chrome.runtime.lastError);
      } else {
        console.log('消息发送成功，响应:', response);
      }
    });
  }
});

// 在扩展安装或更新时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  console.log('=== 扩展安装或更新 ===');
  createContextMenu();
});

// 在扩展启动时创建右键菜单
chrome.runtime.onStartup.addListener(() => {
  console.log('=== 扩展启动 ===');
  createContextMenu();
});

// 检查本地TTS服务是否可用
async function checkLocalTTSService() {
  try {
    console.log('开始检查本地TTS服务...');
    // 直接尝试调用TTS服务的API端点
    const response = await fetch('http://localhost:5050/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: '测试',
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.0
      })
    });
    console.log('本地TTS服务检查结果:', response.ok, response.status);
    return response.ok;
  } catch (error) {
    console.log('本地TTS服务不可用:', error.message);
    return false;
  }
}

// 使用本地TTS服务合成语音
async function synthesizeSpeech(text, voice = 'zh-CN-XiaoxiaoNeural', speed = 1.0, pitch = 0, style = '') {
  try {
    console.log('=== 开始合成语音 ===');
    console.log('原始文本:', text);
    console.log('使用音色:', voice);
    console.log('语速:', speed);
    console.log('音调:', pitch);
    console.log('风格:', style);
    
    const chunk = text
      .replace(/[\r\n\t]+/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[。.]/g, '，')
      .trim();
    
    console.log('清理后的文本:', chunk);
    console.log('调用本地TTS服务...');
    
    const requestBody = {
      input: chunk,
      voice: voice,
      rate: speed,
      pitch: pitch
    };
    
    if (style) {
      requestBody.style = style;
    }
    
    const response = await fetch('http://localhost:5050/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('TTS服务响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS服务返回错误:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    console.log('TTS服务返回成功，开始处理音频数据...');
    const audioBlob = await response.blob();
    console.log('音频数据大小:', audioBlob.size, 'bytes');
    
    // 将音频数据转换为base64字符串
    const reader = new FileReader();
    const audioUrl = await new Promise((resolve) => {
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(audioBlob);
    });
    console.log('音频URL生成成功:', audioUrl.substring(0, 50) + '...');
    
    return audioUrl;
  } catch (error) {
    console.error('TTS合成失败:', error);
    return null;
  }
}

// 分割文本为小块
function splitText(text, maxLength = 50) {
  const chunks = [];
  let currentChunk = '';
  
  // 按句子分割
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length < maxLength) {
      currentChunk += sentence + '。';
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = sentence + '。';
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('=== 收到消息 ===');
  console.log('消息类型:', message?.type);
  console.log('消息内容:', message);
  console.log('发送者:', sender);
  
  if (message?.type === 'CHECK_TTS_SERVICE') {
    console.log('处理CHECK_TTS_SERVICE消息');
    checkLocalTTSService().then(isAvailable => {
      console.log('CHECK_TTS_SERVICE响应:', { isAvailable });
      sendResponse({ isAvailable });
    });
    return true; // 异步响应
  } else if (message?.type === 'SYNTHESIZE_SPEECH') {
    console.log('处理SYNTHESIZE_SPEECH消息');
    const { text, voice, speed, pitch, style } = message.payload || {};
    console.log('合成文本:', text?.substring(0, 50) + '...');
    console.log('使用音色:', voice || 'zh-CN-XiaoxiaoNeural');
    console.log('语速:', speed || 1.0);
    console.log('音调:', pitch || 0);
    console.log('风格:', style || '');
    if (text) {
      synthesizeSpeech(text, voice || 'zh-CN-XiaoxiaoNeural', speed || 1.0, pitch || 0, style || '').then(audioUrl => {
        console.log('SYNTHESIZE_SPEECH响应:', { audioUrl: audioUrl?.substring(0, 50) + '...' });
        sendResponse({ audioUrl });
      });
      return true;
    } else {
      console.error('SYNTHESIZE_SPEECH消息缺少text参数');
      sendResponse({ audioUrl: null });
    }
  } else if (message?.type === 'CREATE_CONTEXT_MENU') {
    console.log('处理CREATE_CONTEXT_MENU消息');
    createContextMenu();
    sendResponse({ success: true });
  } else {
    console.warn('未知消息类型:', message?.type);
    sendResponse({ error: '未知消息类型' });
  }
});
