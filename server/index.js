import app from './app.js';
import { env } from './env.js';

app.listen(env.port, () => {
  console.log(`[server] http://localhost:${env.port}  (bakong=${env.bakong.env}, features=${JSON.stringify(env.features)})`);
});
