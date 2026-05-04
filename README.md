# 书虫有声阅读chrome插件

一个功能强大的浏览器扩展，为小说网站提供有声阅读和自动翻页功能。

## 功能特点

- 🎧 **有声阅读**：支持浏览器内置TTS和OpenAI TTS（开源模型）
- 📖 **自动翻页**：可调节翻页速度
- 🎯 **智能分段**：按标点符号智能分割文本，确保朗读流畅
- 🔍 **右键朗读**：选择文本后右键从当前位置开始朗读
- 🛠️ **广告过滤**：自定义关键词过滤广告内容
- 🌐 **跨网站兼容**：支持奇书网、笔趣阁等多个小说网站

## 界面预览

### 主界面

![主界面](./screenshots/index.png)

### 朗读设置

![朗读设置](./screenshots/index2.png)

## 安装方法

### 方法一：从 Chrome 商店安装

（未来发布到 Chrome 商店后）

### 方法二：本地加载

1. **克隆代码**
   ```bash
   git clone https://github.com/zhangshenglizhufeng/bookwormAudioReadingChromeExtension.git
   cd bookwormAudioReadingChromeExtension
   ```

2. **打开 Chrome 扩展管理页面**
   - 输入 `chrome://extensions/` 到地址栏
   - 开启右上角的「开发者模式」

3. **加载扩展**
   - 点击「加载已解压的扩展程序」
   - 选择 `novel-reader-extension` 文件夹

## 使用指南

### 基本使用

1. **打开小说网站**（如奇书网、笔趣阁等）
2. **点击扩展图标**打开控制面板
3. **点击「开始朗读」**开始有声阅读
4. **点击「开始自动翻页」**启用自动翻页

### 右键朗读

1. **选择文本**：在小说页面选择一段文字
2. **右键点击**：选择「从这里开始阅读」
3. **开始朗读**：扩展会从选择的位置开始朗读

### 调整设置

- **语音引擎**：选择浏览器内置或OpenAI TTS
- **音色**：选择不同的语音（Alloy、Echo、Fable等）
- **语速**：调节朗读速度（0.5-2.0）
- **分割字数**：调整文本分段大小（100-300）
- **翻页速度**：调整自动翻页速度（值越小越快）
- **广告过滤**：添加自定义关键词过滤广告

## TTS 服务部署

扩展支持多种 TTS 服务，可根据需求选择：

| 服务 | 适用场景 | 资源占用 | 部署难度 |
|------|---------|---------|---------|
| **浏览器内置** | 快速体验 | 无 | 无需部署 |
| **Azure TTS (本地)** | 本地使用，多音色 | 中等 (~1GB内存) | 简单 |
| **Piper TTS (远程)** | 低配置服务器，省资源 | 低 (~500MB内存) | 中等 |

---

## 方案一：Azure TTS 本地部署（推荐）

适合本地使用，支持多种音色选择。

### 前置要求：安装 Docker Desktop（Windows）

