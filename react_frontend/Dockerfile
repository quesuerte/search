# docker run -d --name react -p 3000:3000 -v C:\Users\Blinn\Documents\rust\search_project\react_frontend:/app node:latest tail -f /dev/null
FROM node:alpine AS builder
WORKDIR /opt
COPY ./package.json package.json
COPY ./package-lock.json package-lock.json
RUN npm update --force --save
RUN npm ci 
COPY ./src src 
COPY ./public public 
RUN npm run build
RUN mv build react

FROM nginxinc/nginx-unprivileged:alpine
COPY ./www /www
COPY --from=builder --chown=nginx:nginx react /www/react
