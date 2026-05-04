# Piper TTS 轻量级服务
# 适合 2核2G 服务器部署

FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 安装 Piper TTS
RUN pip install --no-cache-dir piper-tts fastapi uvicorn

# 下载中文语音模型 (约 50MB)
# 使用 zh_CN-huayan-medium 模型，音质好且速度快
RUN mkdir -p /app/models && \
    cd /app/models && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json

# 复制服务代码
COPY piper_tts_service.py /app/

# 暴露端口
EXPOSE 5051

# 启动服务
CMD ["python", "piper_tts_service.py"]
