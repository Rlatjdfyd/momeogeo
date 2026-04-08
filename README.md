
# 점심 관리 시스템 (Lunch Management System)

이 애플리케이션은 팀의 점심 식사 주문 및 결제 기록 관리를 위한 웹 기반 시스템입니다. Firebase Realtime Database를 백엔드로 사용하여 실시간 협업 기능과 데이터 영속성을 제공합니다.

## 주요 기능

*   **일일 점심 주문**:
    *   결제자 지정 (팀 멤버 또는 게스트)
    *   식당 선택 (등록된 식당 또는 직접 입력)
    *   팀 멤버 및 게스트별 메뉴 선택
    *   총 결제 금액 입력
    *   **실시간 동기화**: 모든 변경 사항이 참여자들에게 즉시 반영됩니다.
*   **주간 담당자 순환**:
    *   멤버들의 과거 결제 횟수(`payCount`)를 기반으로 점심 결제 담당자를 자동으로 순환 배정합니다.
    *   수동으로 순번을 조정하고 저장할 수 있습니다.
*   **식사 기록 및 통계**:
    *   과거 점심 식사 기록 조회 (날짜, 식당, 결제자, 금액, 메뉴 등).
    *   멤버별 누적 결제 횟수 및 금액 통계.
    *   월별/연간 총 지출 금액 및 평균 금액 통계.
*   **데이터 관리**:
    *   팀 멤버 정보 관리 (추가, 수정, 삭제, 결제 횟수 조정).
    *   식당 정보 및 메뉴 관리 (추가, 수정, 삭제).
*   **데이터 백업**: 현재 데이터를 JSON 파일로 내보내는 기능을 제공합니다.

## 기술 스택

*   **프론트엔드**: HTML, CSS, JavaScript (Vanilla JS)
*   **백엔드/데이터베이스**: Firebase Realtime Database

## Firebase 연동

애플리케이션은 Firebase Realtime Database를 사용하여 핵심 데이터를 관리하고 실시간 기능을 구현합니다.

*   **주요 데이터 구조**:
    *   `/members`: 팀 멤버 정보 (ID, 이름, 결제 횟수 등)
    *   `/lunchRecords`: 과거 식사 기록
    *   `/restaurants`: 식당 정보 및 메뉴
    *   `/weeklyOrder`: 주간 결제 담당자 순서
    *   `/todayOrder`: 오늘의 실시간 주문 상태 (결제자, 식당, 멤버/게스트 메뉴, 총 금액 등)
*   **실시간 업데이트**: `firebase.js`에서 초기화된 Firebase 앱은 `app.js`의 실시간 리스너(`onValue`)를 통해 데이터 변경을 감지하고, `State` 객체를 업데이트하여 UI를 동적으로 갱신합니다.

## 코드 구조

*   `index.html`: 애플리케이션의 기본 HTML 구조 및 진입점.
*   `app.js`: 핵심 애플리케이션 로직, 상태 관리, Firebase 데이터 동기화 및 비즈니스 로직 처리.
*   `firebase.js`: Firebase 초기화 및 Realtime Database 관련 데이터 접근/관리 함수 정의.
*   `ui.js`: DOM 조작을 통한 사용자 인터페이스 렌더링 및 사용자 인터랙션 이벤트 처리.
*   `style.css`: 애플리케이션의 스타일링.

## 개발 및 실행 (추정)

이 프로젝트는 별도의 빌드 도구 없이 HTML, CSS, JavaScript 파일을 직접 로드하여 실행할 수 있는 구조로 보입니다.

1.  프로젝트 루트 디렉토리의 `index.html` 파일을 웹 브라우저에서 엽니다.
2.  Firebase 프로젝트 설정 (`firebaseConfig`)이 올바르게 구성되었는지 확인해야 합니다. (현재는 예시 값으로 설정되어 있음)

## 기여

*   이 애플리케이션은 Gemini CLI를 통해 개발 및 분석되었습니다.

---
This README file was generated based on the analysis of the provided code files.
##
