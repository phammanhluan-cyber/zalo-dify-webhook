const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1';

app.post('/webhook', async (req, res) => {
    // Phản hồi ngay cho Telegram để tránh timeout
    res.status(200).send('OK');

    const update = req.body;

    // Kiểm tra xem có tin nhắn văn bản gửi đến từ người dùng không
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const userMessage = update.message.text;

        console.log(`Nhận tin nhắn từ Telegram [ChatID: ${chatId}]: ${userMessage}`);

        try {
            // Gửi câu hỏi sang Dify AI với chế độ streaming (bắt buộc cho Agent Chat App)
            const difyResponse = await axios.post(`${DIFY_API_URL}/chat-messages`, {
                inputs: {},
                query: userMessage,
                response_mode: 'streaming',
                user: String(chatId)
            }, {
                headers: {
                    'Authorization': `Bearer ${DIFY_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'text'
            });

            // Gom dữ liệu trả về từ luồng stream của Dify
            let botReply = '';
            const lines = difyResponse.data.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonData = JSON.parse(line.substring(6));
                        if (jsonData.answer) {
                            botReply += jsonData.answer;
                        }
                    } catch (e) {
                        // Bỏ qua dòng JSON lỗi hoặc sự kiện kết thúc luồng
                    }
                }
            }

            if (!botReply) {
                botReply = "Xin lỗi, hệ thống AI đã phản hồi nhưng không có nội dung văn bản hiển thị.";
            }

            // Gửi câu trả lời ngược lại về Telegram cho người dùng
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: botReply
            });

            console.log(`Đã trả lời tin nhắn thành công cho [ChatID: ${chatId}]`);

        } catch (error) {
            console.error('Lỗi xử lý Dify hoặc Telegram:', error.response?.data || error.message);
            
            try {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: "Xin lỗi, hệ thống hỗ trợ kỹ thuật đang gặp chút gián đoạn khi kết nối với AI. Anh vui lòng thử lại sau ít phút nhé!"
                });
            } catch (sendErr) {
                console.error('Không thể gửi tin nhắn báo lỗi về Telegram:', sendErr.message);
            }
        }
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running and listening on port ${PORT}`);
});
