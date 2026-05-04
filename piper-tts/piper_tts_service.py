#!/usr/bin/env python3
"""
Piper TTS 轻量级服务
适合低配置服务器 (2核2G)
与现有 Chrome 扩展兼容的 API 接口
"""

import io
import json
import base64
import logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import uvicorn

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Piper TTS 轻量级服务", version="1.0.0")

# 全局 TTS 模型实例
tts_model = None

class TTSRequest(BaseModel):
    input: str
    voice: Optional[str] = "zh_CN-huayan-medium"
    rate: Optional[float] = 1.0
    pitch: Optional[float] = 0.0
    style: Optional[str] = None

class VoiceInfo(BaseModel):
    ShortName: str
    Locale: str
    Gender: str
    LocalName: str

@app.on_event("startup")
async def load_model():
    """启动时加载 TTS 模型"""
    global tts_model
    try:
        from piper import PiperVoice
        model_path = "/app/models/zh_CN-huayan-medium.onnx"
        config_path = "/app/models/zh_CN-huayan-medium.onnx.json"
        
        logger.info(f"正在加载 Piper TTS 模型...")
        tts_model = PiperVoice.load(model_path, config_path)
        logger.info("Piper TTS 模型加载完成")
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        raise

@app.get("/")
async def root():
    return {
        "service": "Piper TTS 轻量级服务",
        "version": "1.0.0",
        "model": "zh_CN-huayan-medium",
        "status": "running"
    }

@app.get("/api/tts/list")
async def list_voices():
    """返回支持的音色列表（与现有扩展兼容）"""
    voices = [
        {
            "ShortName": "zh_CN-huayan-medium",
            "Locale": "zh-CN",
            "Gender": "Female",
            "LocalName": "华燕"
        },
        {
            "ShortName": "zh_CN-huayan-medium-fast",
            "Locale": "zh-CN", 
            "Gender": "Female",
            "LocalName": "华燕(快速)"
        }
    ]
    return voices

@app.post("/v1/audio/speech")
async def synthesize_speech(request: TTSRequest):
    """
    语音合成接口，与现有 Chrome 扩展兼容
    """
    if not tts_model:
        raise HTTPException(status_code=503, detail="TTS 模型未加载")
    
    try:
        text = request.input
        if not text or len(text.strip()) == 0:
            raise HTTPException(status_code=400, detail="文本不能为空")
        
        logger.info(f"合成文本: {text[:50]}...")
        
        # 使用 Piper 合成语音
        import numpy as np
        import soundfile as sf
        
        # 合成音频
        audio_data = []
        for audio_bytes in tts_model.synthesize_stream_raw(text):
            audio_data.append(audio_bytes)
        
        # 合并音频数据
        audio_array = np.concatenate(audio_data)
        
        # 调整语速（通过重采样）
        if request.rate != 1.0 and request.rate > 0:
            # 语速调整：rate > 1 加速，rate < 1 减速
            import scipy.signal
            audio_array = scipy.signal.resample(
                audio_array, 
                int(len(audio_array) / request.rate)
            )
        
        # 转换为 WAV 格式
        wav_buffer = io.BytesIO()
        sf.write(wav_buffer, audio_array, tts_model.config.sample_rate, format='WAV')
        wav_buffer.seek(0)
        
        logger.info(f"合成完成，音频大小: {len(wav_buffer.getvalue())} bytes")
        
        return Response(
            content=wav_buffer.getvalue(),
            media_type="audio/wav"
        )
        
    except Exception as e:
        logger.error(f"合成失败: {e}")
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")

@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "model_loaded": tts_model is not None
    }

if __name__ == "__main__":
    # 在 5051 端口启动（避免与本地 5050 冲突）
    uvicorn.run(app, host="0.0.0.0", port=5051)
