const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const ZALO_ACCESS_TOKEN = process.env.ZALO_ACCESS_TOKEN;
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

app.post('/webhook', async (req, res) => {
    res.status(200).send('OK');
    
    const event = req.body;
    console.log('Received Zalo Event:', JSON.stringify(event));

    if (event.event_name === 'user_send_text') {
        const userId = event.sender.id;
        const userMessage = event.message.text;

        try {
            // 1. Gọi Dify AI
            console.log('Sending to Dify...');
            const difyResponse = await axios.post(`${DIFY_API_URL}/chat-messages`, {
                inputs: {},
                query: userMessage,
                response_mode: 'streaming',
                user: userId
            }, {
                headers: {
                    'Authorization': `Bearer ${DIFY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const replyText = difyResponse.data.answer;
            console.log('Dify Answer:', replyText);

            // 2. Gửi phản hồi lại Zalo
            console.log('Sending reply to Zalo...');
            await axios.post('https://openapi.zalo.me/v2.0/oa/message', {
                recipient: { user_id: userId },
                message: { text: replyText }
            }, {
                headers: {
                    'access_token': ZALO_ACCESS_TOKEN,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Successfully sent message to Zalo!');
        } catch (error) {
            console.error('Error processing message:', error.response ? error.response.data : error.message);
        }
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