1. **下载 Docker Desktop**
   - 访问 [Docker 官网](https://www.docker.com/products/docker-desktop/)
   - 下载 Windows 版本安装包

2. **安装 Docker Desktop**
   - 运行下载的安装程序
   - 按提示完成安装（可能需要重启电脑）
   - 启动 Docker Desktop，确保左下角显示 "Docker Desktop is running"

3. **验证安装**
   ```bash
   docker --version
   docker-compose --version
   ```

### 部署 TTS 服务（mzzsfy/tts 镜像）

本项目使用 `mzzsfy/tts` Docker 镜像，这是一个基于 Microsoft Azure TTS 的开源语音合成服务。

**镜像信息**：
- **镜像名**：`mzzsfy/tts:latest`
- **镜像大小**：约 27 MB
- **服务端口**：5050
- **基于**：Alpine Linux + Azure TTS SDK

#### 方法一：使用 Docker Compose 部署（推荐）

项目已包含 `docker-compose.yml` 文件，一键启动：

```bash
# 在扩展目录执行
docker-compose up -d
```

`docker-compose.yml` 内容：
```yaml
version: '3.8'
services:
  tts:
    image: mzzsfy/tts:latest
    container_name: novel-reader-tts
    ports:
      - "5050:5050"
    restart: unless-stopped
```

#### 方法二：使用 Docker 命令直接运行

```bash
docker run -d \
  --name novel-reader-tts \
  -p 5050:5050 \
  --restart unless-stopped \
  mzzsfy/tts:latest
```

#### 方法三：使用 Docker Desktop GUI

1. 打开 Docker Desktop
2. 点击顶部搜索框，搜索 `mzzsfy/tts`
3. 点击 `Pull` 拉取镜像
4. 点击 `Run`，配置端口映射 `5050:5050`
5. 点击 `Run` 启动容器

### 验证服务

启动后访问：
```
http://localhost:5050
```

或测试 API：
```bash
curl http://localhost:5050/api/tts/list
```

### TTS 服务配置

- **服务地址**：`http://localhost:5050`
- **API 端点**：`/v1/audio/speech`
- **音色列表**：`/api/tts/list`
- **支持的引擎**：Microsoft Azure TTS
- **中文音色**：晓晓、晓伊、云希、云野、云霞、云阳、云健、云晓、小贝(辽宁)、晓妮(陕西)
- **语音风格**：聊天、平静、开心、悲伤、愤怒、恐惧、不满、严厉、撒娇、温柔
- **高级功能**：音调调整、语速调整、语言筛选、性别筛选

### 常用 Docker 命令

```bash
# 查看运行中的容器
docker ps

# 查看 TTS 服务日志
docker logs novel-reader-tts

# 停止 TTS 服务
docker stop novel-reader-tts

# 启动 TTS 服务
docker start novel-reader-tts

# 删除容器（重新部署时使用）
docker rm novel-reader-tts

# 更新镜像到最新版本
docker pull mzzsfy/tts:latest
docker-compose up -d
```

---

## 方案二：Piper TTS 远程部署（轻量级）

适合 **2核2G 云服务器** 部署，资源占用极低。

### 特点

- **轻量级**：模型仅 50MB，内存占用 < 500MB
- **速度快**：CPU 实时合成，无需 GPU
- **适合低配服务器**：2核2G 即可流畅运行

### 服务器要求

- **CPU**: 2核+
- **内存**: 2GB+
- **系统**: CentOS 7 / Ubuntu 18.04+
- **Docker**: 已安装

### 部署步骤

1. **进入 Piper TTS 目录**
   ```bash
   cd piper-tts
   ```

2. **启动服务**
   ```bash
   docker-compose up -d
   ```

3. **验证部署**
   ```bash
   curl http://localhost:5051/health
   ```

详细部署文档：[piper-tts/README.md](./piper-tts/README.md)

### Chrome 扩展配置

1. 打开扩展设置
2. 语音引擎选择 **"Piper TTS (远程轻量)"**
3. 填写服务器地址：`http://你的服务器IP:5051`
4. 点击"测试连接"验证

---

## 支持的网站

- ✅ 奇书网 (https://www.xqishuta.net)
- ✅ 笔趣阁 (https://www.bqg683.xyz, https://www.bqg104.cc)
- ✅ 其他大部分小说网站（自动适配）

## 常见问题

### Q: 为什么右键菜单没有「从这里开始阅读」选项？
A: 请确保：
- 已选择文本
- 扩展已正确加载
- 重新加载网页

### Q: TTS 服务连接失败怎么办？
A: 检查：
- Docker 服务是否运行
- TTS 服务端口是否为 5050
- 防火墙是否阻止了本地连接

### Q: 广告过滤不生效？
A: 请在设置中添加具体的广告关键词，每行一个。

## 技术架构

- **前端**：HTML5 + CSS3 + JavaScript
- **后端**：Python + FastAPI（TTS服务）
- **存储**：Chrome 存储 API
- **部署**：Docker Compose

## 开源协议

本项目采用 **Apache 2.0 许可证**，允许：

- ✅ 商业使用
- ✅ 修改代码
- ✅ 分发代码
- ✅ 私人使用

**注意**：Apache 2.0 许可证提供专利保护，适合商业项目使用。

## 贡献指南

1. **Fork 仓库**
2. **创建分支** (`git checkout -b feature/AmazingFeature`)
3. **提交修改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **打开 Pull Request**

## 联系方式

- **开发者**：野生程序员
- **微信**：ailiaofun
- **邮箱**：1354164181@qq.com
- **GitHub**：https://github.com/zhangshenglizhufeng

---

**享受有声阅读的乐趣！** 📚🎧