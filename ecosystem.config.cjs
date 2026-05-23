module.exports = {
  apps: [
    {
      name: "pwio-api",
      cwd: "./apps/api",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: "3001"
      }
    },
    {
      name: "pwio-web-preview",
      cwd: "./apps/web",
      script: "node_modules/vite/bin/vite.js",
      args: "preview --host 0.0.0.0 --port 5173",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
