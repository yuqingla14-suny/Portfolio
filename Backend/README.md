# 作品集內容管理後台

## GitHub Pages 後台（可從一般瀏覽器開啟）

部署本專案後，使用 `https://yuqingla14-suny.github.io/Portfolio/Backend/` 開啟後台。第一次使用前，請在 GitHub 的 Settings → Developer settings → Personal access tokens → Fine-grained tokens 建立一組只授權 `yuqingla14-suny/Portfolio`、Repository permissions 的 `Contents: Read and write` 權杖。後台登入時貼上權杖；權杖僅存在目前瀏覽器分頁的 `sessionStorage`，不會寫入網站或 Git。

後台上傳圖片會提交圖片檔，按「提交更新到 GitHub」會再提交 `Backend/data/site-content.json`。GitHub Pages 完成自動部署後，網站會顯示新版內容；部署通常需要一點時間。GitHub Contents API 需要具有該儲存庫 `Contents: write` 權限的權杖。[GitHub 官方 API 文件](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)

## 本機後台

在專案根目錄執行：

```sh
node Backend/server.mjs
```

然後開啟 <http://127.0.0.1:4173/Backend/>。第一次進入時建立管理帳號；帳號需為 3–40 個英數字元，密碼至少 12 個字元。這是本機編輯模式，內容儲存在專案檔案中。後台不需要安裝額外套件。

## 可管理內容

- 關於我：人物標籤、個人標籤、內文、近期分享一句話。
- 精選作品：影片、照片、平面設計、繪畫；中英文標題、媒介、內文、影片連結與多張圖片。
- 專案作品：現有專案和新增專案的中英文標題、標籤、年份、介紹與多張圖片。多張圖片會在案例頁顯示輪播。
- 文章：主標題、副標題（可留空）、日期、分類、摘要，可新增多組小標題與內文，並上傳多張文末圖片（每列兩張）。

內容儲存在 `Backend/data/site-content.json`，上傳圖片存在 `images/uploads/`。本機伺服器只監聽 `127.0.0.1`，不會直接暴露到外部網路。圖片限制為 JPG、PNG、WEBP、GIF，單張上限 15MB。

GitHub Pages 只提供靜態檔案，因此遠端後台透過 GitHub API 提交網站資料，並不在 Pages 上執行 Node 伺服器。若選擇本機模式，變更需由使用者另外推送到 GitHub。
