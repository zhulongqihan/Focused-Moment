@echo off
chcp 65001 >nul
echo ========================================
echo   Focused Moment 完全重建
echo ========================================
echo.
echo 此脚本将：
echo 1. 清理旧的构建文件
echo 2. 重新构建前端
echo 3. 重新构建后端
echo 4. 复制新的 exe 文件
echo.
echo 请确保已关闭所有 Focused Moment 实例！
echo.
pause
echo.

echo 步骤 1/5: 清理旧文件...
if exist "src-tauri\target\release\tauri-app.exe" (
    del "src-tauri\target\release\tauri-app.exe"
    echo ✓ 已删除旧的 tauri-app.exe
)
if exist "src-tauri\target\release\focused-moment.exe" (
    del "src-tauri\target\release\focused-moment.exe"
    echo ✓ 已删除旧的 focused-moment.exe
)
if exist "Focused-Moment.exe" (
    del "Focused-Moment.exe"
    echo ✓ 已删除根目录的 exe
)
echo.

echo 步骤 2/5: 清理 build 目录...
if exist "build" (
    rmdir /s /q "build"
    echo ✓ 已清理 build 目录
)
echo.

echo 步骤 3/5: 构建前端...
call npm run build
if errorlevel 1 (
    echo ✗ 前端构建失败！
    pause
    exit /b 1
)
echo ✓ 前端构建成功
echo.

echo 步骤 4/5: 构建后端...
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
set "CARGO=%USERPROFILE%\.cargo\bin\cargo.exe"
cargo build --manifest-path src-tauri/Cargo.toml --release
if errorlevel 1 (
    echo ✗ 后端构建失败！
    pause
    exit /b 1
)
echo ✓ 后端构建成功
echo.

echo 步骤 5/5: 复制可执行文件...
copy "src-tauri\target\release\focused-moment.exe" "Focused-Moment.exe"
if errorlevel 1 (
    echo ✗ 复制失败！
    pause
    exit /b 1
)
echo ✓ 复制成功
echo.

echo ========================================
echo 重建完成！
echo.
echo 可执行文件位置：
echo Focused-Moment.exe
echo.
echo 文件信息：
for %%I in ("Focused-Moment.exe") do (
    echo 大小: %%~zI 字节
    echo 修改时间: %%~tI
)
echo.
echo 现在可以运行 Focused-Moment.exe 了！
echo ========================================
echo.
pause
