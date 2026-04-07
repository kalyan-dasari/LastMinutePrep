const { app, bootstrap } = require("./src/app");

const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL);
const bootstrapPromise = bootstrap();

if (isVercel) {
  module.exports = async (req, res) => {
    await bootstrapPromise;
    return app(req, res);
  };
} else {
  bootstrapPromise
    .then(() => {
      app.listen(PORT, () => {
        console.log(`LastMinutePrep running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start application", err);
      process.exit(1);
    });
}
