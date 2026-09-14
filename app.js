const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('<html><head><meta name="zalo-platform-site-verification" content="OC6LUOMpFNj1Z9nMWleM24VFeoohkNbxD38m" /></head><body>OK</body></html>');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
