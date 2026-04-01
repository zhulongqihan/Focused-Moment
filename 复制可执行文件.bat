@echo off
chcp 65001 >nul
echo ========================================
echo   复制可执行文件
echo ========================================
echo.

if exist "src-tauri\target\release\tauri-app.exe" (
    echo 找到 tauri-app.exe，正在复制...
    copy "src-tauri\target\release\tauri-app.exe" "Focused-Moment.exe"
    echo.
    echo ========================================
    echo 复制完成！
    echo.
    echo 可执行文件：Focused-Moment.exe
    echo.
    echo 你可以直接运行这个文件。
    echo ========================================
) else if exist "src-tauri\target\release\focused-moment.exe" (
    echo 找到 focused-moment.exe，正在复制...
    copy "src-tauri\target\release\focused-moment.exe" "Focused-Moment.exe"
    echo.
    echo ========================================
    echo 复制完成！
    echo.
    echo 可执行文件：Focused-Moment.exe
    echo.
    echo 你可以直接运行这个文件。
    echo ========================================
) else (
    echo ========================================
    echo 错误：未找到可执行文件！
    echo.
    echo 请先运行 "构建应用.bat" 构建应用。
    echo.
    echo 如果已经构建，请检查以下目录：
    echo src-tauri\target\release\
    echo ========================================
)

echo.
pause
