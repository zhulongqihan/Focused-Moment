# Focused Moment v2.3.12

## 结束提醒：老牧师原声

- 内置公开试听音频作为“胆子真是肥嘟嘟的（老牧师原声）”提醒选项。
- 音频播放失败时，自动回退到系统语音朗读，系统不支持语音时仍使用明亮三连音。
- 音频来源：Fish Audio 公开模型“老牧师”（模型 ID：`8a442e5e61594fccb1d745cad6cdd642`）。该页面示例文本包含本提醒文案，并提供 MP3/WAV 下载与商用使用说明；项目仅将公开试听示例作为提醒音使用。

## 验证

- `pnpm check`
- `pnpm test:frontend`
- `cargo test --manifest-path src-tauri/Cargo.toml`
