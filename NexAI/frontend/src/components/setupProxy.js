const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/patients',
    createProxyMiddleware({
      target: 'https://nexai-referral-tracking-1.onrender.com',
      changeOrigin: true,
    })
  );
  app.use(
    '/visits',
    createProxyMiddleware({
      target: 'https://nexai-referral-tracking-1.onrender.com',
      changeOrigin: true,
    })
  );
};
