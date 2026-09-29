@echo off
chcp 65001 > nul
cd /d %~dp0

echo ============================================
echo  1/2  빌드 검사 중... (Python 없으면 건너뜀)
echo ============================================
where py >nul 2>nul && (
    py build.py || (echo [오류] 빌드 실패. 위 메시지를 확인하세요. & pause & exit /b 1)
) || echo Python 없음 - 검사 생략, 클라우드에서 빌드합니다.

echo.
echo ============================================
echo  2/2  GitHub에 올리는 중...
echo ============================================
git add -A
git commit -m "콘텐츠 업데이트 %date% %time%"
if errorlevel 1 echo (커밋할 변경사항이 없습니다)
echo 관리자 페이지에서 바뀐 내용 먼저 받아오는 중...
git pull --rebase
if errorlevel 1 (
    echo.
    echo [오류] 관리자 페이지 수정과 PC 수정이 같은 곳에서 겹쳤습니다.
    echo        이 창 내용을 Claude에게 보여주고 도움을 받으세요. 올리지 않았습니다.
    git rebase --abort 2>nul
    pause & exit /b 1
)
git push
if errorlevel 1 (
    echo.
    echo [오류] GitHub에 올리지 못했습니다. 위 메시지를 Claude에게 보여주세요.
    pause & exit /b 1
)

echo.
echo ============================================
echo  완료! GitHub가 1~2분 안에 빌드해서 반영합니다.
echo  진행상황: https://github.com/Chemifriend/chemifriend.github.io/actions
echo ============================================
pause
