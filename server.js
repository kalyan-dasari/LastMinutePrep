const { app, bootstrap } = require("./src/app");

const PORT = process.env.PORT || 3000;
const isVercel = Boolean(process.env.VERCEL);
const bootstrapPromise = bootstrap();

if (isVercel) {
  module.exports = async (req, res) => {
    try {
      await bootstrapPromise;
      return app(req, res);
    } catch (err) {
      console.error("Bootstrap failed in Vercel runtime:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("Server initialization failed. Check DATABASE_URL and Supabase configuration.");
      }
      return undefined;
    }
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
