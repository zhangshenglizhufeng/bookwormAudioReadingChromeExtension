// 测试本地TTS服务的脚本
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testLocalTTSService() {
  console.log('开始测试本地TTS服务...');
  
  try {
    // 测试API是否可访问
    const healthCheckResponse = await axios.get('http://localhost:5050', {
      timeout: 5000
    });
    console.log('✅ 本地TTS服务健康检查成功');
    
    // 测试语音合成
    console.log('测试语音合成功能...');
    const testText = '这是一段测试文本，用于验证本地TTS服务是否正常工作。';
    
    const ttsResponse = await axios.post('http://localhost:5050/v1/audio/speech', {
      model: 'tts-1',
      input: testText,
      voice: 'alloy',
      response_format: 'mp3',
      speed: 1.0
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your_api_key_here'
      },
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    // 保存音频文件
    const outputPath = path.join(__dirname, 'test-output.mp3');
    fs.writeFileSync(outputPath, ttsResponse.data);
    console.log(`✅ 语音合成成功，音频文件已保存到: ${outputPath}`);
    
    // 测试不同的语音
    console.log('测试不同的语音...');
    const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    
    for (const voice of voices) {
      try {
        const voiceResponse = await axios.post('http://localhost:5050/v1/audio/speech', {
          model: 'tts-1',
          input: `这是使用${voice}语音的测试文本。`,
          voice: voice,
          response_format: 'mp3',
          speed: 1.0
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your_api_key_here'
          },
          responseType: 'arraybuffer',
          timeout: 10000
        });
        
        const voiceOutputPath = path.join(__dirname, `test-${voice}.mp3`);
        fs.writeFileSync(voiceOutputPath, voiceResponse.data);
        console.log(`✅ ${voice} 语音测试成功`);
      } catch (error) {
        console.log(`❌ ${voice} 语音测试失败: ${error.message}`);
      }
    }
    
    console.log('\n🎉 本地TTS服务测试完成！');
    console.log('测试结果：');
    console.log('- 服务健康检查: ✅ 成功');
    console.log('- 语音合成: ✅ 成功');
    console.log('- 多语音测试: 部分完成');
    console.log('\n请检查生成的音频文件以验证语音质量。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log('\n请检查：');
    console.log('1. 本地TTS服务是否已启动');
    console.log('2. Docker容器是否正在运行');
    console.log('3. 端口5050是否被占用');
    console.log('4. API密钥是否正确配置');
  }
}

// 运行测试
testLocalTTSService();
