# Piper TTS 轻量级服务

适合 **2核2G CentOS7 服务器** 部署的轻量级 TTS 服务，资源占用低、响应速度快。

## 特点

- **轻量级**：模型仅 50MB，内存占用 < 500MB
- **速度快**：CPU 实时合成，无需 GPU
- **兼容性好**：API 接口与现有扩展完全兼容
- **中文优化**：使用华燕女声，中文发音标准

## 服务器要求

- **CPU**: 2核+
- **内存**: 2GB+
- **系统**: CentOS 7 / Ubuntu 18.04+
- **Docker**: 已安装

## 快速部署

### 1. 安装 Docker（如未安装）

```bash
# CentOS 7 安装 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 部署 TTS 服务

```bash
# 克隆代码
git clone https://github.com/zhangshenglizhufeng/bookwormAudioReadingChromeExtension.git
cd bookwormAudioReadingChromeExtension/piper-tts

# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 3. 验证部署

```bash
# 测试服务
curl http://localhost:5051/

# 测试音色列表
curl http://localhost:5051/api/tts/list

# 测试合成
curl -X POST http://localhost:5051/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input":"你好，这是测试","voice":"zh_CN-huayan-medium"}' \
  --output test.wav
```

## Chrome 扩展配置

部署完成后，修改扩展设置连接到远程 TTS 服务：

1. 打开扩展设置
2. 找到 TTS 服务地址设置
3. 将 `http://localhost:5050` 改为 `http://你的服务器IP:5051`

## 常用命令

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 更新镜像
docker-compose pull
docker-compose up -d
```

## 性能优化

对于 2核2G 服务器，已配置：
- CPU 限制：1.5核
- 内存限制：1GB
- 健康检查：自动重启异常容器

## 故障排查

### 服务启动慢
首次启动需要下载模型（约 50MB），请耐心等待。

### 合成速度慢
- 检查服务器负载：`top` 或 `htop`
- 调整文本长度，建议每段 < 100 字
- 考虑升级服务器配置

### 内存不足
- 检查内存使用：`free -h`
- 减少 Docker 内存限制到 512M
- 关闭其他不必要的服务

## 与本地 TTS 对比

| 特性 | 本地 mzzsfy/tts | 远程 Piper TTS |
|------|----------------|----------------|
| 资源占用 | 较高 | 低 |
| 模型大小 | ~100MB | ~50MB |
| 内存使用 | ~1GB | ~500MB |
| 适用场景 | 本地开发 | 远程服务器 |
| 中文音色 | 多种选择 | 华燕女声 |

## 参考

- [Piper TTS GitHub](https://github.com/rhasspy/piper)
- [Piper 语音模型](https://huggingface.co/rhasspy/piper-voices)
