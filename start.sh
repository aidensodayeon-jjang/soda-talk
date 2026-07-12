#!/bin/bash

# .env 파일이 없으면 .env.example을 복사해서 생성
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# 의존성 설치
npm install

# 서비스 실행 (포트 7989)
PORT=7989 npm run dev
