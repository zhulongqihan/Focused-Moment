@echo off
chcp 65001 >nul
echo ========================================
echo   Focused Moment 开发环境启动
echo ========================================
echo.
echo 正在启动开发服务器...
echo.
echo 提示：
echo - 前端开发服务器将在 http://localhost:5173 启动
echo - Tauri 应用窗口将自动打开
echo - 修改代码后会自动热重载
echo - 按 Ctrl+C 可以停止服务器
echo.
echo ========================================
echo.

npm run tauri:dev
