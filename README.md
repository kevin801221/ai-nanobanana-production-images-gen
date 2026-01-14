# 🚀 ProductScene AI - 專業商用產品照生成器

ProductScene AI 是一款運用 Google **Gemini 2.5 Flash Image** 技術的智慧型工具，專為電商賣家、行銷人員與設計師打造。它能將普通的商品實體照片，瞬間轉換為各種風格的高品質攝影棚級場景。

![ProductScene AI Showcase](app-showcase.png)
*圖：將 MacBook 完美置入沙漠場景的生成範例（包含多種風格變化）*

## ✨ 核心功能

- **🎯 精準主體擷取**：上傳商品照片後，透過內建裁切工具鎖定核心區域，AI 會自動識別並完美分離商品與原始背景。
- **🏜️ 智慧場景生成**：輸入中文或英文提示詞（例如：「在高級大理石檯面上，搭配柔和早晨陽光」），AI 將為你構建全新環境。
- **🎭 多樣化版本 (Variations)**：一次生成 3 至 5 種不同的場景演繹，讓你從中挑選最符合品牌調性的完美瞬間。
- **📸 即時拍照與上傳**：支援行動端相機直接拍攝商品，或從電腦上傳現有圖檔。
- **⏳ 歷史紀錄管理**：隨時回顧過去生成的作品，並能一鍵載入先前的參數重新生成。

## 🛠️ 技術架構

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS (響應式設計，支援手機與桌面端)
- **AI Model**: [Google Gemini 2.5 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-v2#gemini-2.5-flash-image)
- **Icons**: Lucide React
- **Image Processing**: React Easy Crop

## 🚀 快速開始

1. **上傳商品**：點擊上傳或使用相機拍攝。
2. **調整範圍**：使用裁切工具確保商品主體位於中心。
3. **描述場景**：在下方輸入框寫下你夢想中的背景（支援多種預設風格）。
4. **生成變體**：點擊「Generate Variations」並等待 5-10 秒。
5. **下載與分享**：選擇最滿意的一張點擊下載按鈕。

---

> **隱私說明**：本專案使用環境變數 `process.env.API_KEY` 安全管理 Gemini API Key，確保您的金鑰不會洩漏。

---
由 **ProductScene AI** 團隊開發，賦予您的產品無限可能。
