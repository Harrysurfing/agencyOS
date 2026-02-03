# Triangle Agency — 特工状态看板

静态页面，用于展示 Triangle Agency 游戏中特工的状态信息。

## 部署到 GitHub Pages

1. 将此文件夹内容推送到 [agencyOS](https://github.com/Harrysurfing/agencyOS) 仓库
2. 在仓库 **Settings → Pages** 中启用 GitHub Pages
3. 选择主分支，根目录 `/` 作为源
4. 页面将发布至 `https://harrysurfing.github.io/agencyOS/`

## 本地预览

```bash
# 使用 Python
python -m http.server 8000

# 或使用 npx
npx serve .
```

然后访问 `http://localhost:8000`（若使用 Python，需根据端口调整路径，例如 `http://localhost:8000/agencyOS/` 若从 taApp 根目录启动）

## 文件结构

```
agencyOS/
├── index.html          # 主页面
├── assets/             # 图片资源
│   ├── gm-profile.png  # 机构总经理头像
│   ├── agent-1.png     # 特工头像（按 agent id 命名）
│   └── ...
├── data/
│   ├── statuses.json   # 特工状态数据（源数据）
│   └── arc-reference.json  # ARC 参考（供本地编辑器使用）
└── README.md
```

## 特工头像

- **命名约定**：将头像图片命名为 `{agent-id}.png` 放入 `assets/` 目录，例如 `agent-1.png`、`agent-2.png`
- **注意**：请使用小写 `.png` 扩展名，GitHub Pages 部署在 Linux 服务器上，路径区分大小写
- **自定义路径**：也可在 `statuses.json` 中为特工添加 `"profilePic": "assets/自定义路径.png"` 覆盖默认

## 数据更新

当 `data/statuses.json` 被更新并推送到远程后，刷新页面即可看到最新状态。
