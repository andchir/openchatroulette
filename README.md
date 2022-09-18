# OpenChatRoulette

Chat for a conversation with a random interlocutor. The WebRTC technology is used, which performs a peer-to-peer connection.

# How to install

1. `clone https://github.com/andchir/openchatroulette.git`
2. `cd openchatroulette` -> `npm install` -> `cd openchatroulette` -> `npm install`.
3. Open and edit configuration files: "**.env**" and "**openchatroulette/src/environments/environment.prod.ts**".
4. Build static production files: `npm build`.
5. Download and unpack MaxMind's "**GeoLite2-Country_xxx.tar.gz**" to "**geoip**" folder.
6. Start server: `cd ..` -> `npm run peer-server` or `node server/peer-server.js`.
7. Open in browser: "**http://localhost:9000**".

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
