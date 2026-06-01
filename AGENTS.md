# AGENTS.md — 자리 배치표

이 파일이 canonical 작업 지침이다. `CLAUDE.md`(Claude Code)와 `AGENTS.md`(Codex)는 같은 파일이다(symlink). Claude Code·Codex 공통.

---

## 목적

브라우저 단독 실행 정적 HTML 자리 배치표. 학반 학생 명렬을 붙여넣고 랜덤 배치 후 인쇄.  
설치·서버·회원가입 불필요. `index.html` 더블클릭으로 즉시 실행.

---

## 핵심 기능

| 기능 | 설명 |
|------|------|
| 명렬 입력 | 표 직접 입력 / 붙여넣기(줄 단위, 탭·쉼표 구분) / CSV·TXT 파일 업로드 |
| 랜덤 배치 | 전체 랜덤 / 고정 자리 제외 랜덤 |
| 자리 조작 | 드래그&드롭 교체, 클릭 선택 후 더블클릭 교체, 방향키 이동, 우클릭 고정/해제 |
| 실행 취소 | 랜덤·이동·교체·고정 모두 되돌리기 |
| 자동 저장 | 브라우저 localStorage에 명렬·배치·고정 정보 즉시 저장 |
| 내보내기/불러오기 | JSON 파일 백업 및 복원 |
| 인쇄 | 테마 5종(클래식·모던 미니멀·캐릭터·클로드톤·레트로), 폰트 6종 선택 후 출력 |
| 좌석 설정 | 열 수·행 수 조정(최대 12×12), 빈 자리 추가/제거 |
| 짝 구분 표시 | 2명 단위 짝을 색으로 구분하는 토글 |

---

## 파일 구조

```
index.html          # 유일한 실행 파일. CSS·JS 모두 인라인 단일 파일.
사용설명서.md        # 사용자 대상 기능 설명
.gitignore          # .DS_Store, .lazyweb/, .playwright-mcp/, .claude/, .omc/,
                    # index_recovered.html, 'index 복사본.html' 제외
```

**백업·임시 파일 (참고만, 수정·삭제 금지)**

- `index 복사본.html` — 로컬 작업 백업본 (.gitignore에 등록됨)
- `index_recovered.html` — 이전 복구 작업 산출물 (.gitignore에 등록됨)

---

## 단일 파일 원칙

- 빌드 도구 없음. 빌드 명령 없음. 패키지 없음.
- 모든 CSS와 JavaScript는 `index.html` 안에 인라인.
- 외부 의존성은 Google Fonts CDN과 Pretendard CDN(폰트 전용)뿐.
- 데이터는 브라우저 localStorage에만 저장. 서버 통신 없음.

---

## 코드 수정 원칙

- **수정 대상은 `index.html` 단독.** 다른 파일은 명시적 지시 없이 건드리지 않는다.
- 인라인 `<style>` 블록과 `<script>` 블록의 기존 구조를 유지한다.
- 기능 추가 시 외부 라이브러리·빌드 스텝 도입 금지.
- 변경 전 관련 함수·CSS 변수·DOM ID를 `index.html` 안에서 먼저 확인한다.

---

## 검증법

브라우저(Playwright MCP 또는 chrome-devtools MCP)로 핵심 플로우 확인:

1. `index.html`을 `file://` 프로토콜로 열기
2. 학생 편집 모달에서 이름 3개 이상 붙여넣기 후 적용
3. `🔀 전체 랜덤` 버튼 클릭 → 자리 배치 확인
4. `🖨️ 인쇄` 버튼 → 인쇄 미리보기 모달 열림 확인
5. 콘솔 에러 없음 확인

코드 검색: `rg` 또는 `Grep` 도구 사용.  
파일 편집: `apply_patch` 또는 `Edit`·`Write` 도구 사용.

---

## Git 정보

- Remote: `https://github.com/Namkicheol/seat-chart.git`
- 기본 브랜치: `main`
