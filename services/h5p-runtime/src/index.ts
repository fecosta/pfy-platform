import { getRuntimeConfig } from "./config.js";
import { createApp } from "./app.js";

async function main() {
  const config = getRuntimeConfig();
  const { app } = await createApp(config);

  app.listen(config.PORT, () => {
    console.log(`PFY H5P runtime listening on port ${config.PORT}`);
  });
}

main().catch((error) => {
  console.error("Failed to start H5P runtime", error);
  process.exit(1);
});
