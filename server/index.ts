import { createHttpServer } from "./app.js";
import { config, validateConfig } from "./config.js";

const server = createHttpServer();

server.listen(config.server.port, config.server.host, () => {
  validateConfig();
  console.log(`Voice server listening on http://${config.server.host}:${config.server.port}`);
});
