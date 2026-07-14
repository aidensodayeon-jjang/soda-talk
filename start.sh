#!/bin/bash

# .env 파일이 없으면 .env.example을 복사해서 생성
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# 기존에 포트 7989를 사용 중인 프로세스가 있다면 찾아서 종료
EXISTING_PID=$(lsof -t -i :7989)
if [ ! -z "$EXISTING_PID" ]; then
  echo "포트 7989를 점유 중인 기존 서버(PID: $EXISTING_PID)를 종료합니다..."
  kill -9 $EXISTING_PID
fi

# 의존성 설치
npm install

# 서비스 실행 (포트 7989)
PORT=7989 npm run dev
