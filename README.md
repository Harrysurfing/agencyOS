# AgencyOS — Triangle Agency 特工状态看板

面向 **Triangle Agency** TRPG 的静态看板：展示机构状态、特工资质与 ARC 进度、申领物、机构动态等。玩家通过浏览器查看；数据由 GM 使用本仓库内的 **GM Editor** 编辑后更新。

## 功能概览

- **机构状态**：混沌值、散逸端、机构动态（新闻）
- **特工看板**：特工选择、嘉奖/申诫、资质保证 (QA)、察看期、MVP
- **ARC 记录条**：职能 / 现实 / 异常 三条轨道进度与词条（能力、关系、申领物等）
- **申领物列表**、**任务档案库**、**机构骰子** 等
- **收件箱**：GM 可通过 GM Editor 发送一封「新邮件」，玩家打开 AgencyOS 时会看到提醒并可查看

## 部署到 GitHub Pages

1. 将 **agencyOS 文件夹** 作为仓库根目录推送到 GitHub（或推送整个 agencyOS 仓库）
2. 在仓库 **Settings → Pages** 中启用 GitHub Pages
3. 选择所用分支，源选择 **根目录** `/`
4. 发布后访问 `https://<你的用户名>.github.io/<仓库名>/`

## 本地预览

在 **agencyOS 目录下** 启动静态服务器：

```bash
cd agencyOS
python -m http.server 8000
# 或
npx serve .
```

然后打开 `http://localhost:8000`。

若在上一级目录（如 `taApp`）启动服务器，则需在 URL 中加上子路径，例如 `http://localhost:8000/agencyOS/`。

## 文件结构

```
agencyOS/
├── index.html              # 主看板页面
├── README.md
├── .gitignore               # 含 missionNotes/，任务笔记不纳入版本控制
├── assets/                  # 图片资源
│   ├── gm-profile.png      # 机构总经理头像
│   ├── agent-1.png         # 特工头像（按 agent id 命名）
│   └── ...
├── data/                    # 所有状态与任务数据（可由 GM Editor 编辑）
│   ├── statuses.json       # 机构 + 特工状态（核心数据）
│   ├── arc-reference.json  # ARC 参考（异常/现实/职能词条与能力）
│   ├── items.json         # 申领物目录
│   ├── mission.json       # 任务报告列表
│   ├── siphon.json        # Siphon 商店配置
│   └── inMail.json        # 收件箱邮件（至多一封，GM 通过 GM Editor 设置）
├── missionNotes/            # 任务笔记（Markdown），gitignore，仅本地
└── gm-editor/               # GM 编辑工具（见 gm-editor/README.md）
    ├── server.js
    ├── public/
    └── README.md
```

## 特工头像

- **命名**：将头像命名为 `{agent-id}.png`（或 `.PNG`）放入 `assets/`，例如 `agent-1.png`
- **自定义路径**：可在 `statuses.json` 中为特工设置 `"profilePic": "assets/自定义路径.png"` 覆盖默认

## 数据更新

- 看板从 `data/` 下的 JSON 静态加载数据；**更新并推送** `data/statuses.json`（或其它 data 文件）后，刷新页面即可看到最新内容
- 推荐使用仓库内的 **GM Editor** 编辑状态与任务，避免手改 JSON 出错（见 `gm-editor/README.md`）
