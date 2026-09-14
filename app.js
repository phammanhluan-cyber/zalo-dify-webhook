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
    if (event.event_name === 'user_send_text') {
        const userId = event.sender.id;
        const userMessage = event.message.text;

        try {
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
                },
                responseType: 'stream'
            });

            let replyText = '';
            
            difyResponse.data.on('data', chunk => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            // Hỗ trợ lấy text từ cả Agent lẫn Chatflow
                            if (data.answer) {
                                replyText += data.answer;
                            } else if (data.event === 'agent_message' && data.thought) {
                                replyText += data.thought;
                            }
                        } catch (e) {}
                    }
                }
            });

            difyResponse.data.on('end', async () => {
                console.log('Dify Final Answer:', replyText);
                if (replyText.trim()) {
                    console.log('Sending reply to Zalo...');
                    const zaloRes = await axios.post('https://openapi.zalo.me/v2.0/oa/message', {
                        recipient: { user_id: userId },
                        message: { text: replyText }
                    }, {
                        headers: {
                            'access_token': ZALO_ACCESS_TOKEN,
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log('Zalo Response:', zaloRes.data);
                } else {
                    console.log('No answer generated from Dify.');
                }
            });

        } catch (error) {
            console.error('Error processing message:', error.response ? error.response.data : error.message);
        }
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
