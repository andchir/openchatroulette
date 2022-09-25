# OpenChatRoulette

Free, Open-source Chat for a conversation with a random interlocutor. The WebRTC technology is used, which performs a peer-to-peer connection.

![OpenChatRoulette - screenshot #1](https://raw.githubusercontent.com/andchir/openchatroulette/main/openchatroulette/openchatroulette.png "OpenChatRoulette - screenshot #1")

# How to install

1. `clone https://github.com/andchir/openchatroulette.git`
2. Open and edit configuration files: "**.env**" and "**openchatroulette/src/environments/environment.prod.ts**".
3. Back up your **env** files: `cp .env .env_copy`, `cp openchatroulette/src/environments/environment.prod.ts openchatroulette/src/environments/environment.prod.ts_copy`.
4. Install dependencies: `cd openchatroulette` -> `npm install` -> `cd openchatroulette` -> `npm install`.
5. Build static production files (html, css, js): `npm run build`.
6. Return to root folder: `cd ..`. Download and unpack MaxMind's "**GeoLite2-Country_xxx.tar.gz**" to "**geoip**" folder.
7. Install process manager for NodeJS: `sudo npm install -g pm2`
8. Start server: `pm2 start server/peer-server.js`.
9. Open in browser: "**https://yourdomain.com**" or "**http://localhost:9000**".
10. Look application status: `pm2 info peer-server` or `pm2 monit`.

## Optional
11. Install STUN/TURN server. For example: [https://github.com/coturn/coturn](https://github.com/coturn/coturn)
12. Open and edit file "openchatroulette/src/environments/environment.prod.ts".  
    You can edit "stun_urls", "turn_urls", "turn_username", "turn_credential".
13. Build production files again: `cd openchatroulette` -> `npm run build`.

## Admin area

URL: `https://yourdomain.com/chatadmin` or `http://localhost:9000/chatadmin`  
Use **ADMIN_USERNAME** and **ADMIN_PASSWORD** from `.env`. 

# Nginx configuration

~~~
server {
    listen 80;
    server_name website.domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name website.domain.com;
    
    client_max_body_size 250m;
    
    ssl_certificate          /etc/letsencrypt/live/mydomain/fullchain.pem;
    ssl_certificate_key      /etc/letsencrypt/live/mydomain/privkey.pem;

    location / {
        proxy_pass https://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
~~~

# Libraries used
- Angular with NGXS
- TypeScript
- NodeJS
- PeerJS
- Bootstrap
- MaxMind GeoIP2
- other...

# Development

Run in development mode:
~~~
npm run start
~~~

Extract localization:
~~~
npm run extract-i18n
~~~

### MIT License
