@echo off
chcp 65001 >nul
echo ========================================
echo   Focused Moment 应用构建
echo ========================================
echo.
echo 选择构建方式：
echo.
echo 1. 完整构建（包含安装程序）
echo 2. 仅构建可执行文件（推荐，跳过 WiX）
echo.
set /p choice="请输入选项 (1 或 2): "

if "%choice%"=="1" (
    echo.
    echo 正在执行完整构建...
    echo 注意：此过程可能需要下载 WiX Toolset，可能会很慢
    echo.
    npm run tauri:build
) else if "%choice%"=="2" (
    echo.
    echo 正在构建可执行文件...
    echo.
    npm run tauri:build:exe
    echo.
    echo ========================================
    echo 构建完成！
    echo.
    echo 可执行文件位置：
    echo src-tauri\target\release\focused-moment.exe
    echo.
    echo 注意：如果这是第一次构建，文件名可能是 tauri-app.exe
    echo 请检查 src-tauri\target\release\ 目录
    echo.
    echo 你可以直接运行这个文件，或者复制到其他位置使用。
    echo ========================================
) else (
    echo.
    echo 无效的选项，请重新运行脚本。
)

echo.
pause
