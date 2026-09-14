const express = require('express');
const app = express();
app.use(express.json());

const port = process.env.PORT || 10000;

// 1. Route trang chủ giữ lại thẻ meta để Zalo kiểm tra định kỳ
app.get('/', (req, res) => {
  res.send('<html><head><meta name="zalo-platform-site-verification" content="OC6LUOMpFNj1Z9nMWleM24VFeoohkNbxD38m" /></head><body>Webhook Active</body></html>');
});

// 2. Route nhận Webhook từ Zalo OA
app.post('/webhook', (req, res) => {
  console.log('Received Zalo Event:', JSON.stringify(req.body));
  // Trả về HTTP 200 ngay để Zalo xác nhận server hoạt động
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
