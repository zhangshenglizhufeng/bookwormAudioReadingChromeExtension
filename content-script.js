(function() {
  // 全局变量
  let isReading = false;
  let autoScrollInterval = null;
  let speechSynth = null;
  let currentUtterance = null;
  let scrollSpeed = 50; // 滚动速度，值越大越慢
  let isAutoScrolling = false;
  let currentParagraphIndex = 0;
  let paragraphs = [];
  let currentReadingIndex = 0;
  
  // 全局变量
  let speechEngine = 'openai'; // 'browser' 或 'openai'
  let voice = 'zh-CN-XiaoxiaoNeural'; // 默认音色
  let speechSpeed = 1.0; // 默认语速
  let speechPitch = 0; // 默认音调
  let speechStyle = ''; // 默认风格
  let chunkSize = 150;
  let currentAudio = null;
  let isAudioPlaying = false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;
  
  // 统一分割后的所有chunks
  let allChunks = [];
  let currentChunkIndex = 0;
  
  // 过滤关键词列表（用户自定义）
  let filterKeywords = [];
  
  // 初始化语音合成
  function initSpeechSynthesis() {
    if (speechEngine === 'browser') {
      if ('speechSynthesis' in window) {
        speechSynth = window.speechSynthesis;
        return true;
      }
    } else if (speechEngine === 'openai') {
      // 本地OpenAI兼容TTS服务
      console.log('使用本地开源语音合成引擎');
      return true;
    }
    return false;
  }
  
  // 检查本地TTS服务是否可用
  async function checkLocalTTSService() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_TTS_SERVICE' }, (response) => {
        const isAvailable = response?.isAvailable || false;
        console.log('本地TTS服务检查结果:', isAvailable);
        resolve(isAvailable);
      });
    });
  }
  
  // 标记是否正在合成音频
  let isSynthesizing = false;
  
  // 使用本地TTS服务合成语音
  async function synthesizeSpeech(text) {
    try {
      if (!chrome.runtime?.id) {
        console.error('扩展上下文已失效');
        return null;
      }
      
      isSynthesizing = true;
      console.log('设置合成状态为:', isSynthesizing);
      
      // 停止之前的音频播放
      if (currentAudio) {
        try {
          currentAudio.pause();
          currentAudio.src = ''; // 释放资源
        } catch (e) {
          console.error('停止音频失败:', e);
        }
        currentAudio = null;
      }
      
      // 通过background script调用本地TTS服务
      return new Promise((resolve) => {
        console.log('发送TTS合成请求，文本长度:', text.length);
        chrome.runtime.sendMessage({ 
          type: 'SYNTHESIZE_SPEECH', 
          payload: { text, voice, speed: speechSpeed, pitch: speechPitch, style: speechStyle } 
        }, (response) => {
          // 重置合成状态
          isSynthesizing = false;
          console.log('设置合成状态为:', isSynthesizing);
          
          // 检查是否有错误
          if (chrome.runtime.lastError) {
            console.error('发送消息失败:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          console.log('收到TTS合成响应:', response);
          const audioUrl = response?.audioUrl;
          if (audioUrl) {
            console.log('创建音频对象，URL:', audioUrl.substring(0, 50) + '...');
            const audio = new Audio(audioUrl);
            // 存储音频对象以便停止
            currentAudio = audio;
            resolve(audio);
          } else {
            console.error('TTS合成失败: 未获取到音频URL');
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('TTS合成失败:', error);
      // 重置合成状态
      isSynthesizing = false;
      console.log('设置合成状态为:', isSynthesizing);
      return null;
    }
  }
  
  // 提取小说内容并分割为段落
  function extractNovelContent() {
    console.log('=== 开始提取小说内容 ===');
    console.log('当前URL:', window.location.href);
    
    // 常见小说网站的内容选择器（按优先级排序）
    const contentSelectors = [
      '#content',
      '#chaptercontent',
      '#ChapterContent',
      '#chapter-content',
      '#article',
      '#BookText',
      '#booktext',
      '#txt',
      '#Text',
      '.content',
      '.chapter-content',
      '.chaptercontent',
      '.article-content',
      '.book-content',
      '.novel-content',
      '.read-content',
      '.text-content',
      '.readerContent',
      '.bookContent',
      '.chapterContent',
      '#txtContent',
      '#chapter',
      '.txt',
      'article',
      '[class*="content"]',
      '[class*="chapter"]',
      '[class*="Content"]',
      '[id*="content"]',
      '[id*="chapter"]',
      '[id*="Content"]'
    ];
    
    let contentDiv = null;
    
    // 尝试每个选择器
    console.log('--- 尝试选择器 ---');
    for (const selector of contentSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`选择器 ${selector}: 找到 ${elements.length} 个元素`);
        for (const el of elements) {
          const text = el.textContent.trim();
          const textLength = text.length;
          if (textLength > 100) {
            const hasChinesePunctuation = /[，。！？、；：]/.test(text);
            console.log(`  元素: 长度=${textLength}, 有中文标点=${hasChinesePunctuation}`);
            if (hasChinesePunctuation) {
              if (!contentDiv || textLength > contentDiv.textContent.length) {
                contentDiv = el;
                console.log(`  -> 选择此元素作为内容`);
              }
            }
          }
        }
      } catch (e) {
        console.log(`选择器 ${selector} 出错:`, e);
      }
    }
    
    // 如果还没找到，使用智能查找
    if (!contentDiv) {
      console.log('--- 使用智能查找 ---');
      const allElements = document.querySelectorAll('div, article, section, main');
      console.log(`共找到 ${allElements.length} 个元素`);
      let maxTextLength = 0;
      let candidateCount = 0;
      
      for (const el of allElements) {
        const text = el.textContent.trim();
        const textLength = text.length;
        
        if (textLength < 100) continue;
        
        const punctuationCount = (text.match(/[，。！？、；：""'']/g) || []).length;
        const density = punctuationCount / textLength;
        
        const className = (el.className || '').toString().toLowerCase();
        const id = (el.id || '').toString().toLowerCase();
        const isExcluded = 
          className.includes('nav') ||
          className.includes('menu') ||
          className.includes('sidebar') ||
          className.includes('comment') ||
          className.includes('footer') ||
          className.includes('header') ||
          className.includes('list') ||
          id.includes('nav') ||
          id.includes('menu') ||
          id.includes('sidebar') ||
          id.includes('comment');
        
        // 放宽条件：密度大于0.003或者有足够多的中文标点
        const isLikelyContent = (density > 0.003 || punctuationCount > 30) && !isExcluded;
        
        if (isLikelyContent) {
          candidateCount++;
          console.log(`候选 ${candidateCount}: 长度=${textLength}, 密度=${density.toFixed(4)}, 标点数=${punctuationCount}, class=${className}, id=${id}`);
          if (textLength > maxTextLength) {
            maxTextLength = textLength;
            contentDiv = el;
            console.log(`  -> 选择此元素作为内容`);
          }
        }
      }
      console.log(`智能查找共找到 ${candidateCount} 个候选元素`);
    }
    
    // 最后尝试：查找所有p标签的父元素
    if (!contentDiv) {
      console.log('尝试查找p标签集合...');
      const allP = document.querySelectorAll('p');
      if (allP.length > 3) {
        // 找到包含最多p标签的父元素
        const parentCounts = {};
        allP.forEach(p => {
          let parent = p.parentElement;
          while (parent && parent !== document.body) {
            const key = parent.className + parent.id;
            parentCounts[key] = (parentCounts[key] || { el: parent, count: 0 });
            parentCounts[key].count++;
            parent = parent.parentElement;
          }
        });
        
        let maxParent = null;
        let maxCount = 0;
        for (const key in parentCounts) {
          if (parentCounts[key].count > maxCount) {
            maxCount = parentCounts[key].count;
            maxParent = parentCounts[key].el;
          }
        }
        
        if (maxParent && maxParent.textContent.trim().length > 200) {
          contentDiv = maxParent;
          console.log(`通过p标签找到内容，p标签数: ${maxCount}`);
        }
      }
    }
    
    if (contentDiv) {
      // 克隆节点，移除style和script标签后再提取文本
      const clone = contentDiv.cloneNode(true);
      const removeElements = clone.querySelectorAll('style, script, noscript, iframe, svg');
      removeElements.forEach(el => el.remove());
      
      let content = clone.textContent || '';
      
      // 清理文本：移除CSS相关内容
      content = content
        .replace(/\{[^}]*\}/g, '') // 移除CSS规则
        .replace(/@[a-z\-]+\s+[^\n;]+;?/gi, '') // 移除CSS at-rules
        .replace(/[a-z\-]+\s*:\s*[^;]+;/gi, '') // 移除CSS属性
        .replace(/\.[a-zA-Z][a-zA-Z0-9_-]*\s*\{/g, '') // 移除CSS类选择器
        .replace(/#[a-zA-Z][a-zA-Z0-9_-]*\s*\{/g, '') // 移除CSS id选择器
        .replace(/url\([^)]*\)/gi, '') // 移除url()
        .replace(/function\s*\([^)]*\)\s*\{[^}]*\}/gi, '') // 移除JS函数
        .replace(/var\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/gi, '') // 移除JS变量声明
        .replace(/const\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/gi, '')
        .replace(/let\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/gi, '')
        .replace(/[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*\{/g, '') // 移除函数调用
        .replace(/\s+/g, ' ') // 合并空白
        .trim();
      
      // 替换过滤关键词为空白
      for (const keyword of filterKeywords) {
        if (keyword) {
          content = content.split(keyword).join('');
        }
      }
      
      paragraphs = content.split(/[\n\r]+/).filter(p => {
        const trimmed = p.trim();
        // 过滤掉太短的、看起来像代码的行
        if (trimmed.length < 5) return false;
        if (/^[a-zA-Z0-9_\-.:;{}()]+$/.test(trimmed)) return false; // 纯代码
        if (trimmed.includes('{') || trimmed.includes('}')) return false; // 包含CSS括号
        if (/^[.#][a-zA-Z]/.test(trimmed)) return false; // CSS选择器开头
        return true;
      });
      
      console.log('提取到的段落数量:', paragraphs.length);
      console.log('前3个段落:', paragraphs.slice(0, 3).map(p => p.substring(0, 50) + '...'));
      return content;
    }
    
    console.log('未找到小说内容');
    return '';
  }
  
  // 标注当前朗读位置
  function highlightCurrentParagraph() {
    console.log('=== 开始高亮当前朗读位置 ===');
    console.log('当前chunk索引:', currentChunkIndex);
    console.log('chunk总数:', allChunks.length);
    
    // 移除之前的所有高亮元素
    const oldHighlights = document.querySelectorAll('.novel-reader-highlight');
    oldHighlights.forEach(highlight => {
      highlight.remove();
    });
    console.log('已移除之前的高亮');
    
    // 高亮当前朗读内容 - 使用独立的提示框
    if (allChunks.length > 0 && currentChunkIndex < allChunks.length) {
      console.log('当前chunk内容:', allChunks[currentChunkIndex]);
      
      // 创建一个固定定位的提示框
      const highlight = document.createElement('div');
      highlight.className = 'novel-reader-highlight';
      
      // 样式设置 - 确保不影响页面布局
      highlight.style.position = 'fixed';
      highlight.style.bottom = '20px';
      highlight.style.left = '50%';
      highlight.style.transform = 'translateX(-50%)';
      highlight.style.background = 'rgba(255, 255, 0, 0.9)';
      highlight.style.color = '#333';
      highlight.style.padding = '12px 24px';
      highlight.style.borderRadius = '25px';
      highlight.style.zIndex = '9999';
      highlight.style.fontSize = '14px';
      highlight.style.maxWidth = '80%';
      highlight.style.textAlign = 'center';
      highlight.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
      highlight.style.fontFamily = 'Arial, sans-serif';
      
      // 显示当前朗读内容的前30个字符
      const displayText = allChunks[currentChunkIndex].substring(0, 30);
      highlight.textContent = `当前朗读: ${displayText}...`;
      
      // 添加到页面
      document.body.appendChild(highlight);
      console.log('已添加新的高亮提示框');
    }
    console.log('=== 高亮当前朗读位置完成 ===');
  }
  
  // 查找章节链接（通用函数）
  function findChapterLink(direction) {
    console.log(`=== 开始查找${direction === 'next' ? '下一章' : '上一章'}链接 ===`);
    
    const nextKeywords = ['下一章', '下章', '下节', '下页', 'next', 'next chapter', '继续阅读', '下一页', '后一章', '后一章'];
    const prevKeywords = ['上一章', '上章', '上节', '上页', 'prev', 'previous', 'previous chapter', '上一页', '前一章', '前一页'];
    const keywords = direction === 'next' ? nextKeywords : prevKeywords;
    
    // 常见的章节链接选择器
    const selectors = [
      'a.next', 'a.prev', 'a.nextpage', 'a.prevpage',
      '.next a', '.prev a', '.nextpage a', '.prevpage a',
      '.chapter-nav a', '.page-nav a', '.pagination a',
      '[class*="next"] a', '[class*="prev"] a',
      'a[class*="next"]', 'a[class*="prev"]',
      'a[rel="next"]', 'a[rel="prev"]',
      '.bottem1 a', '.bottom a', '.footer a'
    ];
    
    // 先尝试选择器
    for (const selector of selectors) {
      try {
        const links = document.querySelectorAll(selector);
        for (const link of links) {
          const linkText = link.textContent.toLowerCase().trim();
          const href = link.href.toLowerCase();
          
          for (const keyword of keywords) {
            if (linkText.includes(keyword.toLowerCase())) {
              console.log(`通过选择器 ${selector} 找到链接:`, link.href, '文本:', link.textContent);
              return link;
            }
          }
        }
      } catch (e) {}
    }
    
    // 遍历所有链接查找
    const allLinks = Array.from(document.querySelectorAll('a'));
    
    // 按匹配度排序
    const scoredLinks = allLinks.map(link => {
      const linkText = link.textContent.toLowerCase().trim();
      const href = link.href.toLowerCase();
      let score = 0;
      
      // 文本匹配
      for (const keyword of keywords) {
        if (linkText.includes(keyword.toLowerCase())) {
          score += 10;
          // 精确匹配加分
          if (linkText === keyword.toLowerCase()) {
            score += 5;
          }
        }
      }
      
      // href 匹配
      if (direction === 'next') {
        if (href.includes('next') || href.includes('/du/')) score += 3;
      } else {
        if (href.includes('prev')) score += 3;
      }
      
      // rel 属性匹配
      if (link.getAttribute('rel') === direction) score += 5;
      
      // 排除明显不是章节链接的
      if (linkText.includes('目录') || linkText.includes('首页') || linkText.includes('返回')) {
        score = 0;
      }
      
      return { link, score, linkText };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (scoredLinks.length > 0) {
      const best = scoredLinks[0];
      console.log(`找到最佳匹配链接:`, best.link.href, '文本:', best.linkText, '分数:', best.score);
      return best.link;
    }
    
    // 尝试通过 URL 数字递增/递减查找
    const currentUrl = window.location.href;
    const currentHash = window.location.hash;
    
    // 先尝试hash部分（SPA网站）
    if (currentHash) {
      const hashMatch = currentHash.match(/(\d+)(\.html?)?$/);
      if (hashMatch) {
        const currentNum = parseInt(hashMatch[1]);
        const targetNum = direction === 'next' ? currentNum + 1 : currentNum - 1;
        if (targetNum > 0) {
          const targetHash = currentHash.replace(/\d+(\.html?)?$/, targetNum + (hashMatch[2] || '.html'));
          const targetUrl = window.location.origin + window.location.pathname + targetHash;
          console.log(`尝试通过hash数字查找: ${targetUrl}`);
          return { href: targetUrl, click: () => { window.location.href = targetUrl; } };
        }
      }
    }
    
    // 再尝试完整URL
    const urlMatch = currentUrl.match(/(\d+)(\.html?|\/)?$/);
    if (urlMatch) {
      const currentNum = parseInt(urlMatch[1]);
      const targetNum = direction === 'next' ? currentNum + 1 : currentNum - 1;
      if (targetNum > 0) {
        const targetUrl = currentUrl.replace(/\d+(\.html?|\/)?$/, targetNum + (urlMatch[2] || ''));
        console.log(`尝试通过URL数字查找: ${targetUrl}`);
        return { href: targetUrl, click: () => { window.location.href = targetUrl; } };
      }
    }
    
    console.log('未找到章节链接');
    return null;
  }
  
  // 跳转到下一章
  function goToNextChapter() {
    const link = findChapterLink('next');
    if (link) {
      console.log('准备设置自动阅读标志');
      sessionStorage.setItem('autoReading', 'true');
      if (link.click) {
        link.click();
      } else {
        window.location.href = link.href;
      }
      return true;
    }
    return false;
  }
  
  // 跳转到上一章
  function goToPrevChapter() {
    const link = findChapterLink('prev');
    if (link) {
      if (link.click) {
        link.click();
      } else {
        window.location.href = link.href;
      }
      return true;
    }
    return false;
  }
  
  // 开始朗读
  async function startReading() {
    // 检查是否已有朗读在进行
    if (isReading || isAudioPlaying) {
      console.warn('已有朗读在进行，跳过当前调用');
      return;
    }
    
    // 如果已经有chunks，说明是暂停后继续
    if (allChunks.length > 0 && currentChunkIndex < allChunks.length) {
      console.log('继续朗读当前章节');
      readNextParagraph();
      isReading = true;
      updateUI();
      return;
    }
    
    // 尝试提取内容，如果失败则等待重试（SPA网站可能需要等待内容加载）
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      extractNovelContent();
      if (paragraphs.length > 0) {
        break;
      }
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`未找到内容，等待500ms后重试 (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (paragraphs.length === 0) {
      alert('未找到小说内容');
      return;
    }
    
    // 重置并开始新的朗读
    currentChunkIndex = 0;
    allChunks = [];
    
    // 开始分段朗读
    readNextParagraph();
    
    isReading = true;
    updateUI();
  }
  
  // 按字数分割文本，确保每个chunk以标点符号结尾
  function splitTextIntoChunks(text, size) {
    const chunks = [];
    let i = 0;
    const punctuation = /[，。！？、；：""''）】》"'）\s]/;
    
    while (i < text.length) {
      let end = Math.min(i + size, text.length);
      
      // 如果不是最后一段，尝试找到标点符号作为结尾
      if (end < text.length) {
        // 从end位置向前查找标点符号
        let foundPunctuation = -1;
        for (let j = end; j > i; j--) {
          if (punctuation.test(text[j - 1])) {
            foundPunctuation = j;
            break;
          }
        }
        
        if (foundPunctuation > i) {
          end = foundPunctuation;
        }
      }
      
      const rawChunk = text.substring(i, end);
      const cleanChunk = rawChunk
        .replace(/[\r\n\t]+/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[。.]/g, '，')
        .trim();
      
      if (cleanChunk) {
        chunks.push(cleanChunk);
      }
      
      i = end;
    }
    
    return chunks;
  }
  
  // 朗读下一段
  async function readNextParagraph() {
    console.log('=== 开始朗读 ===');
    console.log('当前chunk索引:', currentChunkIndex);
    console.log('chunk总数:', allChunks.length);
    
    // 第一次调用时，统一分割所有文本
    if (allChunks.length === 0 && paragraphs.length > 0) {
      // 合并所有段落为一个文本
      const fullText = paragraphs.join(' ');
      console.log('合并后的文本长度:', fullText.length);
      
      // 按字数分割，确保以标点符号结尾
      allChunks = splitTextIntoChunks(fullText, chunkSize);
      
      console.log('分割后的chunks数量:', allChunks.length);
      console.log('前3个chunks:', allChunks.slice(0, 3));
    }
    
    if (currentChunkIndex >= allChunks.length) {
      // 读完所有chunks，尝试跳转到下一章
      console.log('已读完所有chunks，尝试跳转到下一章');
      if (goToNextChapter()) {
        console.log('已开始跳转到下一章');
        // 页面会跳转，不需要进一步处理
      } else {
        console.log('未找到下一章链接');
        isReading = false;
        updateUI();
        alert('已读完本章，未找到下一章链接');
      }
      return;
    }
    
    if (speechEngine === 'browser') {
      // 使用浏览器内置语音合成
      if (!speechSynth) {
        if (!initSpeechSynthesis()) {
          isReading = false;
          updateUI();
          alert('您的浏览器不支持语音合成功能');
          return;
        }
      }
      
      // 停止之前的语音合成
      if (currentUtterance) {
        speechSynth.cancel();
        currentUtterance = null;
      }
      
      currentUtterance = new SpeechSynthesisUtterance(allChunks[currentChunkIndex]);
      currentUtterance.lang = 'zh-CN';
      currentUtterance.rate = speechSpeed;
      currentUtterance.pitch = 1.0;
      currentUtterance.volume = 1.0;
      
      // 朗读结束事件
      currentUtterance.onend = function() {
        currentChunkIndex++;
        readNextParagraph();
      };
      
      // 开始朗读
      speechSynth.speak(currentUtterance);
    } else if (speechEngine === 'openai') {
      // 使用本地TTS服务
      
      if (isAudioPlaying) {
        console.log('音频正在播放，等待结束');
        return;
      }
      
      if (isSynthesizing) {
        console.log('正在合成音频，等待完成');
        return;
      }
      
      isSynthesizing = true;
      
      try {
        console.log('开始合成音频，文本:', allChunks[currentChunkIndex].substring(0, 30) + '...');
        const audio = await synthesizeSpeech(allChunks[currentChunkIndex]);
        
        if (!audio) {
          console.warn('未获取到音频');
          isSynthesizing = false;
          consecutiveErrors++;
          
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            isReading = false;
            updateUI();
            alert('TTS服务异常，请检查本地TTS服务是否正常运行（http://localhost:5050）');
            return;
          }
          
          currentChunkIndex++;
          setTimeout(() => readNextParagraph(), 100);
          return;
        }
        
        isSynthesizing = false;
        isAudioPlaying = true;
        consecutiveErrors = 0;
        console.log('音频开始播放');
        
        let hasHandledEnd = false;
        
        function handleChunkEnd() {
          if (hasHandledEnd) return;
          hasHandledEnd = true;
          isAudioPlaying = false;
          currentChunkIndex++;
          readNextParagraph();
        }
        
        audio.onended = function() {
          console.log('音频播放结束');
          handleChunkEnd();
        };
        
        audio.onerror = function(e) {
          console.error('音频错误:', e);
          handleChunkEnd();
        };
        
        audio.play().catch(e => {
          console.error('播放失败:', e);
          handleChunkEnd();
        });
        
      } catch (error) {
        console.error('合成失败:', error);
        isSynthesizing = false;
        currentChunkIndex++;
        setTimeout(() => readNextParagraph(), 100);
      }
    }
  }
  
  // 停止朗读（暂停）
  function stopReading() {
    if (speechSynth) {
      speechSynth.cancel();
    }
    if (currentAudio) {
      currentAudio.pause();
    }
    isReading = false;
    isAudioPlaying = false;
    isSynthesizing = false;
    console.log('暂停朗读，当前位置:', currentChunkIndex, '/', allChunks.length);
    updateUI();
  }

  // 继续朗读
  function resumeReading() {
    if (currentAudio) {
      currentAudio.play();
      isReading = true;
      isAudioPlaying = true;
      updateUI();
    } else if (currentChunkIndex < allChunks.length) {
      readNextParagraph();
    }
  }
  
  // 开始自动翻页
  function startAutoScroll() {
    if (isAutoScrolling) return;
    
    isAutoScrolling = true;
    autoScrollInterval = setInterval(function() {
      window.scrollBy(0, 1);
    }, scrollSpeed);
    updateUI();
  }
  
  // 停止自动滚动
  function stopAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
    isAutoScrolling = false;
    updateUI();
  }
  
  // 从点击位置开始朗读
  function startReadingFromPosition(x, y, selectionText = null) {
    console.log('=== 开始从点击位置朗读 ===');
    console.log('点击位置:', x, y);
    console.log('选择的文本:', selectionText);
    
    // 停止之前的朗读
    console.log('停止之前的朗读');
    stopReading();
    
    console.log('提取小说内容');
    extractNovelContent();
    console.log('提取到的段落数量:', paragraphs.length);
    
    if (paragraphs.length === 0) {
      console.log('未找到小说内容');
      alert('未找到小说内容');
      return;
    }
    
    // 先分割所有文本成 chunks
    const fullText = paragraphs.join(' ');
    console.log('合并后的文本长度:', fullText.length);
    
    let targetChunkIndex = 0;
    
    // 如果有选择的文本，从该位置开始分割
    if (selectionText) {
      console.log('使用选择的文本来定位起始位置');
      const cleanSelection = selectionText.trim()
        .replace(/[\r\n\t]+/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[。.]/g, '，');
      
      console.log('清理后的选择文本:', cleanSelection);
      console.log('完整文本前200字符:', fullText.substring(0, 200));
      
      // 找到选择文本在完整文本中的位置
      let selectionPos = fullText.indexOf(cleanSelection);
      
      // 如果找不到，尝试只匹配选择文本的前30个字符
      if (selectionPos === -1 && cleanSelection.length > 30) {
        const partialSelection = cleanSelection.substring(0, 30);
        console.log('尝试匹配部分文本:', partialSelection);
        selectionPos = fullText.indexOf(partialSelection);
      }
      
      if (selectionPos !== -1) {
        console.log('找到选择文本的位置:', selectionPos);
        
        // 从该位置开始截取文本
        const textFromSelection = fullText.substring(selectionPos);
        console.log('截取后的文本前200字符:', textFromSelection.substring(0, 200));
        
        // 只分割从选择位置开始的文本
        allChunks = splitTextIntoChunks(textFromSelection, chunkSize);
        
        targetChunkIndex = 0;
        console.log('从选择位置开始分割，chunks数量:', allChunks.length);
        console.log('第一个chunk:', allChunks[0]);
      } else {
        console.log('未找到选择文本，使用完整文本');
        allChunks = splitTextIntoChunks(fullText, chunkSize);
      }
    } else {
      allChunks = splitTextIntoChunks(fullText, chunkSize);
    }
    
    // 设置当前chunk索引
    currentChunkIndex = targetChunkIndex;
    console.log('设置当前chunk索引:', currentChunkIndex);
    
    // 开始朗读
    console.log('开始朗读');
    readNextParagraph();
    isReading = true;
    updateUI();
  }
  
  // 调整滚动速度
  function setScrollSpeed(speed) {
    scrollSpeed = speed;
    if (isAutoScrolling) {
      stopAutoScroll();
      startAutoScroll();
    }
  }
  
  // 更新UI状态（保留空函数以兼容）
  function updateUI() {
    // 不再需要更新网页组件
  }
  
  // 初始化
  function init() {
    // 从存储中读取设置
    console.log('开始从存储中读取设置');
    chrome.storage.local.get(['speechEngine', 'voice', 'speechSpeed', 'speechPitch', 'speechStyle', 'chunkSize', 'scrollSpeed', 'filterKeywords'], (result) => {
      console.log('从存储中读取的设置:', result);
      if (result.speechEngine) {
        speechEngine = result.speechEngine;
        console.log(`从存储中加载语音引擎设置: ${speechEngine}`);
      }
      if (result.voice) {
        voice = result.voice;
        console.log(`从存储中加载音色设置: ${voice}`);
      }
      if (result.speechSpeed) {
        speechSpeed = result.speechSpeed;
        console.log(`从存储中加载语速设置: ${speechSpeed}`);
      }
      if (result.speechPitch !== undefined) {
        speechPitch = result.speechPitch;
        console.log(`从存储中加载音调设置: ${speechPitch}`);
      }
      if (result.speechStyle !== undefined) {
        speechStyle = result.speechStyle;
        console.log(`从存储中加载风格设置: ${speechStyle}`);
      }
      if (result.chunkSize) {
        chunkSize = result.chunkSize;
        console.log(`从存储中加载分割字数设置: ${chunkSize}`);
      }
      if (result.scrollSpeed) {
        scrollSpeed = result.scrollSpeed;
        console.log(`从存储中加载翻页速度设置: ${scrollSpeed}`);
      }
      // 加载自定义过滤关键词
      if (result.filterKeywords && Array.isArray(result.filterKeywords)) {
        filterKeywords = filterKeywords.concat(result.filterKeywords);
        console.log(`从存储中加载过滤关键词:`, result.filterKeywords);
      }
      
      // 初始化语音合成
      initSpeechSynthesis();
      
      // 检查是否需要自动开始阅读 (从sessionStorage)
      const autoReading = sessionStorage.getItem('autoReading') === 'true';
      console.log('检查自动阅读标志:', autoReading);
      if (autoReading) {
        console.log('检测到自动阅读标志，开始朗读');
        // 清除自动阅读标志
        sessionStorage.removeItem('autoReading');
        console.log('已清除自动阅读标志:', sessionStorage.getItem('autoReading'));
        // 延迟一点时间再开始朗读，确保页面完全加载
        setTimeout(() => {
          console.log('延迟后开始朗读');
          startReading();
        }, 1000);
      } else {
        console.log('未检测到自动阅读标志');
      }
      
      console.log('小说阅读器插件已初始化');
    });
    
    // 监听hash变化（SPA网站导航）
    window.addEventListener('hashchange', () => {
      console.log('检测到hash变化，重置状态');
      stopReading();
      stopAutoScroll();
      paragraphs = [];
      allChunks = [];
      currentChunkIndex = 0;
    });
  }
  
  // 监听消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('=== 收到消息 ===');
    console.log('消息类型:', message?.type);
    console.log('消息内容:', message);
    console.log('发送者:', sender);
    
    if (message?.type === 'TOGGLE_READING') {
      if (isReading) {
        stopReading();
      } else if (currentAudio) {
        resumeReading();
      } else if (currentChunkIndex < allChunks.length) {
        resumeReading();
      } else {
        startReading();
      }
    } else if (message?.type === 'TOGGLE_AUTO_SCROLL') {
      if (isAutoScrolling) {
        stopAutoScroll();
      } else {
        startAutoScroll();
      }
    } else if (message?.type === 'SET_SPEECH_ENGINE') {
      const { engine } = message.payload || {};
      if (engine) {
        speechEngine = engine;
        // 重新初始化语音合成
        initSpeechSynthesis();
        console.log(`语音引擎已切换为: ${engine}`);
      }
    } else if (message?.type === 'SET_VOICE') {
      const { voice: newVoice } = message.payload || {};
      if (newVoice) {
        voice = newVoice;
        console.log(`音色已切换为: ${newVoice}`);
      }
    } else if (message?.type === 'SET_SPEECH_SPEED') {
      const { speed: newSpeed } = message.payload || {};
      if (newSpeed) {
        speechSpeed = newSpeed;
        console.log(`语速已设置为: ${newSpeed}`);
      }
    } else if (message?.type === 'SET_SPEECH_PITCH') {
      const { pitch: newPitch } = message.payload || {};
      if (newPitch !== undefined) {
        speechPitch = newPitch;
        console.log(`音调已设置为: ${newPitch}`);
      }
    } else if (message?.type === 'SET_STYLE') {
      const { style: newStyle } = message.payload || {};
      if (newStyle !== undefined) {
        speechStyle = newStyle;
        console.log(`风格已设置为: ${newStyle}`);
      }
    } else if (message?.type === 'SET_CHUNK_SIZE') {
      const { chunkSize: newChunkSize } = message.payload || {};
      if (newChunkSize) {
        chunkSize = newChunkSize;
        console.log(`分割字数已设置为: ${newChunkSize}`);
      }
    } else if (message?.type === 'SET_SCROLL_SPEED') {
      const { speed: newSpeed } = message.payload || {};
      if (newSpeed) {
        setScrollSpeed(newSpeed);
        console.log(`翻页速度已设置为: ${newSpeed}`);
      }
    } else if (message?.type === 'SET_FILTER_KEYWORDS') {
      const { keywords } = message.payload || {};
      if (keywords && Array.isArray(keywords)) {
        filterKeywords = keywords;
        console.log(`过滤关键词已更新:`, filterKeywords);
      }
    } else if (message?.type === 'GET_STATE') {
      sendResponse({
        isReading,
        isAutoScrolling,
        scrollSpeed,
        currentChunkIndex,
        totalChunks: allChunks.length,
        hasPausedAudio: currentAudio !== null && !isReading
      });
      return true;
    } else if (message?.type === 'START_READING_HERE') {
      console.log('处理START_READING_HERE消息');
      const { clickX, clickY, selectionText } = message.payload || {};
      console.log('点击位置:', clickX, clickY);
      console.log('选择的文本:', selectionText);
      // 即使没有点击位置，也可以使用选择的文本开始朗读
      startReadingFromPosition(clickX, clickY, selectionText);
    }
    
    sendResponse({ success: true });
    return true;
  });
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // 向background.js发送消息，请求创建右键菜单
  console.log('发送CREATE_CONTEXT_MENU消息');
  chrome.runtime.sendMessage({ type: 'CREATE_CONTEXT_MENU' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('发送CREATE_CONTEXT_MENU消息失败:', chrome.runtime.lastError);
    } else {
      console.log('CREATE_CONTEXT_MENU消息发送成功，响应:', response);
    }
  });
})();